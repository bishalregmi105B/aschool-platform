import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'repository_providers.dart';

class ExamsData {
  final List<Exam> offlineExams;
  final List<OnlineExam> onlineExams;

  const ExamsData({
    this.offlineExams = const [],
    this.onlineExams = const [],
  });
}

class ExamsNotifier extends AutoDisposeAsyncNotifier<ExamsData> {
  @override
  Future<ExamsData> build() async {
    return _fetchData();
  }

  Future<ExamsData> _fetchData() async {
    final repo = ref.read(examRepositoryProvider);

    final offline = await repo.getExams();
    List<OnlineExam> online = [];
    try {
      online = await repo.getOnlineExams();
    } catch (_) {}

    return ExamsData(
      offlineExams: offline,
      onlineExams: online,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }
}

final examsProvider =
    AsyncNotifierProvider.autoDispose<ExamsNotifier, ExamsData>(() {
  return ExamsNotifier();
});

class ResultsNotifier extends AutoDisposeAsyncNotifier<List<ExamResult>> {
  @override
  Future<List<ExamResult>> build() async {
    return _fetchData();
  }

  Future<List<ExamResult>> _fetchData() async {
    final repo = ref.read(examRepositoryProvider);
    return await repo.getResults();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }
}

final resultsProvider =
    AsyncNotifierProvider.autoDispose<ResultsNotifier, List<ExamResult>>(() {
  return ResultsNotifier();
});
