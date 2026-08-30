import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
import 'exceptions.dart';

class ExamRepository {
  List<ExamResult> _parseResultPayload(dynamic responseData) {
    if (responseData is! Map) {
      return const [];
    }
    final payload = responseData['data'];
    final results = payload is Map ? payload['exams'] : payload;
    return safeMapList(results)
        .map(ExamResult.fromJson)
        .toList();
  }

  Future<List<Exam>> getExams() async {
    try {
      final response = await ApiClient.instance.get('/exams');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'ExamRepository.getExams')
            .map(Exam.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch exams'));
    } catch (e) {
      if (e is ApiException) rethrow;
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
        throw ApiException(envelopeErrorText(response.data, 'Failed to fetch exam results'));
      } catch (fallbackError) {
        if (fallbackError is ApiException) rethrow;
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
      if (envelopeOk(response.data)) {
        return envelopeObject(response.data, source: 'ExamRepository.getMarksheet') ??
            const {};
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch marksheet'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<OnlineExam>> getOnlineExams() async {
    try {
      final response = await ApiClient.instance.get('/exams/online');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'ExamRepository.getOnlineExams')
            .map(OnlineExam.fromJson)
            .toList();
      }
      throw ApiException(
          envelopeErrorText(response.data, 'Failed to fetch online exams'));
    } catch (e) {
      if (e is ApiException) rethrow;
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
