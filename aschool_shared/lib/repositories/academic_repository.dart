import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
import 'exceptions.dart';

class AcademicRepository {
  Future<List<AcademicYear>> getYears() async {
    try {
      final response = await ApiClient.instance.get('/academics/years');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'AcademicRepository.getYears')
            .map(AcademicYear.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch academic years'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<ClassModel>> getClasses() async {
    try {
      final response = await ApiClient.instance.get('/academics/classes');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'AcademicRepository.getClasses')
            .map(ClassModel.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch classes'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<Subject>> getSubjects({String? classId}) async {
    try {
      final path = classId != null ? '/academics/subjects?class_id=$classId' : '/academics/subjects';
      final response = await ApiClient.instance.get(path);
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'AcademicRepository.getSubjects')
            .map(Subject.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch subjects'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }
}
