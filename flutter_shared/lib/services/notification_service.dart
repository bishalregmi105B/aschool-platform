import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'api_client.dart';

/// FCM + local notification service
class NotificationService {
  final _logger = Logger();
  final _localNotifications = FlutterLocalNotificationsPlugin();
  String? _fcmToken;

  String? get fcmToken => _fcmToken;

  /// Initialize FCM and local notifications
  Future<void> init() async {
    // Local notifications setup
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

    // FCM setup
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

    // Register token with backend
    if (_fcmToken != null) {
      _registerToken(_fcmToken!);
    }

    // Listen for token refresh
    messaging.onTokenRefresh.listen(_registerToken);

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

  /// Register FCM token with backend
  Future<void> _registerToken(String token) async {
    try {
      await ApiClient.instance.post('/auth/fcm-token', data: {
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
