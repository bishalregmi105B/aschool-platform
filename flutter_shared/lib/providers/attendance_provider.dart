import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'repository_providers.dart';
import 'current_student_provider.dart';

class AttendanceData {
  final AttendanceSummary summary;
  final List<AttendanceRecord> records;

  const AttendanceData({
    required this.summary,
    this.records = const [],
  });
}

class AttendanceNotifier extends AutoDisposeAsyncNotifier<AttendanceData> {
  @override
  Future<AttendanceData> build() async {
    return _fetchData();
  }

  Future<AttendanceData> _fetchData() async {
    final repo = ref.read(attendanceRepositoryProvider);
    final student = await ref.watch(currentStudentProvider.future);
    if (student == null) {
      return const AttendanceData(summary: AttendanceSummary(), records: []);
    }

    final studentId = student.id;

    final summary = await repo.getSummary(studentId);
    final records = await repo.getAttendance(studentId);

    return AttendanceData(
      summary: summary,
      records: records,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }
}

final attendanceProvider =
    AsyncNotifierProvider.autoDispose<AttendanceNotifier, AttendanceData>(() {
  return AttendanceNotifier();
});
