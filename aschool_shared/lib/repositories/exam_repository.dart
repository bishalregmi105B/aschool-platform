import 'package:dio/dio.dart';

import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
import 'exceptions.dart';

/// Thrown when the caller's attempt for an online exam is already submitted
/// (409 from /start or /take). Carries the server-reported score so the UI
/// can navigate straight to a friendly "already taken" state.
class OnlineExamAlreadySubmittedException extends ApiException {
  final String? attemptId;
  final double score;

  const OnlineExamAlreadySubmittedException(
    String message, {
    this.attemptId,
    this.score = 0,
  }) : super(message, statusCode: 409);

  factory OnlineExamAlreadySubmittedException.fromPayload(
      dynamic payload) {
    final err = payload is Map ? payload['error'] : null;
    if (err is Map) {
      return OnlineExamAlreadySubmittedException(
        safeStringOrNull(err['message']) ?? 'This exam has already been taken',
        attemptId: safeStringOrNull(err['attempt_id']),
        score: safeDouble(err['score']),
      );
    }
    return OnlineExamAlreadySubmittedException(
      payload is Map && payload['error'] != null
          ? payload['error'].toString()
          : 'This exam has already been taken',
    );
  }
}

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

  // ── S-A2: attempt lifecycle (take / start / autosave / submit) ──────────

  /// GET /exams/online/<id>/take — student-safe exam paper (no answer key)
  /// plus the caller's attempt: server-authoritative remaining time and the
  /// answers saved so far (survive an app kill).
  ///
  /// Throws [OnlineExamAlreadySubmittedException] when the attempt was
  /// already submitted (409 with score).
  Future<OnlineExamTakeData> takeOnlineExam(String examId) async {
    try {
      final response =
          await ApiClient.instance.get('/exams/online/$examId/take');
      final data = envelopeObject(response.data,
          source: 'ExamRepository.takeOnlineExam');
      if (data == null) {
        throw ApiException(
            envelopeErrorText(response.data, 'Failed to load the exam'));
      }
      final attemptJson = safeMapOrNull(data['attempt']);
      return OnlineExamTakeData(
        exam: OnlineExam.fromJson(data),
        attempt: attemptJson == null
            ? null
            : OnlineExamAttemptInfo.fromJson(attemptJson),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        throw OnlineExamAlreadySubmittedException.fromPayload(e.response?.data);
      }
      throw ApiException(_dioErrorText(e, 'Failed to load the exam'),
          statusCode: e.response?.statusCode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  /// POST /exams/online/<id>/start — open (or resume) the attempt before
  /// questions are served. 409 → [OnlineExamAlreadySubmittedException].
  Future<OnlineExamAttemptInfo> startOnlineExam(String examId) async {
    try {
      final response =
          await ApiClient.instance.post('/exams/online/$examId/start');
      final data = envelopeObject(response.data,
          source: 'ExamRepository.startOnlineExam');
      if (data == null) {
        throw ApiException(
            envelopeErrorText(response.data, 'Failed to start the exam'));
      }
      return OnlineExamAttemptInfo.fromJson(data);
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        throw OnlineExamAlreadySubmittedException.fromPayload(e.response?.data);
      }
      throw ApiException(_dioErrorText(e, 'Failed to start the exam'),
          statusCode: e.response?.statusCode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  /// PATCH /exams/online/<id>/attempt — per-question autosave deltas.
  /// Returns the saved count plus the server clock to re-sync the countdown.
  Future<OnlineExamAutosaveResult> autosaveAttempt(
      String examId, Map<String, dynamic> deltas) async {
    try {
      final response = await ApiClient.instance
          .patch('/exams/online/$examId/attempt', data: {'answers': deltas});
      final data = envelopeObject(response.data,
          source: 'ExamRepository.autosaveAttempt');
      if (data == null) {
        throw ApiException(
            envelopeErrorText(response.data, 'Failed to save answers'));
      }
      return OnlineExamAutosaveResult(
        savedQuestionCount: safeInt(data['saved_question_count']),
        remainingSeconds: safeInt(data['remaining_seconds']),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        // Attempt was submitted elsewhere (expiry / away auto-submit) — stop
        // autosaving quietly; the runner will surface the submitted state.
        return const OnlineExamAutosaveResult(
          savedQuestionCount: 0,
          alreadySubmitted: true,
        );
      }
      throw ApiException(_dioErrorText(e, 'Failed to save answers'),
          statusCode: e.response?.statusCode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  /// POST /exams/online/<id>/submit — score and close the attempt.
  /// A 409 (already submitted) is treated as success: the server already has
  /// the answers and reports the score, so the client navigates to the
  /// result either way.
  Future<OnlineExamSubmitResult> submitOnlineExamAttempt(
      String examId, Map<String, dynamic> answers) async {
    try {
      final response = await ApiClient.instance
          .post('/exams/online/$examId/submit', data: {'answers': answers});
      final data = envelopeObject(response.data,
          source: 'ExamRepository.submitOnlineExamAttempt');
      if (data == null) {
        throw ApiException(
            envelopeErrorText(response.data, 'Failed to submit the exam'));
      }
      return OnlineExamSubmitResult(
        score: safeDouble(data['score']),
        totalMarks: safeDouble(data['total_marks']),
        status: safeStringOrNull(data['status']) ?? 'submitted',
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        final err = e.response?.data is Map
            ? (e.response!.data as Map)['error']
            : null;
        return OnlineExamSubmitResult(
          score: err is Map ? safeDouble(err['score']) : 0,
          totalMarks: err is Map ? safeDouble(err['total_marks']) : 0,
          status: 'submitted',
          alreadySubmitted: true,
        );
      }
      throw ApiException(_dioErrorText(e, 'Failed to submit the exam'),
          statusCode: e.response?.statusCode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  String _dioErrorText(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map && data['error'] != null) {
      return data['error'].toString();
    }
    if (data is Map && data['message'] != null) {
      return data['message'].toString();
    }
    return fallback;
  }
}
