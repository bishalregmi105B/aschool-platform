import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
import 'exceptions.dart';

class LessonRepository {
  Future<List<Lesson>> getLessons(String subjectId, String classId, String sectionId) async {
    try {
      final response = await ApiClient.instance.get('/lms/lessons?subject_id=$subjectId&class_id=$classId&section_id=$sectionId');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'LessonRepository.getLessons')
            .map(Lesson.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch lessons'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<Topic>> getTopics(String lessonId) async {
    try {
      final response = await ApiClient.instance.get('/lms/topics?lesson_id=$lessonId');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'LessonRepository.getTopics')
            .map(Topic.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch topics'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<StudyMaterial>> getStudyMaterials(String topicId) async {
    try {
      final response = await ApiClient.instance.get('/lms/materials?topic_id=$topicId');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'LessonRepository.getStudyMaterials')
            .map(StudyMaterial.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch study materials'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }
}
