import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/notification_provider.dart';

/// Notification bell icon with unread badge count.
///
/// Drop this into any AppBar actions list. It automatically polls
/// for the unread count and displays a red badge.
///
/// ```dart
/// CustomAppBar(
///   title: 'Dashboard',
///   actions: [
///     NotificationBell(onTap: () => Navigator.pushNamed(context, '/notifications')),
///   ],
/// )
/// ```
class NotificationBell extends ConsumerWidget {
  final VoidCallback? onTap;
  final String? tooltip;

  const NotificationBell({super.key, this.onTap, this.tooltip});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadCount = ref.watch(unreadNotificationCountProvider);

    final bell = Material(
      color: Colors.white.withAlpha(42),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: SizedBox(
          width: 36,
          height: 36,
          child: Stack(
            children: [
              const Center(
                child: Icon(
                  Icons.notifications_outlined,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              if (unreadCount > 0)
                Positioned(
                  top: 4,
                  right: 4,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Text(
                      unreadCount > 99 ? '99+' : '$unreadCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );

    if (tooltip == null) return bell;
    return Tooltip(message: tooltip!, child: bell);
  }
}
