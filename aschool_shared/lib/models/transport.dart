/// Transport Model

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
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      vehicleId: json['vehicle_id']?.toString(),
      vehicleNumber: json['vehicle_number'] as String?,
      driverName: json['driver_name'] as String?,
      driverPhone: json['driver_phone'] as String?,
      fareAmount: (json['fare_amount'] as num?)?.toDouble(),
      stops: ((json['stops'] ?? json['route_stops'] ?? []) as List)
          .map((s) => TransportStop.fromJson(Map<String, dynamic>.from(s)))
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
      id: (json['id'] ?? '').toString(),
      name: json['name'] as String? ?? json['stop_name'] as String? ?? '',
      pickTime: json['pick_time'] as String?,
      dropTime: json['drop_time'] as String?,
      distance: (json['distance'] as num?)?.toDouble(),
      additionalFare: (json['additional_fare'] as num?)?.toDouble(),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
    );
  }
}
