import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
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
            envelopeErrorText(response.data, 'Failed to resolve student'));
      }

      final rows = envelopeRows(response.data,
          source: 'StudentRepository.getCurrentStudent');
      if (rows.isEmpty) {
        return null;
      }
      return Student.fromJson(rows.first);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<Student> getProfile(String studentId) async {
    try {
      final response = await ApiClient.instance.get('/students/$studentId');
      if (response.data['success'] == true) {
        return Student.fromJson(
            envelopeObject(response.data, source: 'StudentRepository.getProfile') ??
                const {});
      }
      throw ApiException(envelopeErrorText(
          response.data, 'Failed to fetch student profile'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<Map<String, dynamic>> getDashboard() async {
    try {
      final response = await ApiClient.instance.get('/student/dashboard');
      if (response.data['success'] == true) {
        return envelopeObject(response.data, source: 'StudentRepository.getDashboard') ??
            const {};
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch dashboard'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<Student>> getClassmates() async {
    try {
      final response = await ApiClient.instance.get('/student/classmates');
      if (response.data['success'] == true) {
        return envelopeRows(response.data, source: 'StudentRepository.getClassmates')
            .map(Student.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(
          response.data, 'Failed to fetch classmates'));
    } catch (e) {
      if (e is ApiException) rethrow;
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
