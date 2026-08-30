import 'package:dio/dio.dart';

import '../services/api_client.dart';
import 'exceptions.dart';

/// AI Tools Suite repository — mirrors the backend `/ai-tools/*` routes
/// (`backend/app/api/v1/ai_tools.py`, prefix `/ai-tools`). There is no
/// generic `/ai/{tool}/generate` endpoint; each tool has its own path and
/// structured request fields.
class AiRepository {
  /// POST /ai-tools/question-paper (roles: superadmin, school_admin, teacher)
  /// Required: subject, grade, total_marks, duration_minutes.
  /// Returns the generated paper: {subject, grade, total_marks, duration,
  /// instructions, sections: [{name, marks, instructions, questions: [...]}],
  /// bloom_distribution, marks_distribution}.
  Future<Map<String, dynamic>> generateQuestionPaper({
    required String subject,
    required String grade,
    required num totalMarks,
    required num durationMinutes,
    String? topics,
    String difficulty = 'medium',
    bool includeAnswerKey = true,
    String language = 'english',
  }) async {
    return _post('/ai-tools/question-paper', {
      'subject': subject,
      'grade': grade,
      'total_marks': totalMarks,
      'duration_minutes': durationMinutes,
      if (topics != null && topics.isNotEmpty) 'topics': topics,
      'difficulty': difficulty,
      'include_answer_key': includeAnswerKey,
      'language': language,
    });
  }

  /// POST /ai-tools/lesson-plan (roles: superadmin, school_admin, teacher)
  /// Required: subject, grade, topic.
  Future<Map<String, dynamic>> generateLessonPlan({
    required String subject,
    required String grade,
    required String topic,
    num durationMinutes = 45,
    String? learningObjectives,
    String teachingMethod = 'interactive',
    String language = 'english',
  }) async {
    return _post('/ai-tools/lesson-plan', {
      'subject': subject,
      'grade': grade,
      'topic': topic,
      'duration_minutes': durationMinutes,
      if (learningObjectives != null && learningObjectives.isNotEmpty)
        'learning_objectives': learningObjectives,
      'teaching_method': teachingMethod,
      'language': language,
    });
  }

  /// POST /ai-tools/remarks (roles: superadmin, school_admin, teacher)
  /// Required: student_name, marks, total, percentage. Returns {remark: ...}.
  Future<String> generateRemark({
    required String studentName,
    required num marks,
    required num total,
    required num percentage,
  }) async {
    final data = await _post('/ai-tools/remarks', {
      'student_name': studentName,
      'marks': marks,
      'total': total,
      'percentage': percentage,
    });
    return data['remark']?.toString() ?? '';
  }

  /// POST /ai-tools/timetable (roles: superadmin, school_admin)
  /// Required: academic_year_id. Returns {school_id, days, periods_per_day,
  /// period_duration, start_time, classes: [...], conflicts: [...]}.
  Future<Map<String, dynamic>> generateTimetable({
    required String academicYearId,
    num periodsPerDay = 8,
    num periodDuration = 45,
    String startTime = '10:00',
  }) async {
    return _post('/ai-tools/timetable', {
      'academic_year_id': academicYearId,
      'periods_per_day': periodsPerDay,
      'period_duration': periodDuration,
      'start_time': startTime,
    });
  }

  /// GET /ai-tools/insights/weekly (roles: superadmin, school_admin)
  /// Returns {summary, highlights, concerns, recommendations, risk_level,
  /// metrics: {...}, generated_at}.
  Future<Map<String, dynamic>> weeklyInsights() async {
    try {
      final response = await ApiClient.instance.get('/ai-tools/insights/weekly');
      return _unwrap(response.data, 'Failed to generate insights');
    } on DioException catch (e) {
      throw _fromDio(e, 'Failed to generate insights');
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> _post(
      String path, Map<String, dynamic> body) async {
    try {
      final response = await ApiClient.instance.post(path, data: body);
      return _unwrap(response.data, 'AI request failed');
    } on DioException catch (e) {
      throw _fromDio(e, 'AI request failed');
    }
  }

  /// Validate the {success, data, error} envelope and return `data`.
  Map<String, dynamic> _unwrap(dynamic payload, String fallback) {
    if (payload is Map && payload['success'] == true) {
      final data = payload['data'];
      if (data is Map) return Map<String, dynamic>.from(data);
      throw ApiException(fallback);
    }
    throw ApiException(
      payload is Map && payload['error'] != null
          ? payload['error'].toString()
          : fallback,
    );
  }

  ApiException _fromDio(DioException e, String fallback) {
    final data = e.response?.data;
    final message = (data is Map && data['error'] != null)
        ? data['error'].toString()
        : fallback;
    return ApiException(message, statusCode: e.response?.statusCode);
  }
}
