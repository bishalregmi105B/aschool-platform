import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class TimetableRepository {
  List<TimetableSlot> _extractSlots(dynamic payload) {
    final data = payload is Map ? payload['data'] : null;
    final list = data is Map ? data['periods'] : data;
    final rows = list is List ? list : const [];
    return rows
        .whereType<Map>()
        .map((e) => TimetableSlot.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<TimetableSlot>> getStudentTimetable({int? dayIndex}) async {
    try {
      final response = await ApiClient.instance.get(
        '/student/timetable',
        queryParameters: {
          if (dayIndex != null) 'day': dayIndex,
        },
      );
      if (response.data['success'] == true) {
        return _extractSlots(response.data);
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch timetable');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<TimetableSlot>> getTimetable(
      String classId, String sectionId) async {
    try {
      final response = await ApiClient.instance
          .get('/timetable?class_id=$classId&section_id=$sectionId');
      if (response.data['success'] == true) {
        return _extractSlots(response.data);
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch timetable');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<TimetableSlot>> getTeacherTimetable(String teacherId) async {
    try {
      final response =
          await ApiClient.instance.get('/timetable/teacher/$teacherId');
      if (response.data['success'] == true) {
        return _extractSlots(response.data);
      }
      throw ApiException(
          response.data['error'] ?? 'Failed to fetch teacher timetable');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
