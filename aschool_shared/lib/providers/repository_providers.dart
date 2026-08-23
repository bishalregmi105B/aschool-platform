import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/repositories.dart';

final academicRepositoryProvider = Provider<AcademicRepository>((ref) {
  return AcademicRepository();
});

final studentRepositoryProvider = Provider<StudentRepository>((ref) {
  return StudentRepository();
});

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  return AttendanceRepository();
});

final assignmentRepositoryProvider = Provider<AssignmentRepository>((ref) {
  return AssignmentRepository();
});

final examRepositoryProvider = Provider<ExamRepository>((ref) {
  return ExamRepository();
});

final feeRepositoryProvider = Provider<FeeRepository>((ref) {
  return FeeRepository();
});

final timetableRepositoryProvider = Provider<TimetableRepository>((ref) {
  return TimetableRepository();
});

final lessonRepositoryProvider = Provider<LessonRepository>((ref) {
  return LessonRepository();
});

final noticeRepositoryProvider = Provider<NoticeRepository>((ref) {
  return NoticeRepository();
});

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  return ChatRepository();
});

final transportRepositoryProvider = Provider<TransportRepository>((ref) {
  return TransportRepository();
});

final hrRepositoryProvider = Provider<HrRepository>((ref) {
  return HrRepository();
});

final galleryRepositoryProvider = Provider<GalleryRepository>((ref) {
  return GalleryRepository();
});
