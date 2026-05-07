import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class ExamRepository {
  List<ExamResult> _parseResultPayload(dynamic responseData) {
    if (responseData is! Map<String, dynamic>) {
      return const [];
    }
    final payload = responseData['data'];
    final results = payload is Map ? payload['exams'] : payload;
    final rows = (results ?? []) as List;
    return rows
        .whereType<Map>()
        .map((e) => ExamResult.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<Exam>> getExams() async {
    try {
      final response = await ApiClient.instance.get('/exams');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => Exam.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch exams');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<ExamResult>> getResults({String? studentId}) async {
    try {
      final rich = await ApiClient.instance.get(
        '/exams/results',
        queryParameters: {
          if (studentId != null && studentId.isNotEmpty)
            'student_id': studentId,
        },
      );
      if (rich.data['success'] == true) {
        return _parseResultPayload(rich.data);
      }
    } catch (e) {
      if (studentId != null && studentId.isNotEmpty) {
        throw ApiException(e.toString());
      }
      // Fall back to student compatibility route when exams plugin route is unavailable.
      try {
        final response = await ApiClient.instance.get('/student/results');
        if (response.data['success'] == true) {
          return _parseResultPayload(response.data);
        }
        throw ApiException(
            response.data['error'] ?? 'Failed to fetch exam results');
      } catch (fallbackError) {
        throw ApiException(fallbackError.toString());
      }
    }

    return const [];
  }

  Future<Map<String, dynamic>> getMarksheet(
      String examId, String studentId) async {
    try {
      final response =
          await ApiClient.instance.get('/exams/$examId/marksheet/$studentId');
      if (response.data['success'] == true) {
        final payload = response.data['data'];
        if (payload is Map<String, dynamic>) {
          return payload;
        }
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch marksheet');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<OnlineExam>> getOnlineExams() async {
    try {
      final response = await ApiClient.instance.get('/exams/online');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => OnlineExam.fromJson(e))
            .toList();
      }
      throw ApiException(
          response.data['error'] ?? 'Failed to fetch online exams');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<bool> submitOnlineExam(
      String examId, Map<String, dynamic> answers) async {
    try {
      final response =
          await ApiClient.instance.post('/exams/online/$examId/submit', data: {
        'answers': answers,
      });
      return response.data['success'] == true;
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
