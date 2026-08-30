import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
import 'exceptions.dart';

class TransportRepository {
  Future<List<TransportRoute>> getRoutes() async {
    try {
      final response = await ApiClient.instance.get('/transport/routes');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'TransportRepository.getRoutes')
            .map(TransportRoute.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch transport routes'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<Map<String, dynamic>> getLiveLocation(String vehicleId) async {
    try {
      final response = await ApiClient.instance.get('/transport/live/$vehicleId');
      if (envelopeOk(response.data)) {
        return envelopeObject(response.data, source: 'TransportRepository.getLiveLocation')
                ??
            const {};
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch live location'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }
}
