import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class NoticeRepository {
  Future<List<Notice>> getNotices() async {
    try {
      final response = await ApiClient.instance.get('/notices');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => Notice.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch notices');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<Announcement>> getAnnouncements(String classId, String sectionId) async {
    try {
      final response = await ApiClient.instance.get('/announcements?class_id=$classId&section_id=$sectionId');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => Announcement.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch announcements');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<SliderBanner>> getBanners() async {
    try {
      final response = await ApiClient.instance.get('/sliders');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => SliderBanner.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch banners');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
