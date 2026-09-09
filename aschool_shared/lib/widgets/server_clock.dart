import 'dart:async';

import 'package:flutter/material.dart';

import '../services/i18n_service.dart';
import '../services/server_time_service.dart';
import 'bs_date_field.dart';

/// Live server clock + BS date for app bars and dashboards — the mobile
/// sibling of the web ServerClock. Ticks locally every second from the
/// server-synced time service (a device with a wrong clock no longer lies).
class ServerClock extends StatefulWidget {
  final Color? textColor;
  final Color? iconColor;
  final bool compact;

  const ServerClock({super.key, this.textColor, this.iconColor, this.compact = false});

  @override
  State<ServerClock> createState() => _ServerClockState();
}

class _ServerClockState extends State<ServerClock> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    ServerTimeService.instance.startSync();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18nService.instance;
    final theme = Theme.of(context);
    final fg = widget.textColor ?? theme.textTheme.bodyMedium?.color;
    final service = ServerTimeService.instance;
    final time = service.hhmm;
    final bs = bsDisplay(service.now(), nepali: i18n.isNepali);

    final content = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.schedule_rounded, size: 14,
            color: widget.iconColor ?? theme.colorScheme.primary),
        const SizedBox(width: 4),
        Text('$time · $bs',
            style: TextStyle(
                fontSize: widget.compact ? 10 : 11.5,
                fontWeight: FontWeight.w600,
                color: fg,
                fontFeatures: const [FontFeature.tabularFigures()])),
      ],
    );

    return Tooltip(
      message: i18n.t('Server time (NPT)', 'सर्भर समय (नेपाली समय)'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(8),
        ),
        child: content,
      ),
    );
  }
}
