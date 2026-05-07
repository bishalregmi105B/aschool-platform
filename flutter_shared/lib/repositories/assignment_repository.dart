import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class AssignmentRepository {
  Future<List<Assignment>> getAssignments(
      {String? classId, String? subjectId}) async {
    try {
      final queryParams = <String, String>{};
      if (classId != null) queryParams['class_id'] = classId;
      if (subjectId != null) queryParams['subject_id'] = subjectId;

      final queryString =
          queryParams.entries.map((e) => '${e.key}=${e.value}').join('&');
      final path =
          '/student/assignments${queryString.isNotEmpty ? '?$queryString' : ''}';

      final response = await ApiClient.instance.get(path);
      if (response.data['success'] == true) {
        final payload = response.data['data'];
        final rows = <Map<String, dynamic>>[];
        if (payload is Map) {
          rows.addAll(((payload['pending'] ?? []) as List).map((item) {
            return {
              ...Map<String, dynamic>.from(item as Map),
              'submission_status': 'pending',
            };
          }));
          rows.addAll(((payload['submitted'] ?? []) as List).map((item) {
            final row = Map<String, dynamic>.from(item as Map);
            return {
              ...row,
              'submission_status':
                  row['marks'] == null ? 'submitted' : 'graded',
              'submission': {
                'id': '${row['id']}-submission',
                'marks_obtained': row['marks'],
                'feedback': row['feedback'],
              },
            };
          }));
        } else {
          rows.addAll((payload as List)
              .map((item) => Map<String, dynamic>.from(item as Map)));
        }
        return rows.map((e) => Assignment.fromJson(e)).toList();
      }
      throw ApiException(
          response.data['error'] ?? 'Failed to fetch assignments');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<bool> submitAssignment(
      String assignmentId, String fileUrl, String remarks) async {
    try {
      final response = await ApiClient.instance
          .post('/student/assignments/$assignmentId/submit', data: {
        'file_url': fileUrl,
        'remarks': remarks,
      });
      return response.data['success'] == true;
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<bool> gradeSubmission(
      String submissionId, int marks, String feedback) async {
    try {
      final response = await ApiClient.instance
          .post('/assignments/submissions/$submissionId/grade', data: {
        'marks_obtained': marks,
        'feedback': feedback,
      });
      return response.data['success'] == true;
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
