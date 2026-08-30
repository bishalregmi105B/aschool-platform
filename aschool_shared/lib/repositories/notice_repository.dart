import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
import 'exceptions.dart';

class NoticeRepository {
  Future<List<Notice>> getNotices() async {
    try {
      final response = await ApiClient.instance.get('/notices');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'NoticeRepository.getNotices')
            .map(Notice.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch notices'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<Announcement>> getAnnouncements(String classId, String sectionId) async {
    try {
      final response = await ApiClient.instance.get('/announcements?class_id=$classId&section_id=$sectionId');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'NoticeRepository.getAnnouncements')
            .map(Announcement.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch announcements'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<SliderBanner>> getBanners() async {
    try {
      final response = await ApiClient.instance.get('/sliders');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'NoticeRepository.getBanners')
            .map(SliderBanner.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch banners'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }
}
