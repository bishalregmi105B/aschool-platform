/// App-wide constants
class AppConstants {
  AppConstants._();

  static const String appName = 'ASchool';

  /// Resolved at build time via --dart-define=API_BASE_URL=https://...
  /// Release builds: flutter build apk --dart-define=API_BASE_URL=https://api.brighternepal.com
  /// Dev builds fall back to the LAN address.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:5001',
  );
  static const String apiVersion = '/api/v1';

  // Token keys
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userKey = 'cached_user';
  static const String schoolKey = 'cached_school';
  static const String pluginsKey = 'cached_plugins';
  static const String visibilityKey = 'cached_visibility';

  // Socket.IO events
  static const String eventPluginInstalled = 'plugin_installed';
  static const String eventPluginUninstalled = 'plugin_uninstalled';
  static const String eventNewPayment = 'new_payment';
  static const String eventAttendanceAlert = 'attendance_alert';
  static const String eventBusLocation = 'bus_location';
  static const String eventNotice = 'new_notice';
  static const String eventEmergency = 'emergency_alert';

  // Timeouts
  static const Duration apiTimeout = Duration(seconds: 30);
  static const Duration cacheExpiry = Duration(minutes: 30);

  // Nepal phone regex
  static final RegExp nepalPhoneRegex = RegExp(r'^(\+977)?9[78]\d{8}$');

  // Supported roles
  static const List<String> allRoles = [
    'superadmin',
    'school_admin',
    'teacher',
    'staff',
    'student',
    'parent',
    'accountant',
  ];
}
