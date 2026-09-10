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
    // FC-MOB: /transport/live/<id> never existed in the backend. The real
    // live-position feed is parent-scoped: GET /parent/bus-location/<bus_id>
    // (see flutter_parent bus_tracking_screen). Until a role-agnostic GPS
    // endpoint ships, this method fails honestly instead of silently 404ing.
    throw ApiException(
      'Live bus location is not available here — use GET /parent/bus-location/<bus_id>',
    );
  }
}
