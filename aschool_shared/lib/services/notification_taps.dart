import 'notification_service.dart';

/// Wire notification taps to navigation (P1 / R7.1).
///
/// All five apps init NotificationService at startup but never register
/// setOnTapCallback — tapping a push opened nothing (mobile audit finding).
/// This helper maps the backend's notification payload to an in-app
/// location string and hands it to the app's navigate callback (typically
/// GoRouter.go, which also works before the shell finishes building).
///
/// Payload convention (backend notifications carry `data`):
///   { "route": "/...",  // explicit deep link when present — wins
///     "type": "notice" | "fee" | "attendance" | "assignment" | ... }
void wireNotificationTaps({
  required void Function(String location) navigate,
  Map<String, String> typeRoutes = const {},
  String? fallbackLocation,
}) {
  NotificationService().setOnTapCallback((data) {
    if (data.isEmpty) return;
    final location = _resolveLocation(data, typeRoutes, fallbackLocation);
    if (location != null) navigate(location);
  });
}

String? _resolveLocation(
  Map<String, dynamic> data,
  Map<String, String> typeRoutes,
  String? fallbackLocation,
) {
  // Explicit deep link wins.
  final explicit = data['route'] ?? data['deep_link'] ?? data['path'];
  if (explicit is String && explicit.startsWith('/')) {
    return explicit;
  }
  final type = (data['type'] ?? data['notification_type'] ?? '').toString();
  if (typeRoutes.containsKey(type)) return typeRoutes[type];
  return fallbackLocation;
}
