import 'package:dio/dio.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../utils/safe_parse.dart';
import 'exceptions.dart';

/// Transport / GPS tracking repository.
///
/// Classic CRUD (routes) + S-A4 trip lifecycle: daily instances, per-student
/// notification prefs, and driver ops (start / position / pickup / dropoff /
/// end). All endpoints live under /transport and are JWT-scoped; drivers
/// authenticate with staff (teacher-role) accounts and the backend filters
/// instance lists to their own runs.
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
      throw _asApiException(e);
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

  // ── S-A4 trip lifecycle ─────────────────────────────────────────────────

  /// Today's (or `dateBs`'s) instances with per-stop state. Parents get the
  /// runs their children ride; staff/driver tokens get their own runs
  /// (role admin sees the school). `status` filters scheduled/running/…
  Future<TransportInstancesPage> getInstancesForDate({
    String? dateBs,
    String? status,
  }) async {
    try {
      final response = await ApiClient.instance.get(
        '/transport/instances',
        queryParameters: {
          if (dateBs != null && dateBs.isNotEmpty) 'date_bs': dateBs,
          if (status != null && status.isNotEmpty) 'status': status,
        },
      );
      if (envelopeOk(response.data)) {
        final data = envelopeObject(response.data, source: 'TransportRepository.getInstancesForDate');
        if (data != null) return TransportInstancesPage.fromJson(data);
      }
      throw ApiException(
          envelopeErrorText(response.data, 'Failed to fetch today\'s trips'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw _asApiException(e);
    }
  }

  /// Full run view: stops + ride register. Parents may only read instances
  /// their children ride (404 otherwise — surfaced as-is).
  Future<TripInstance> getInstance(String instanceId) async {
    try {
      final response = await ApiClient.instance.get('/transport/instances/$instanceId');
      if (envelopeOk(response.data)) {
        final data =
            envelopeObject(response.data, source: 'TransportRepository.getInstance');
        if (data != null) return TripInstance.fromJson(data);
      }
      throw ApiException(
          envelopeErrorText(response.data, 'Trip not found'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw _asApiException(e);
    }
  }

  Future<TransportPrefsBundle> getNotificationPrefs() async {
    try {
      final response = await ApiClient.instance.get('/transport/notification-prefs');
      if (envelopeOk(response.data)) {
        final data = envelopeObject(response.data,
            source: 'TransportRepository.getNotificationPrefs');
        if (data != null) return TransportPrefsBundle.fromJson(data);
      }
      throw ApiException(
          envelopeErrorText(response.data, 'Failed to fetch notification settings'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw _asApiException(e);
    }
  }

  /// Upsert one student's toggles/radii (parents: own children only).
  Future<void> updateNotificationPrefs(TransportNotificationPref pref) async {
    try {
      final response = await ApiClient.instance.put(
        '/transport/notification-prefs',
        data: pref.toRequestJson(),
      );
      if (envelopeOk(response.data)) return;
      throw ApiException(envelopeErrorText(
          response.data, 'Failed to save notification settings'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw _asApiException(e);
    }
  }

  /// Driver starts the run (idempotent server-side while running).
  Future<TripInstance> startInstance(String instanceId) async {
    final data = await _postInstance(instanceId, '/start', 'Could not start the trip');
    return TripInstance.fromJson(data);
  }

  /// Driver-phone GPS fix ingest. The server throttles to one fix per 3 s
  /// (extras answer `{throttled: true}`); clients should throttle too.
  Future<TripInstance> postPosition(
    String instanceId, {
    required double lat,
    required double lng,
    double? speedKmh,
  }) async {
    final data = await _postInstance(
      instanceId,
      '/position',
      'Could not send location',
      body: {
        'lat': lat,
        'lng': lng,
        if (speedKmh != null) 'speed_kmh': speedKmh,
      },
    );
    return TripInstance.fromJson(data);
  }

  /// Board (or mark missed) one student.
  Future<Map<String, dynamic>> pickupStudent(
    String instanceId, {
    required String studentId,
    bool missed = false,
  }) async {
    return _postInstance(
      instanceId,
      '/pickup',
      'Could not mark the student',
      body: {'student_id': studentId, 'missed': missed},
    );
  }

  /// Bulk drop-off at a stop (omit [stopId] to drop everyone onboard).
  Future<Map<String, dynamic>> dropOffAtStop(
    String instanceId, {
    String? stopId,
  }) async {
    return _postInstance(
      instanceId,
      '/dropoff',
      'Could not drop off students',
      body: {if (stopId != null && stopId.isNotEmpty) 'stop_id': stopId},
    );
  }

  /// End the run. The backend refuses with 409 while students are still
  /// onboard; the server's message ("N student(s) are still onboard…")
  /// surfaces through [ApiException].
  Future<TripInstance> endInstance(String instanceId) async {
    final data = await _postInstance(
        instanceId, '/end', 'Could not end the trip');
    return TripInstance.fromJson(data);
  }

  // ── internals ───────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> _postInstance(
    String instanceId,
    String action,
    String fallback, {
    Map<String, dynamic>? body,
  }) async {
    try {
      final response = await ApiClient.instance.post(
        '/transport/instances/$instanceId$action',
        data: body ?? const {},
      );
      if (envelopeOk(response.data)) {
        final data =
            envelopeObject(response.data, source: 'TransportRepository.$action');
        if (data != null) return data;
      }
      throw ApiException(envelopeErrorText(response.data, fallback));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw _asApiException(e);
    }
  }

  /// Flatten Dio errors into [ApiException], keeping the server's own
  /// message. The S-A4 endpoints answer errors as strings (most) or as
  /// objects (`{"message": ..., "onboard": N}` on the end-run 409) — both
  /// shapes are unwrapped here so the UI can quote the server verbatim.
  ApiException _asApiException(Object e) {
    if (e is DioException) {
      final payload = e.response?.data;
      dynamic err;
      if (payload is Map) err = payload['error'] ?? payload['message'];
      if (err is Map) err = err['message'] ?? err['error'];
      final text = err is String && err.isNotEmpty ? err : (e.message ?? e.toString());
      return ApiException(text, statusCode: e.response?.statusCode);
    }
    return ApiException(e.toString());
  }
}
