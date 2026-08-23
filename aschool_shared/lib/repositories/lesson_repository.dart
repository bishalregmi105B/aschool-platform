import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class LessonRepository {
  Future<List<Lesson>> getLessons(String subjectId, String classId, String sectionId) async {
    try {
      final response = await ApiClient.instance.get('/lms/lessons?subject_id=$subjectId&class_id=$classId&section_id=$sectionId');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => Lesson.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch lessons');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<Topic>> getTopics(String lessonId) async {
    try {
      final response = await ApiClient.instance.get('/lms/topics?lesson_id=$lessonId');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => Topic.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch topics');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<StudyMaterial>> getStudyMaterials(String topicId) async {
    try {
      final response = await ApiClient.instance.get('/lms/materials?topic_id=$topicId');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => StudyMaterial.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch study materials');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
