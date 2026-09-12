/// Transport Model
import '../utils/safe_parse.dart';

class TransportRoute {
  final String id;
  final String title;
  final String? vehicleId;
  final String? vehicleNumber;
  final String? driverName;
  final String? driverPhone;
  final double? fareAmount;
  final List<TransportStop> stops;

  const TransportRoute({
    required this.id,
    required this.title,
    this.vehicleId,
    this.vehicleNumber,
    this.driverName,
    this.driverPhone,
    this.fareAmount,
    this.stops = const [],
  });

  factory TransportRoute.fromJson(Map<String, dynamic> json) {
    return TransportRoute(
      id: safeString(json['id']),
      title: safeString(json['title']),
      vehicleId: safeStringOrNull(json['vehicle_id']),
      vehicleNumber: safeStringOrNull(json['vehicle_number']),
      driverName: safeStringOrNull(json['driver_name']),
      driverPhone: safeStringOrNull(json['driver_phone']),
      fareAmount: safeDoubleOrNull(json['fare_amount']),
      stops: safeMapList(json['stops'] ?? json['route_stops'])
          .map(TransportStop.fromJson)
          .toList(),
    );
  }
}

class TransportStop {
  final String id;
  final String name;
  final String? pickTime;
  final String? dropTime;
  final double? distance;
  final double? additionalFare;
  final double? latitude;
  final double? longitude;

  const TransportStop({
    required this.id,
    required this.name,
    this.pickTime,
    this.dropTime,
    this.distance,
    this.additionalFare,
    this.latitude,
    this.longitude,
  });

  factory TransportStop.fromJson(Map<String, dynamic> json) {
    return TransportStop(
      id: safeString(json['id']),
      name: safeString(json['name'], fallback: safeString(json['stop_name'])),
      pickTime: safeStringOrNull(json['pick_time']),
      dropTime: safeStringOrNull(json['drop_time']),
      distance: safeDoubleOrNull(json['distance']),
      additionalFare: safeDoubleOrNull(json['additional_fare']),
      latitude: safeDoubleOrNull(json['latitude']),
      longitude: safeDoubleOrNull(json['longitude']),
    );
  }
}

// ── S-A4 trip lifecycle ────────────────────────────────────────────────────
// Daily TripInstances + per-stop planned/actual + ride register, as served
// by /transport/instances and /transport/instances/<id> (see backend
// app/api/v1/transport.py).

/// One day's run of a trip definition: morning/afternoon, scheduled →
/// running → completed (or cancelled), with per-stop and per-student state.
class TripInstance {
  final String id;
  final String tripId;
  final String date;
  final String? dateBs;
  final String direction; // morning | afternoon
  final String? driverId;
  final String? busId;
  final String? bus;
  final String status; // scheduled | running | completed | cancelled
  final DateTime? startedAt;
  final DateTime? endedAt;
  final double? lastLat;
  final double? lastLng;
  final double? lastSpeedKmh;
  final DateTime? lastFixAt;
  final List<InstanceStop> stops;
  final List<TripPassenger> passengers;

  const TripInstance({
    required this.id,
    required this.tripId,
    required this.date,
    required this.direction,
    required this.status,
    this.dateBs,
    this.driverId,
    this.busId,
    this.bus,
    this.startedAt,
    this.endedAt,
    this.lastLat,
    this.lastLng,
    this.lastSpeedKmh,
    this.lastFixAt,
    this.stops = const [],
    this.passengers = const [],
  });

  bool get isRunning => status == 'running';
  bool get isCompleted => status == 'completed';
  bool get isScheduled => status == 'scheduled';

  int get visitedStopCount => stops.where((s) => s.visited).length;
  int get totalStopCount => stops.length;
  int get onboardCount =>
      passengers.where((p) => p.rideStatus == TripPassenger.statusOnboard).length;

  factory TripInstance.fromJson(Map<String, dynamic> json) {
    return TripInstance(
      id: safeString(json['id']),
      tripId: safeString(json['trip_id']),
      date: safeString(json['date']),
      dateBs: safeStringOrNull(json['date_bs']),
      direction: safeString(json['direction'], fallback: 'morning'),
      driverId: safeStringOrNull(json['driver_id']),
      busId: safeStringOrNull(json['bus_id']),
      bus: safeStringOrNull(json['bus']),
      status: safeString(json['status'], fallback: 'scheduled'),
      startedAt: safeDateTime(json['started_at']),
      endedAt: safeDateTime(json['ended_at']),
      lastLat: safeDoubleOrNull(json['last_lat']),
      lastLng: safeDoubleOrNull(json['last_lng']),
      lastSpeedKmh: safeDoubleOrNull(json['last_speed_kmh']),
      lastFixAt: safeDateTime(json['last_fix_at']),
      stops: safeMapList(json['stops']).map(InstanceStop.fromJson).toList()
        ..sort((a, b) => a.seq.compareTo(b.seq)),
      passengers:
          safeMapList(json['passengers']).map(TripPassenger.fromJson).toList(),
    );
  }
}

/// A stop as planned/executed on a specific instance (planned vs actual
/// arrival). Visited = the run has stamped an actual timestamp.
class InstanceStop {
  final String id;
  final String stopId;
  final String? stopName;
  final int seq;
  final double? lat;
  final double? lng;
  final DateTime? plannedTs;
  final DateTime? actualTs;

  const InstanceStop({
    required this.id,
    required this.stopId,
    required this.seq,
    this.stopName,
    this.lat,
    this.lng,
    this.plannedTs,
    this.actualTs,
  });

  bool get visited => actualTs != null;

  factory InstanceStop.fromJson(Map<String, dynamic> json) {
    return InstanceStop(
      id: safeString(json['id']),
      stopId: safeString(json['stop_id']),
      stopName: safeStringOrNull(json['stop_name']),
      seq: safeInt(json['seq']),
      lat: safeDoubleOrNull(json['lat']),
      lng: safeDoubleOrNull(json['lng']),
      plannedTs: safeDateTime(json['planned_ts']),
      actualTs: safeDateTime(json['actual_ts']),
    );
  }
}

/// One student's ride on an instance (ride register row).
class TripPassenger {
  static const int statusWaiting = 0;
  static const int statusOnboard = 1;
  static const int statusMissed = 2;
  static const int statusDropped = 3;

  final String id;
  final String studentId;
  final String? studentName;
  final String? startStopId;
  final String? endStopId;
  final int rideStatus;
  final DateTime? boardedAt;
  final DateTime? droppedAt;

  const TripPassenger({
    required this.id,
    required this.studentId,
    required this.rideStatus,
    this.studentName,
    this.startStopId,
    this.endStopId,
    this.boardedAt,
    this.droppedAt,
  });

  String get rideStatusLabel {
    switch (rideStatus) {
      case statusOnboard:
        return 'Onboard';
      case statusMissed:
        return 'Missed';
      case statusDropped:
        return 'Dropped';
      default:
        return 'Waiting';
    }
  }

  factory TripPassenger.fromJson(Map<String, dynamic> json) {
    return TripPassenger(
      id: safeString(json['id']),
      studentId: safeString(json['student_id']),
      studentName: safeStringOrNull(json['student_name']),
      startStopId: safeStringOrNull(json['start_stop_id']),
      endStopId: safeStringOrNull(json['end_stop_id']),
      rideStatus: safeInt(json['ride_status']),
      boardedAt: safeDateTime(json['boarded_at']),
      droppedAt: safeDateTime(json['dropped_at']),
    );
  }
}

/// Per-student transport notification toggles + geofence radii
/// (/transport/notification-prefs). Missing rows on the backend mean the
/// defaults, so the client mirrors that: a pref row may be synthesized.
class TransportNotificationPref {
  final String studentId;
  final int nearPickupRadiusM;
  final int nearDropoffRadiusM;
  final bool notifyNextStopPickup;
  final bool notifyNearPickup;
  final bool notifyArrivedPickup;
  final bool notifyPickedUp;
  final bool notifyMissedPickup;
  final bool notifyNearDropoff;
  final bool notifyArrivedDropoff;

  const TransportNotificationPref({
    required this.studentId,
    this.nearPickupRadiusM = 150,
    this.nearDropoffRadiusM = 150,
    this.notifyNextStopPickup = true,
    this.notifyNearPickup = true,
    this.notifyArrivedPickup = true,
    this.notifyPickedUp = true,
    this.notifyMissedPickup = true,
    this.notifyNearDropoff = true,
    this.notifyArrivedDropoff = true,
  });

  TransportNotificationPref copyWith({
    String? studentId,
    int? nearPickupRadiusM,
    int? nearDropoffRadiusM,
    bool? notifyNextStopPickup,
    bool? notifyNearPickup,
    bool? notifyArrivedPickup,
    bool? notifyPickedUp,
    bool? notifyMissedPickup,
    bool? notifyNearDropoff,
    bool? notifyArrivedDropoff,
  }) {
    return TransportNotificationPref(
      studentId: studentId ?? this.studentId,
      nearPickupRadiusM: nearPickupRadiusM ?? this.nearPickupRadiusM,
      nearDropoffRadiusM: nearDropoffRadiusM ?? this.nearDropoffRadiusM,
      notifyNextStopPickup:
          notifyNextStopPickup ?? this.notifyNextStopPickup,
      notifyNearPickup: notifyNearPickup ?? this.notifyNearPickup,
      notifyArrivedPickup: notifyArrivedPickup ?? this.notifyArrivedPickup,
      notifyPickedUp: notifyPickedUp ?? this.notifyPickedUp,
      notifyMissedPickup: notifyMissedPickup ?? this.notifyMissedPickup,
      notifyNearDropoff: notifyNearDropoff ?? this.notifyNearDropoff,
      notifyArrivedDropoff:
          notifyArrivedDropoff ?? this.notifyArrivedDropoff,
    );
  }

  /// PUT /transport/notification-prefs body for this student.
  Map<String, dynamic> toRequestJson() => {
        'student_id': studentId,
        'near_pickup_radius_m': nearPickupRadiusM,
        'near_dropoff_radius_m': nearDropoffRadiusM,
        'notify_next_stop_pickup': notifyNextStopPickup,
        'notify_near_pickup': notifyNearPickup,
        'notify_arrived_pickup': notifyArrivedPickup,
        'notify_picked_up': notifyPickedUp,
        'notify_missed_pickup': notifyMissedPickup,
        'notify_near_dropoff': notifyNearDropoff,
        'notify_arrived_dropoff': notifyArrivedDropoff,
      };

  factory TransportNotificationPref.fromJson(
    Map<String, dynamic> json, {
    int defaultPickupRadiusM = 150,
    int defaultDropoffRadiusM = 150,
  }) {
    return TransportNotificationPref(
      studentId: safeString(json['student_id']),
      nearPickupRadiusM:
          safeInt(json['near_pickup_radius_m'], fallback: defaultPickupRadiusM),
      nearDropoffRadiusM: safeInt(json['near_dropoff_radius_m'],
          fallback: defaultDropoffRadiusM),
      notifyNextStopPickup:
          safeBool(json['notify_next_stop_pickup'], fallback: true),
      notifyNearPickup: safeBool(json['notify_near_pickup'], fallback: true),
      notifyArrivedPickup:
          safeBool(json['notify_arrived_pickup'], fallback: true),
      notifyPickedUp: safeBool(json['notify_picked_up'], fallback: true),
      notifyMissedPickup:
          safeBool(json['notify_missed_pickup'], fallback: true),
      notifyNearDropoff: safeBool(json['notify_near_dropoff'], fallback: true),
      notifyArrivedDropoff:
          safeBool(json['notify_arrived_dropoff'], fallback: true),
    );
  }
}

/// Response bundle of GET /transport/notification-prefs.
class TransportPrefsBundle {
  final List<TransportNotificationPref> prefs;
  final int defaultPickupRadiusM;
  final int defaultDropoffRadiusM;

  const TransportPrefsBundle({
    required this.prefs,
    this.defaultPickupRadiusM = 150,
    this.defaultDropoffRadiusM = 150,
  });

  factory TransportPrefsBundle.fromJson(Map<String, dynamic> json) {
    final defaults = safeMap(json['defaults']);
    return TransportPrefsBundle(
      prefs:
          safeMapList(json['prefs']).map(TransportNotificationPref.fromJson).toList(),
      defaultPickupRadiusM: safeInt(
          defaults['near_pickup_radius_m'], fallback: 150),
      defaultDropoffRadiusM: safeInt(
          defaults['near_dropoff_radius_m'], fallback: 150),
    );
  }
}

/// Response bundle of GET /transport/instances?date_bs=….
class TransportInstancesPage {
  final String date;
  final List<TripInstance> instances;

  const TransportInstancesPage({required this.date, required this.instances});

  factory TransportInstancesPage.fromJson(Map<String, dynamic> json) {
    return TransportInstancesPage(
      date: safeString(json['date']),
      instances: safeMapList(json['instances'])
          .map(TripInstance.fromJson)
          .toList()
        ..sort((a, b) {
          // Running first, then scheduled, then finished/cancelled.
          int rank(String s) => switch (s) {
                'running' => 0,
                'scheduled' => 1,
                'completed' => 2,
                _ => 3,
              };
          final byStatus = rank(a.status).compareTo(rank(b.status));
          if (byStatus != 0) return byStatus;
          return a.direction.compareTo(b.direction);
        }),
    );
  }
}
