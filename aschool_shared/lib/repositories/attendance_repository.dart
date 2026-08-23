import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class AttendanceRepository {
  Future<List<AttendanceRecord>> getAttendance(String studentId, {String? month, String? year}) async {
    try {
      final queryParams = <String, String>{};
      if (month != null) queryParams['month'] = month;
      if (year != null) queryParams['year'] = year;
      
      final queryString = queryParams.entries.map((e) => '${e.key}=${e.value}').join('&');
      final path = '/attendance/student/$studentId${queryString.isNotEmpty ? '?$queryString' : ''}';
      
      final response = await ApiClient.instance.get(path);
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => AttendanceRecord.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch attendance');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<AttendanceSummary> getSummary(String studentId) async {
    try {
      final response = await ApiClient.instance.get('/attendance/student/$studentId/summary');
      if (response.data['success'] == true) {
        return AttendanceSummary.fromJson(response.data['data']);
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch attendance summary');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<bool> submitAttendance(String classId, String sectionId, String date, List<Map<String, dynamic>> records) async {
    try {
      final response = await ApiClient.instance.post('/attendance/submit', data: {
        'class_id': classId,
        'section_id': sectionId,
        'date': date,
        'records': records,
      });
      if (response.data['success'] == true) {
        return true;
      }
      throw ApiException(response.data['error'] ?? 'Failed to submit attendance');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
