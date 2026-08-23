import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'api_client.dart';

/// Unified notification service — OneSignal primary, FCM fallback.
///
/// Flow:
/// 1. OneSignal SDK init → registers player ID with backend
/// 2. FCM retained for local notification display
/// 3. After login, tags are set: school_id, role, user_id
class NotificationService {
  final _logger = Logger();
  final _localNotifications = FlutterLocalNotificationsPlugin();
  String? _fcmToken;
  String? _oneSignalPlayerId;

  String? get fcmToken => _fcmToken;
  String? get oneSignalPlayerId => _oneSignalPlayerId;

  /// Initialize all notification channels
  Future<void> init() async {
    await _initLocalNotifications();
    await _initFCM();
    await _initOneSignal();
  }

  /// Initialize local notification display
  Future<void> _initLocalNotifications() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _localNotifications.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: _onNotificationTap,
    );
  }

  /// Initialize FCM for token + foreground message display
  Future<void> _initFCM() async {
    final messaging = FirebaseMessaging.instance;

    // Request permission
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    _logger.i('FCM permission: ${settings.authorizationStatus}');

    // Get token
    _fcmToken = await messaging.getToken();
    _logger.i('FCM token: $_fcmToken');

    // Register FCM token with backend (fallback channel)
    if (_fcmToken != null) {
      _registerFcmToken(_fcmToken!);
    }

    // Listen for token refresh
    messaging.onTokenRefresh.listen(_registerFcmToken);

    // Foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Background/terminated message tap
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);

    // Check if app was opened from notification
    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleMessageTap(initialMessage);
    }
  }

  /// Initialize OneSignal as primary push notification provider.
  ///
  /// OneSignal App ID is injected via --dart-define=ONESIGNAL_APP_ID=...
  Future<void> _initOneSignal() async {
    const appId = String.fromEnvironment('ONESIGNAL_APP_ID', defaultValue: '');
    if (appId.isEmpty) {
      _logger.w('OneSignal App ID not set — skipping OneSignal initialization');
      return;
    }

    try {
      OneSignal.Debug.setLogLevel(OSLogLevel.warn);
      OneSignal.initialize(appId);
      await OneSignal.Notifications.requestPermission(true);

      // Capture player ID once subscription is ready
      final subscription = OneSignal.User.pushSubscription;
      _oneSignalPlayerId = subscription.id;
      _logger
          .i('OneSignal player ID: ${_oneSignalPlayerId?.substring(0, 8)}...');

      // Listen for subscription changes (e.g., token rotation)
      OneSignal.User.pushSubscription.addObserver((state) {
        _oneSignalPlayerId = state.current.id;
        _logger.i('OneSignal player ID updated');
      });
    } catch (e) {
      _logger.e('OneSignal init failed: $e');
    }
  }

  /// Register OneSignal player ID with backend after login.
  /// Call this from AuthService after successful authentication.
  Future<void> registerOneSignalPlayer(String playerId) async {
    _oneSignalPlayerId = playerId;
    try {
      await ApiClient.instance.post('/auth/register-onesignal', data: {
        'player_id': playerId,
      });
      _logger.i('OneSignal player registered: ${playerId.substring(0, 8)}...');
    } catch (e) {
      _logger.w('Failed to register OneSignal player: $e');
    }
  }

  /// Set OneSignal tags for school-scoped push targeting.
  /// Called after login when school context is available.
  Future<void> setOneSignalTags({
    required String schoolId,
    required String role,
    required String userId,
  }) async {
    try {
      OneSignal.User.addTags({
        'school_id': schoolId,
        'role': role,
        'user_id': userId,
      });
      _logger.i('OneSignal tags set: school=$schoolId, role=$role');
    } catch (e) {
      _logger.w('Failed to set OneSignal tags: $e');
    }
  }

  /// Register FCM token with backend (fallback channel)
  Future<void> _registerFcmToken(String token) async {
    try {
      await ApiClient.instance.post('/auth/register-fcm', data: {
        'fcm_token': token,
      });
    } catch (e) {
      _logger.w('Failed to register FCM token: $e');
    }
  }

  /// Show local notification for foreground FCM messages
  void _handleForegroundMessage(RemoteMessage message) {
    _logger.i('Foreground message: ${message.notification?.title}');

    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'aschool_default',
          'ASchool Notifications',
          channelDescription: 'Default notification channel',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: message.data.toString(),
    );
  }

  /// Handle notification tap (from background/terminated)
  void _handleMessageTap(RemoteMessage message) {
    _logger.i('Message tap: ${message.data}');
    // Navigation handled by app-level callback
    _onTapCallback?.call(message.data);
  }

  void _onNotificationTap(NotificationResponse response) {
    _logger.i('Local notification tap: ${response.payload}');
  }

  /// Set callback for deep linking on notification tap
  Function(Map<String, dynamic>)? _onTapCallback;
  void setOnTapCallback(Function(Map<String, dynamic>) callback) {
    _onTapCallback = callback;
  }

  /// Show a local notification manually
  Future<void> showLocal({
    required String title,
    required String body,
    String? payload,
  }) async {
    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'aschool_default',
          'ASchool Notifications',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: payload,
    );
  }
}

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService();
});
