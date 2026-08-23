import '../services/api_client.dart';
import 'exceptions.dart';

class GalleryRepository {
  Future<List<Map<String, dynamic>>> getGalleries(
      {String? sessionYearId}) async {
    try {
      final response = await ApiClient.instance.get(
        '/files/',
        queryParameters: {
          'type': 'image',
          if (sessionYearId != null && sessionYearId.isNotEmpty)
            'year': sessionYearId,
        },
      );
      if (response.data['success'] == true) {
        return List<Map<String, dynamic>>.from(response.data['data']);
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch galleries');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<Map<String, dynamic>>> getGalleryFiles(String galleryId) async {
    try {
      final response = await ApiClient.instance.get(
        '/files/',
        queryParameters: {
          'type': 'image',
          'folder_id': galleryId,
        },
      );
      if (response.data['success'] == true) {
        return List<Map<String, dynamic>>.from(response.data['data']);
      }
      throw ApiException(
          response.data['error'] ?? 'Failed to fetch gallery files');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
