import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
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
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'AttendanceRepository.getAttendance')
            .map(AttendanceRecord.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch attendance'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<AttendanceSummary> getSummary(String studentId) async {
    try {
      final response = await ApiClient.instance.get('/attendance/student/$studentId/summary');
      if (envelopeOk(response.data)) {
        return AttendanceSummary.fromJson(
            envelopeObject(response.data, source: 'AttendanceRepository.getSummary') ?? const {});
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch attendance summary'));
    } catch (e) {
      if (e is ApiException) rethrow;
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
      throw ApiException(envelopeErrorText(response.data, 'Failed to submit attendance'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }
}
