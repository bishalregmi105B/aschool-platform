import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'repository_providers.dart';

class TimetableNotifier extends AutoDisposeAsyncNotifier<List<TimetableSlot>> {
  @override
  Future<List<TimetableSlot>> build() async {
    return _fetchData();
  }

  Future<List<TimetableSlot>> _fetchData() async {
    final repo = ref.read(timetableRepositoryProvider);
    return await repo.getStudentTimetable();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }
}

final timetableProvider =
    AsyncNotifierProvider.autoDispose<TimetableNotifier, List<TimetableSlot>>(
        () {
  return TimetableNotifier();
});
