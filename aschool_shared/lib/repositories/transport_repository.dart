import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class TransportRepository {
  Future<List<TransportRoute>> getRoutes() async {
    try {
      final response = await ApiClient.instance.get('/transport/routes');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => TransportRoute.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch transport routes');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<Map<String, dynamic>> getLiveLocation(String vehicleId) async {
    try {
      final response = await ApiClient.instance.get('/transport/live/$vehicleId');
      if (response.data['success'] == true) {
        return response.data['data'] as Map<String, dynamic>;
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch live location');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
