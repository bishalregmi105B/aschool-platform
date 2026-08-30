import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/in_app_notification.dart';
import '../repositories/notification_repository.dart';

/// State for the notification center.
class NotificationCenterState {
  final List<InAppNotification> notifications;
  final int unreadCount;
  final bool isLoading;
  final String? error;
  final String? activeCategory;

  const NotificationCenterState({
    this.notifications = const [],
    this.unreadCount = 0,
    this.isLoading = false,
    this.error,
    this.activeCategory,
  });

  NotificationCenterState copyWith({
    List<InAppNotification>? notifications,
    int? unreadCount,
    bool? isLoading,
    String? error,
    String? activeCategory,
  }) {
    return NotificationCenterState(
      notifications: notifications ?? this.notifications,
      unreadCount: unreadCount ?? this.unreadCount,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      activeCategory: activeCategory ?? this.activeCategory,
    );
  }
}

/// Notification center state notifier — manages notification list + badge count.
class NotificationCenterNotifier extends StateNotifier<NotificationCenterState> {
  final NotificationRepository _repo;
  Timer? _pollTimer;

  NotificationCenterNotifier(this._repo)
      : super(const NotificationCenterState()) {
    fetchAll();
    // Poll every 60 seconds for new notifications
    _pollTimer = Timer.periodic(
      const Duration(seconds: 60),
      (_) => fetchUnreadCount(),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  /// Fetch all notifications.
  Future<void> fetchAll({String? category}) async {
    state = state.copyWith(isLoading: true, error: null, activeCategory: category);
    try {
      final notifications = await _repo.getNotifications(category: category);
      final unreadCount = await _repo.getUnreadCount();
      state = state.copyWith(
        notifications: notifications,
        unreadCount: unreadCount,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// Fetch only the unread count (lightweight, for badge refresh).
  Future<void> fetchUnreadCount() async {
    try {
      final count = await _repo.getUnreadCount();
      state = state.copyWith(unreadCount: count);
    } catch (e, st) {
      // Badge refresh only — the notification list surfaces real errors.
      debugPrint('NotificationProvider.fetchUnreadCount failed: $e\n$st');
    }
  }

  /// Mark a notification as read.
  Future<void> markRead(String id) async {
    final success = await _repo.markRead(id);
    if (success) {
      state = state.copyWith(
        notifications: state.notifications
            .map((n) => n.id == id ? n.copyWith(isRead: true) : n)
            .toList(),
        unreadCount: (state.unreadCount - 1).clamp(0, 999),
      );
    }
  }

  /// Mark all as read.
  Future<void> markAllRead() async {
    final count = await _repo.markAllRead();
    if (count > 0) {
      state = state.copyWith(
        notifications: state.notifications
            .map((n) => n.copyWith(isRead: true))
            .toList(),
        unreadCount: 0,
      );
    }
  }

  /// Delete a notification.
  Future<void> deleteNotification(String id) async {
    final success = await _repo.deleteNotification(id);
    if (success) {
      final wasUnread = state.notifications.any((n) => n.id == id && !n.isRead);
      state = state.copyWith(
        notifications: state.notifications.where((n) => n.id != id).toList(),
        unreadCount: wasUnread
            ? (state.unreadCount - 1).clamp(0, 999)
            : state.unreadCount,
      );
    }
  }
}

// ── Providers ────────────────────────────────────────────────────────────

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  return NotificationRepository();
});

final notificationCenterProvider =
    StateNotifierProvider<NotificationCenterNotifier, NotificationCenterState>(
        (ref) {
  return NotificationCenterNotifier(ref.read(notificationRepositoryProvider));
});

/// Convenience provider for just the unread badge count.
final unreadNotificationCountProvider = Provider<int>((ref) {
  return ref.watch(notificationCenterProvider).unreadCount;
});
