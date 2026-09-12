import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import 'driver_run_screen.dart';

/// Driver MVP screen 1 — today's runs (S-A4). The backend filters the
/// instance list to the logged-in driver's own runs for staff tokens, so
/// this list IS the driver's assignment sheet: running first, then
/// scheduled. Tapping opens the run screen (start / GPS / board / drop off).
class DriverRunsScreen extends ConsumerStatefulWidget {
  const DriverRunsScreen({super.key});

  @override
  ConsumerState<DriverRunsScreen> createState() => _DriverRunsScreenState();
}

class _DriverRunsScreenState extends ConsumerState<DriverRunsScreen> {
  Timer? _refreshTimer;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(
        const Duration(seconds: 20), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _error = null);
    try {
      // Invalidate first so the watched provider and this load share one
      // flight instead of duplicating the GET.
      ref.invalidate(transportInstancesForDateProvider(null));
      await ref.read(transportInstancesForDateProvider(null).future);
      if (!mounted) return;
      setState(() {
        _error = null;
        _lastLoaded = DateTime.now();
      });
    } catch (e) {
      if (!mounted) return;
      if (!silent) setState(() => _error = e.toString());
    }
  }

  DateTime? _lastLoaded;

  @override
  Widget build(BuildContext context) {
    final runsAsync = ref.watch(transportInstancesForDateProvider(null));

    return Scaffold(
      appBar: const CustomAppBar(title: "Today's Runs"),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(transportInstancesForDateProvider(null));
          await _load(silent: true);
        },
        child: runsAsync.when(
          loading: () => const LoadingShimmer(),
          error: (e, _) => ErrorContainer(
            errorMessage: e.toString(),
            onRetry: () {
              ref.invalidate(transportInstancesForDateProvider(null));
              _load();
            },
          ),
          data: (page) {
            if (page.instances.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  NoDataContainer(
                    title: 'No runs assigned today',
                    subtitle:
                        'When the school assigns you to a trip, it will appear here.',
                  ),
                ],
              );
            }
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    Text(
                      page.date,
                      style: const TextStyle(
                          fontSize: 12.5, color: ASchoolTheme.mutedText),
                    ),
                    const Spacer(),
                    Text(
                      _lastLoaded != null
                          ? 'Updated ${_lastLoaded!.hour.toString().padLeft(2, '0')}:${_lastLoaded!.minute.toString().padLeft(2, '0')}'
                          : '',
                      style: const TextStyle(
                          fontSize: 11, color: ASchoolTheme.mutedText),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                for (final instance in page.instances)
                  _RunCard(instance: instance),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    style: const TextStyle(
                        fontSize: 12, color: ASchoolTheme.danger),
                    textAlign: TextAlign.center,
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _RunCard extends StatelessWidget {
  final TripInstance instance;

  const _RunCard({required this.instance});

  @override
  Widget build(BuildContext context) {
    final isAfternoon = instance.direction == 'afternoon';
    final (statusLabel, statusColor) = switch (instance.status) {
      'running' => ('Running', ASchoolTheme.success),
      'completed' => ('Completed', ASchoolTheme.primary),
      'cancelled' => ('Cancelled', ASchoolTheme.danger),
      _ => ('Scheduled', ASchoolTheme.warning),
    };

    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 12),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => DriverRunScreen(instanceId: instance.id),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: ASchoolTheme.primary.withAlpha(16),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isAfternoon
                  ? Icons.wb_twilight_rounded
                  : Icons.wb_sunny_rounded,
              color: ASchoolTheme.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isAfternoon ? 'Afternoon run' : 'Morning run',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 15),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    if (instance.bus?.isNotEmpty == true)
                      'Bus ${instance.bus}',
                    if (instance.stops.isNotEmpty &&
                        instance.stops.first.plannedTs != null)
                      'First stop ${_fmtHm(instance.stops.first.plannedTs)}',
                  ].join('  •  '),
                  style: const TextStyle(
                      fontSize: 12, color: ASchoolTheme.mutedText),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: instance.totalStopCount == 0
                              ? null
                              : instance.visitedStopCount /
                                  instance.totalStopCount,
                          minHeight: 4,
                          backgroundColor: Colors.grey.withAlpha(40),
                          valueColor: AlwaysStoppedAnimation<Color>(
                              statusColor),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${instance.visitedStopCount}/${instance.totalStopCount}',
                      style: const TextStyle(
                          fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(20),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: statusColor,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              const Icon(Icons.chevron_right_rounded,
                  size: 20, color: ASchoolTheme.mutedText),
            ],
          ),
        ],
      ),
    );
  }
}

String _fmtHm(DateTime? ts) {
  if (ts == null) return '—';
  final local = ts.isUtc ? ts.toLocal() : ts;
  return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}
