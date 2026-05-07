import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'repository_providers.dart';

class FeesNotifier extends AutoDisposeAsyncNotifier<FeeDetails> {
  @override
  Future<FeeDetails> build() async {
    return _fetchData();
  }

  Future<FeeDetails> _fetchData() async {
    final repo = ref.read(feeRepositoryProvider);
    return await repo.getFeeDetails('');
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }
}

final feesProvider = AsyncNotifierProvider.autoDispose<FeesNotifier, FeeDetails>(() {
  return FeesNotifier();
});
