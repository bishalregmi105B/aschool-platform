import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'repository_providers.dart';

class NoticesNotifier extends AutoDisposeAsyncNotifier<List<Notice>> {
  @override
  Future<List<Notice>> build() async {
    return _fetchData();
  }

  Future<List<Notice>> _fetchData() async {
    final repo = ref.read(noticeRepositoryProvider);
    return await repo.getNotices();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }
}

final noticesProvider = AsyncNotifierProvider.autoDispose<NoticesNotifier, List<Notice>>(() {
  return NoticesNotifier();
});
