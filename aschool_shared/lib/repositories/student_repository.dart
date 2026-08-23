import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class StudentRepository {
  Future<Student?> getCurrentStudent({String? userId}) async {
    try {
      final resolvedUserId = userId?.trim().isNotEmpty == true
          ? userId!.trim()
          : await _resolveCurrentUserId();
      if (resolvedUserId == null || resolvedUserId.isEmpty) {
        return null;
      }

      final response = await ApiClient.instance.get(
        '/students',
        queryParameters: {
          'user_id': resolvedUserId,
          'per_page': 1,
        },
      );

      if (response.data['success'] != true) {
        throw ApiException(
            response.data['error'] ?? 'Failed to resolve student');
      }

      final list = response.data['data'] as List?;
      if (list == null || list.isEmpty) {
        return null;
      }

      final first = list.first;
      if (first is! Map) return null;
      return Student.fromJson(Map<String, dynamic>.from(first));
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<Student> getProfile(String studentId) async {
    try {
      final response = await ApiClient.instance.get('/students/$studentId');
      if (response.data['success'] == true) {
        return Student.fromJson(response.data['data']);
      }
      throw ApiException(
          response.data['error'] ?? 'Failed to fetch student profile');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<Map<String, dynamic>> getDashboard() async {
    try {
      final response = await ApiClient.instance.get('/student/dashboard');
      if (response.data['success'] == true) {
        return response.data['data'] as Map<String, dynamic>;
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch dashboard');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<Student>> getClassmates() async {
    try {
      final response = await ApiClient.instance.get('/student/classmates');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => Student.fromJson(e))
            .toList();
      }
      throw ApiException(
          response.data['error'] ?? 'Failed to fetch classmates');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<String?> _resolveCurrentUserId() async {
    final response = await ApiClient.instance.get('/auth/me');
    if (response.data['success'] != true) return null;
    final data = response.data['data'];
    if (data is! Map) return null;
    final id = data['id']?.toString().trim();
    if (id == null || id.isEmpty) return null;
    return id;
  }
}
