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
