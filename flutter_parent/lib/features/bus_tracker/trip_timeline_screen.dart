import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

/// Parent-side stop timeline for one trip instance (S-A4). The SBT-style
/// vertical timeline rebuilt on ASchool tokens: numbered stops, green when
/// the run stamped an actual arrival (with actual vs planned), grey while
/// pending. Below it, the ride register for the run with the selected child
/// highlighted.
class TripTimelineScreen extends ConsumerStatefulWidget {
  final String instanceId;

  const TripTimelineScreen({super.key, required this.instanceId});

  @override
  ConsumerState<TripTimelineScreen> createState() => _TripTimelineScreenState();
}

class _TripTimelineScreenState extends ConsumerState<TripTimelineScreen> {
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    // Keep the timeline fresh while the bus is running; the provider is
    // cheap (one GET) and autoDispose cleans up when the screen pops.
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      final instance = ref.read(
        transportInstanceDetailProvider(widget.instanceId),
      ).valueOrNull;
      if (instance?.isRunning ?? false) {
        ref.invalidate(transportInstanceDetailProvider(widget.instanceId));
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(transportInstanceDetailProvider(widget.instanceId));

    return PluginGate(
      pluginSlug: 'gps_tracking',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Trip Timeline'),
        body: detail.when(
          loading: () => const LoadingShimmer(),
          error: (e, _) => ErrorContainer(
            errorMessage: e.toString(),
            onRetry: () => ref.invalidate(
                transportInstanceDetailProvider(widget.instanceId)),
          ),
          data: (instance) => RefreshIndicator(
            onRefresh: () async => ref.invalidate(
                transportInstanceDetailProvider(widget.instanceId)),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                _headerCard(instance),
                const SizedBox(height: 16),
                ESchoolSectionTitle(
                  title: 'Stops',
                  trailing: Text(
                    '${instance.visitedStopCount}/${instance.totalStopCount} visited',
                    style: const TextStyle(
                      fontSize: 12,
                      color: ASchoolTheme.mutedText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                if (instance.stops.isEmpty)
                  const ESchoolCard(
                    child: Text(
                      'No stops are configured for this trip yet.',
                      style: TextStyle(color: ASchoolTheme.mutedText),
                    ),
                  )
                else
                  ..._buildStopTimeline(instance),
                if (instance.passengers.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  const ESchoolSectionTitle(
                    title: 'Students on this trip',
                  ),
                  const SizedBox(height: 10),
                  _passengersCard(instance),
                ],
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _headerCard(TripInstance instance) {
    return ESchoolCard(
      color: instance.isRunning
          ? ASchoolTheme.success.withAlpha(14)
          : Theme.of(context).cardColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                instance.direction == 'afternoon'
                    ? Icons.wb_twilight_rounded
                    : Icons.wb_sunny_rounded,
                color: ASchoolTheme.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  instance.direction == 'afternoon'
                      ? 'Afternoon trip'
                      : 'Morning trip',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 16),
                ),
              ),
              _StatusChip(status: instance.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            [
              if (instance.bus != null && instance.bus!.isNotEmpty)
                'Bus ${instance.bus}',
              if (instance.dateBs != null && instance.dateBs!.isNotEmpty)
                instance.dateBs!,
              if (instance.startedAt != null)
                'Started ${_fmtHm(instance.startedAt)}',
              if (instance.endedAt != null)
                'Ended ${_fmtHm(instance.endedAt)}',
            ].join('  •  '),
            style: const TextStyle(
                fontSize: 12.5, color: ASchoolTheme.mutedText),
          ),
          if (instance.lastFixAt != null) ...[
            const SizedBox(height: 6),
            Text(
              'Last GPS update ${_relative(instance.lastFixAt!)}'
              '${instance.lastSpeedKmh != null ? ' • ${instance.lastSpeedKmh!.round()} km/h' : ''}',
              style: const TextStyle(
                  fontSize: 11.5, color: ASchoolTheme.mutedText),
            ),
          ],
        ],
      ),
    );
  }

  List<Widget> _buildStopTimeline(TripInstance instance) {
    final widgets = <Widget>[];
    for (var i = 0; i < instance.stops.length; i++) {
      widgets.add(_StopTimelineTile(
        stop: instance.stops[i],
        isLast: i == instance.stops.length - 1,
      ));
    }
    return widgets;
  }

  Widget _passengersCard(TripInstance instance) {
    final selectedChildId = ref.watch(selectedChildIdForApiProvider);
    final waiting =
        instance.passengers.where((p) => p.rideStatus == TripPassenger.statusWaiting).length;
    return ESchoolCard(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        children: [
          for (final p in instance.passengers)
            ListTile(
              dense: true,
              leading: Icon(
                _rideIcon(p.rideStatus),
                color: _rideColor(p.rideStatus),
              ),
              title: Text(
                p.studentName?.isNotEmpty == true
                    ? p.studentName!
                    : 'Student ${p.studentId}',
                style: TextStyle(
                  fontWeight: p.studentId == selectedChildId
                      ? FontWeight.w700
                      : FontWeight.w500,
                  fontSize: 14,
                ),
              ),
              subtitle: p.studentId == selectedChildId
                  ? const Text('Your child',
                      style:
                          TextStyle(fontSize: 11, color: ASchoolTheme.primary))
                  : null,
              trailing: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _rideColor(p.rideStatus).withAlpha(18),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  p.rideStatusLabel,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: _rideColor(p.rideStatus),
                  ),
                ),
              ),
            ),
          if (waiting > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Text(
                '$waiting student(s) still waiting for pickup',
                style: const TextStyle(
                    fontSize: 11.5, color: ASchoolTheme.mutedText),
              ),
            ),
        ],
      ),
    );
  }

  Color _rideColor(int rideStatus) {
    switch (rideStatus) {
      case TripPassenger.statusOnboard:
        return ASchoolTheme.primary;
      case TripPassenger.statusMissed:
        return ASchoolTheme.danger;
      case TripPassenger.statusDropped:
        return ASchoolTheme.success;
      default:
        return ASchoolTheme.warning;
    }
  }

  IconData _rideIcon(int rideStatus) {
    switch (rideStatus) {
      case TripPassenger.statusOnboard:
        return Icons.airline_seat_recline_normal_rounded;
      case TripPassenger.statusMissed:
        return Icons.person_off_rounded;
      case TripPassenger.statusDropped:
        return Icons.check_circle_rounded;
      default:
        return Icons.schedule_rounded;
    }
  }
}

/// One numbered stop in the vertical timeline. Green when visited (actual
/// vs planned shown), grey pending.
class _StopTimelineTile extends StatelessWidget {
  final InstanceStop stop;
  final bool isLast;

  const _StopTimelineTile({required this.stop, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final visited = stop.visited;
    final accent = visited ? ASchoolTheme.success : ASchoolTheme.mutedText;
    lateBy() {
      if (stop.actualTs == null || stop.plannedTs == null) return null;
      final diff = stop.actualTs!.difference(stop.plannedTs!).inMinutes;
      return diff > 2 ? diff : null;
    }

    final lateMin = lateBy();

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 44,
            child: Column(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: visited ? ASchoolTheme.success : Colors.transparent,
                    shape: BoxShape.circle,
                    border: Border.all(color: accent, width: 2),
                  ),
                  child: Center(
                    child: visited
                        ? const Icon(Icons.check_rounded,
                            size: 18, color: Colors.white)
                        : Text(
                            '${stop.seq}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: ASchoolTheme.mutedText,
                            ),
                          ),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: visited
                          ? ASchoolTheme.success.withAlpha(120)
                          : Colors.grey.withAlpha(60),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 18, top: 3),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stop.stopName?.isNotEmpty == true
                        ? stop.stopName!
                        : 'Stop ${stop.seq}',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14.5,
                      color: visited
                          ? ASchoolTheme.secondary
                          : ASchoolTheme.mutedText,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      if (stop.plannedTs != null)
                        'Planned ${_fmtHm(stop.plannedTs)}',
                      if (visited) 'Arrived ${_fmtHm(stop.actualTs)}',
                      if (lateMin != null) 'late by $lateMin min',
                    ].join('  •  '),
                    style: TextStyle(
                      fontSize: 12,
                      color: lateMin != null
                          ? ASchoolTheme.warning
                          : visited
                              ? ASchoolTheme.success
                              : ASchoolTheme.mutedText,
                      fontWeight: visited ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      'running' => ('Running', ASchoolTheme.success),
      'completed' => ('Completed', ASchoolTheme.primary),
      'cancelled' => ('Cancelled', ASchoolTheme.danger),
      _ => ('Scheduled', ASchoolTheme.warning),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (status == 'running') ...[
            SizedBox(
              width: 8,
              height: 8,
              child: CircularProgressIndicator(
                strokeWidth: 1.6,
                valueColor: AlwaysStoppedAnimation<Color>(color),
              ),
            ),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: color,
            ),
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

String _relative(DateTime ts) {
  final local = ts.isUtc ? ts.toLocal() : ts;
  final diff = DateTime.now().difference(local);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
  return _fmtHm(ts);
}
