import 'package:flutter/foundation.dart';

import '../services/api_client.dart';
import '../models/in_app_notification.dart';
import '../utils/safe_parse.dart';
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
        return envelopeRows(response.data, source: 'NotificationRepository.getNotifications')
            .map(InAppNotification.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch notifications'));
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
        final data = response.data['data'];
        return safeInt(data is Map ? data['unread_count'] : null);
      }
      return 0;
    } catch (e, st) {
      debugPrint('NotificationRepository.getUnreadCount failed: $e\n$st');
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
    } catch (e, st) {
      debugPrint('NotificationRepository.markRead($notificationId) failed: $e\n$st');
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
        final data = response.data['data'];
        return safeInt(data is Map ? data['marked_read'] : null);
      }
      return 0;
    } catch (e, st) {
      debugPrint('NotificationRepository.markAllRead failed: $e\n$st');
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
    } catch (e, st) {
      debugPrint(
          'NotificationRepository.deleteNotification($notificationId) failed: $e\n$st');
      return false;
    }
  }
}
