import '../services/api_client.dart';
import '../models/in_app_notification.dart';
import 'exceptions.dart';

/// Repository for the in-app notification center API.
class NotificationRepository {
  /// Fetch notifications for current user.
  Future<List<InAppNotification>> getNotifications({
    bool unreadOnly = false,
    String? category,
    int page = 1,
    int perPage = 50,
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'per_page': perPage,
      };
      if (unreadOnly) params['unread_only'] = 'true';
      if (category != null && category.isNotEmpty) params['category'] = category;

      final response = await ApiClient.instance.get(
        '/notifications',
        queryParameters: params,
      );
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => InAppNotification.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch notifications');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  /// Get count of unread notifications (for badge display).
  Future<int> getUnreadCount() async {
    try {
      final response = await ApiClient.instance.get('/notifications/unread-count');
      if (response.data['success'] == true) {
        return response.data['data']['unread_count'] as int? ?? 0;
      }
      return 0;
    } catch (_) {
      return 0;
    }
  }

  /// Mark a single notification as read.
  Future<bool> markRead(String notificationId) async {
    try {
      final response = await ApiClient.instance.post(
        '/notifications/$notificationId/read',
      );
      return response.data['success'] == true;
    } catch (_) {
      return false;
    }
  }

  /// Mark all notifications as read.
  Future<int> markAllRead() async {
    try {
      final response = await ApiClient.instance.post(
        '/notifications/mark-all-read',
      );
      if (response.data['success'] == true) {
        return response.data['data']['marked_read'] as int? ?? 0;
      }
      return 0;
    } catch (_) {
      return 0;
    }
  }

  /// Soft-delete a notification.
  Future<bool> deleteNotification(String notificationId) async {
    try {
      final response = await ApiClient.instance.delete(
        '/notifications/$notificationId',
      );
      return response.data['success'] == true;
    } catch (_) {
      return false;
    }
  }
}
