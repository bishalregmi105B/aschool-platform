import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// "Today's trips" strip above the live map (S-A4): one card per direction
/// (morning / afternoon) showing bus, status chip, stop progress and the
/// last GPS update; tapping opens the stop timeline.
class TodaysTripsSection extends ConsumerStatefulWidget {
  const TodaysTripsSection({super.key});

  @override
  ConsumerState<TodaysTripsSection> createState() => _TodaysTripsSectionState();
}

class _TodaysTripsSectionState extends ConsumerState<TodaysTripsSection> {
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    // Mirror the screen's 15s location polling cadence for trip state.
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      final page =
          ref.read(transportInstancesForDateProvider(null)).valueOrNull;
      if (page?.instances.any((i) => i.isRunning) ?? false) {
        ref.invalidate(transportInstancesForDateProvider(null));
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
    final trips = ref.watch(transportInstancesForDateProvider(null));

    return trips.maybeWhen(
      data: (page) {
        if (page.instances.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: ESchoolSectionTitle(
                title: "Today's trips",
                trailing: Text(
                  page.date,
                  style: const TextStyle(
                      fontSize: 11.5, color: ASchoolTheme.mutedText),
                ),
              ),
            ),
            SizedBox(
              height: 128,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: page.instances.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, index) => _TripCard(
                  instance: page.instances[index],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _TripCard extends StatelessWidget {
  final TripInstance instance;

  const _TripCard({required this.instance});

  @override
  Widget build(BuildContext context) {
    final isAfternoon = instance.direction == 'afternoon';
    final accent = switch (instance.status) {
      'running' => ASchoolTheme.success,
      'completed' => ASchoolTheme.primary,
      'cancelled' => ASchoolTheme.danger,
      _ => ASchoolTheme.warning,
    };

    return SizedBox(
      width: 220,
      child: ESchoolCard(
        onTap: () => context.push('/transport/trips/${instance.id}'),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isAfternoon
                      ? Icons.wb_twilight_rounded
                      : Icons.wb_sunny_rounded,
                  size: 18,
                  color: ASchoolTheme.primary,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    isAfternoon ? 'Afternoon' : 'Morning',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13.5),
                  ),
                ),
                Text(
                  _statusLabel(instance.status),
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: accent,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              instance.bus?.isNotEmpty == true
                  ? 'Bus ${instance.bus}'
                  : 'Bus —',
              style:
                  const TextStyle(fontSize: 12, color: ASchoolTheme.mutedText),
            ),
            const Spacer(),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: instance.totalStopCount == 0
                    ? null
                    : instance.visitedStopCount / instance.totalStopCount,
                minHeight: 5,
                backgroundColor: Colors.grey.withAlpha(40),
                valueColor: AlwaysStoppedAnimation<Color>(
                  instance.status == 'running'
                      ? ASchoolTheme.success
                      : ASchoolTheme.primary,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Text(
                  '${instance.visitedStopCount}/${instance.totalStopCount} stops',
                  style: const TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                Icon(Icons.my_location_rounded,
                    size: 11, color: Colors.grey[500]),
                const SizedBox(width: 3),
                Flexible(
                  child: Text(
                    instance.lastFixAt != null
                        ? _relative(instance.lastFixAt!)
                        : 'no GPS yet',
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 10.5, color: Colors.grey[600]),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _statusLabel(String status) => switch (status) {
        'running' => 'RUNNING',
        'completed' => 'DONE',
        'cancelled' => 'CANCELLED',
        _ => 'SCHEDULED',
      };
}

String _relative(DateTime ts) {
  final local = ts.isUtc ? ts.toLocal() : ts;
  final diff = DateTime.now().difference(local);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 12) return '${diff.inHours}h ago';
  return 'earlier';
}
