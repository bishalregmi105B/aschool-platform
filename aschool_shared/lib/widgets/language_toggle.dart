import 'package:flutter/material.dart';

import '../services/i18n_service.dart';

/// Animated EN ⇄ ने language toggle for app bars — sibling of the web
/// header's LanguageToggle. Listens to I18nService so every screen that
/// shows it stays in sync.
class LanguageToggle extends StatefulWidget {
  final Color? foreground;
  final Color? background;

  const LanguageToggle({super.key, this.foreground, this.background});

  @override
  State<LanguageToggle> createState() => _LanguageToggleState();
}

class _LanguageToggleState extends State<LanguageToggle> {
  final I18nService _i18n = I18nService.instance;

  @override
  void initState() {
    super.initState();
    _i18n.addListener(_onChange);
  }

  @override
  void dispose() {
    _i18n.removeListener(_onChange);
    super.dispose();
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final isNe = _i18n.isNepali;
    final fg = widget.foreground ?? Theme.of(context).colorScheme.onPrimary;
    final bg = widget.background ?? Colors.white.withValues(alpha: 0.18);
    return Tooltip(
      message: _i18n.t('Language / भाषा', 'भाषा / Language'),
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => _i18n.toggle(),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('EN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg.withValues(alpha: isNe ? 0.55 : 1))),
                Switch(
                  value: isNe,
                  onChanged: (_) => _i18n.toggle(),
                  activeThumbColor: fg,
                  activeTrackColor: fg.withValues(alpha: 0.4),
                  inactiveThumbColor: fg,
                  inactiveTrackColor: fg.withValues(alpha: 0.25),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                Text('ने', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg.withValues(alpha: isNe ? 1 : 0.55))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Compact text-button variant for surfaces where a switch is too heavy.
class LanguageTextButton extends StatelessWidget {
  const LanguageTextButton({super.key});

  @override
  Widget build(BuildContext context) {
    final i18n = I18nService.instance;
    return AnimatedBuilder(
      animation: i18n,
      builder: (context, _) => TextButton(
        onPressed: () => i18n.toggle(),
        child: Text(
          i18n.isNepali ? 'English' : 'नेपाली',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
