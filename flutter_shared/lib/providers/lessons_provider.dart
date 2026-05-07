import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'repository_providers.dart';

class LessonsNotifier extends AutoDisposeAsyncNotifier<List<Lesson>> {
  @override
  Future<List<Lesson>> build() async {
    return _fetchData();
  }

  Future<List<Lesson>> _fetchData() async {
    final repo = ref.read(lessonRepositoryProvider);
    return await repo.getLessons('', '', '');
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }
}

final lessonsProvider = AsyncNotifierProvider.autoDispose<LessonsNotifier, List<Lesson>>(() {
  return LessonsNotifier();
});
