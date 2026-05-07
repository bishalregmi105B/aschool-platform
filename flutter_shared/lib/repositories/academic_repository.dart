import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class AcademicRepository {
  Future<List<AcademicYear>> getYears() async {
    try {
      final response = await ApiClient.instance.get('/academics/years');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => AcademicYear.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch academic years');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<ClassModel>> getClasses() async {
    try {
      final response = await ApiClient.instance.get('/academics/classes');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => ClassModel.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch classes');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<Subject>> getSubjects({String? classId}) async {
    try {
      final path = classId != null ? '/academics/subjects?class_id=$classId' : '/academics/subjects';
      final response = await ApiClient.instance.get(path);
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => Subject.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch subjects');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
