import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'repository_providers.dart';

class AssignmentsNotifier extends AutoDisposeAsyncNotifier<List<Assignment>> {
  @override
  Future<List<Assignment>> build() async {
    return _fetchData();
  }

  Future<List<Assignment>> _fetchData() async {
    final repo = ref.read(assignmentRepositoryProvider);
    return await repo.getAssignments();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }

  Future<void> submitAssignment(String assignmentId, String fileUrl, String remarks) async {
    try {
      final repo = ref.read(assignmentRepositoryProvider);
      await repo.submitAssignment(assignmentId, fileUrl, remarks);
      // Refresh list to get updated status
      await refresh();
    } catch (e) {
      // Error handling will be caught by UI
      rethrow;
    }
  }
}

final assignmentsProvider = AsyncNotifierProvider.autoDispose<AssignmentsNotifier, List<Assignment>>(() {
  return AssignmentsNotifier();
});
