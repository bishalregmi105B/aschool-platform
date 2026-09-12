import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import 'repository_providers.dart';

/// S-A4 trip lifecycle providers shared by the parent app (today's trips,
/// stop timeline) and the unified user app (driver MVP). The instance list
/// is role-aware server-side: parents get the runs their children ride,
/// staff/driver tokens get their own runs.

/// Today's (or a given BS date's) trip instances.
final transportInstancesForDateProvider =
    FutureProvider.autoDispose.family<TransportInstancesPage, String?>(
  (ref, dateBs) async {
    final repo = ref.read(transportRepositoryProvider);
    return repo.getInstancesForDate(dateBs: dateBs);
  },
);

/// Full run view — stops + passengers. Auto-refresh by invalidating.
final transportInstanceDetailProvider =
    FutureProvider.autoDispose.family<TripInstance, String>(
  (ref, instanceId) async {
    final repo = ref.read(transportRepositoryProvider);
    return repo.getInstance(instanceId);
  },
);

/// Per-student transport notification prefs (parent settings screen).
final transportPrefsProvider =
    FutureProvider.autoDispose<TransportPrefsBundle>((ref) async {
  final repo = ref.read(transportRepositoryProvider);
  return repo.getNotificationPrefs();
});
