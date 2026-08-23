import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import '../utils/constants.dart';
import 'api_client.dart';
import 'notification_service.dart';

/// Auth state: holds current user + tokens
class AuthState {
  final User? user;
  final bool isLoading;
  final String? error;

  const AuthState({this.user, this.isLoading = false, this.error});

  bool get isAuthenticated => user != null;

  AuthState copyWith({User? user, bool? isLoading, String? error}) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Auth service provider
class AuthNotifier extends StateNotifier<AuthState> {
  static const _storage = FlutterSecureStorage();

  AuthNotifier() : super(const AuthState()) {
    _tryRestoreSession();
  }

  /// Try to restore session from secure storage on app start
  Future<void> _tryRestoreSession() async {
    state = state.copyWith(isLoading: true);
    try {
      final token = await _storage.read(key: AppConstants.accessTokenKey);
      if (token == null) {
        state = const AuthState();
        return;
      }

      // Fetch current user profile
      final response = await ApiClient.instance.get('/auth/me');
      if (response.statusCode == 200) {
        final user = User.fromJson(response.data['data']);
        ApiClient.setSchoolSlug(user.schoolSlug ?? '');
        state = AuthState(user: user);
      } else {
        await _storage.deleteAll();
        state = const AuthState();
      }
    } catch (_) {
      state = const AuthState();
    }
  }

  /// Login with phone OTP
  Future<bool> loginWithOtp(String phone, String otp) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await ApiClient.instance.post('/auth/verify-otp', data: {
        'phone': phone,
        'otp': otp,
      });

      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = response.data['data'];
        await _storage.write(
            key: AppConstants.accessTokenKey, value: data['access_token']);
        await _storage.write(
            key: AppConstants.refreshTokenKey, value: data['refresh_token']);

        final user = User.fromJson(data['user']);
        ApiClient.setSchoolSlug(user.schoolSlug ?? '');
        state = AuthState(user: user);

        // Register OneSignal player for push notifications
        _registerPushNotifications(user);

        return true;
      } else {
        state = state.copyWith(
            isLoading: false, error: response.data['error'] ?? 'Login failed');
        return false;
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  /// Login with email or phone + password
  Future<bool> loginWithEmailOrPhone(String emailOrPhone, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final isEmail = emailOrPhone.contains('@');
      final response = await ApiClient.instance.post('/auth/login', data: {
        'email': isEmail ? emailOrPhone : null,
        'phone': isEmail ? null : emailOrPhone,
        'password': password,
      });

      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = response.data['data'];
        await _storage.write(
            key: AppConstants.accessTokenKey, value: data['access_token']);
        await _storage.write(
            key: AppConstants.refreshTokenKey, value: data['refresh_token']);

        final user = User.fromJson(data['user']);
        ApiClient.setSchoolSlug(user.schoolSlug ?? '');
        state = AuthState(user: user);

        // Register OneSignal player for push notifications
        _registerPushNotifications(user);

        return true;
      } else {
        state = state.copyWith(
            isLoading: false, error: response.data['error'] ?? 'Login failed');
        return false;
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  /// Login with student ID
  Future<bool> loginWithStudentId(String studentId, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await ApiClient.instance.post('/auth/student-login', data: {
        'student_id': studentId,
        'password': password,
      });

      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = response.data['data'];
        await _storage.write(
            key: AppConstants.accessTokenKey, value: data['access_token']);
        await _storage.write(
            key: AppConstants.refreshTokenKey, value: data['refresh_token']);

        final user = User.fromJson(data['user']);
        ApiClient.setSchoolSlug(user.schoolSlug ?? '');
        state = AuthState(user: user);

        // Register OneSignal player for push notifications
        _registerPushNotifications(user);

        return true;
      } else {
        state = state.copyWith(
            isLoading: false, error: response.data['error'] ?? 'Login failed');
        return false;
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  /// Request OTP
  Future<bool> requestOtp(String phone) async {
    try {
      final response = await ApiClient.instance.post('/auth/send-otp', data: {
        'phone': phone,
      });
      return response.statusCode == 200 && response.data['success'] == true;
    } catch (_) {
      return false;
    }
  }

  /// Logout
  Future<void> logout() async {
    await _storage.deleteAll();
    state = const AuthState();
  }

  /// Register push notification player ID after login
  Future<void> _registerPushNotifications(User user) async {
    try {
      final notifService = NotificationService();
      // Prefer OneSignal player ID; fall back to FCM token
      final playerId = notifService.oneSignalPlayerId ?? notifService.fcmToken;
      if (playerId != null) {
        await notifService.registerOneSignalPlayer(playerId);
        await notifService.setOneSignalTags(
          schoolId: user.schoolId ?? '',
          role: user.role,
          userId: user.id,
        );
      }
    } catch (_) {
      // Non-fatal — push registration can retry later
    }
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
