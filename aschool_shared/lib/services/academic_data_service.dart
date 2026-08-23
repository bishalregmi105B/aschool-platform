import 'package:dio/dio.dart';

import 'api_client.dart';

class AcademicDataService {
  static List<dynamic> _extractList(Response<dynamic> response) {
    final data = response.data;
    if (data is Map<String, dynamic>) {
      final inner = data['data'];
      if (inner is List) {
        return inner;
      }
    }
    return const [];
  }

  static Future<List<Map<String, dynamic>>> fetchClasses() async {
    final response = await ApiClient.instance.get('/academics/classes');
    return _extractList(response)
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  static Future<List<Map<String, dynamic>>> fetchSubjectsForClass(
      String classId) async {
    final response =
        await ApiClient.instance.get('/academics/classes/$classId/subjects');
    return _extractList(response)
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  static Future<List<Map<String, dynamic>>>
      fetchSubjectsForCurrentStudent() async {
    final meResponse = await ApiClient.instance.get('/auth/me');
    final me =
        (meResponse.data['data'] as Map?)?.cast<String, dynamic>() ?? const {};
    final userId = me['id']?.toString();
    if (userId == null || userId.isEmpty) {
      return const [];
    }

    final studentsResponse = await ApiClient.instance.get(
      '/students',
      queryParameters: {
        'user_id': userId,
        'per_page': 1,
      },
    );

    final students = _extractList(studentsResponse)
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    if (students.isEmpty) {
      return const [];
    }

    final classId = students.first['class_id']?.toString();
    if (classId == null || classId.isEmpty) {
      return const [];
    }

    return fetchSubjectsForClass(classId);
  }

  static Future<List<Map<String, dynamic>>>
      fetchChildSubjectsForCurrentParent() async {
    final meResponse = await ApiClient.instance.get('/auth/me');
    final me =
        (meResponse.data['data'] as Map?)?.cast<String, dynamic>() ?? const {};
    final userId = me['id']?.toString();
    if (userId == null || userId.isEmpty) {
      return const [];
    }

    final studentsResponse = await ApiClient.instance.get(
      '/students',
      queryParameters: {
        'guardian_user_id': userId,
        'per_page': 50,
      },
    );

    final students = _extractList(studentsResponse)
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();

    final List<Map<String, dynamic>> bundles = [];
    for (final student in students) {
      final classId = student['class_id']?.toString();
      if (classId == null || classId.isEmpty) {
        continue;
      }
      final subjects = await fetchSubjectsForClass(classId);
      bundles.add({
        'student_name': student['full_name'] ??
            '${student['first_name'] ?? ''} ${student['last_name'] ?? ''}'
                .trim(),
        'class_name': student['class_name'],
        'subjects': subjects,
      });
    }

    return bundles;
  }
}
