import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/student.dart';
import '../services/auth_service.dart';
import 'repository_providers.dart';

final currentStudentProvider =
    FutureProvider.autoDispose<Student?>((ref) async {
  final user = ref.watch(authProvider).user;
  if (user == null) {
    return null;
  }

  final repo = ref.read(studentRepositoryProvider);
  return repo.getCurrentStudent(userId: user.id);
});

final currentStudentIdProvider = Provider.autoDispose<String?>((ref) {
  final student = ref.watch(currentStudentProvider).value;
  return student?.id;
});
