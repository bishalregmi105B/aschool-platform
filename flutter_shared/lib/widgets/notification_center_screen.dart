import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/in_app_notification.dart';
import '../providers/notification_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_app_bar.dart';
import '../widgets/shimmer_loading_list.dart';
import '../widgets/no_data_container.dart';

/// Full notification center screen.
///
/// Shows all in-app notifications with category filtering,
/// mark-all-read, swipe-to-delete, and pull-to-refresh.
class NotificationCenterScreen extends ConsumerStatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  ConsumerState<NotificationCenterScreen> createState() =>
      _NotificationCenterScreenState();
}

class _NotificationCenterScreenState
    extends ConsumerState<NotificationCenterScreen> {
  String? _activeCategory;

  static const _categories = [
    null,        // All
    'attendance',
    'fee',
    'notice',
    'exam',
    'system',
    'gamification',
  ];

  static const _categoryLabels = {
    null: 'All',
    'attendance': 'Attendance',
    'fee': 'Fees',
    'notice': 'Notices',
    'exam': 'Exams',
    'system': 'System',
    'gamification': 'Rewards',
  };

  @override
  void initState() {
    super.initState();
    // Initial fetch
    Future.microtask(() {
      ref.read(notificationCenterProvider.notifier).fetchAll();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationCenterProvider);

    return Scaffold(
      appBar: CustomAppBar(
        title: 'Notifications',
        actions: [
          if (state.unreadCount > 0)
            IconButton(
              icon: const Icon(Icons.done_all_rounded, color: Colors.white),
              tooltip: 'Mark all read',
              onPressed: () {
                ref.read(notificationCenterProvider.notifier).markAllRead();
              },
            ),
        ],
      ),
      body: Column(
        children: [
          // Category filter chips
          Container(
            color: Theme.of(context).cardColor,
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: _categories.map((cat) {
                  final isActive = _activeCategory == cat;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(_categoryLabels[cat] ?? 'All'),
                      selected: isActive,
                      selectedColor: ASchoolTheme.primary.withAlpha(40),
                      onSelected: (_) {
                        setState(() => _activeCategory = cat);
                        ref
                            .read(notificationCenterProvider.notifier)
                            .fetchAll(category: cat);
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // Notification list
          Expanded(
            child: state.isLoading
                ? const ShimmerLoadingList()
                : state.notifications.isEmpty
                    ? const NoDataContainer(
                        icon: Icons.notifications_off_outlined,
                        message: 'No notifications yet',
                      )
                    : RefreshIndicator(
                        onRefresh: () => ref
                            .read(notificationCenterProvider.notifier)
                            .fetchAll(category: _activeCategory),
                        child: ListView.separated(
                          itemCount: state.notifications.length,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final notification = state.notifications[index];
                            return _NotificationTile(
                              notification: notification,
                              onTap: () {
                                if (!notification.isRead) {
                                  ref
                                      .read(
                                          notificationCenterProvider.notifier)
                                      .markRead(notification.id);
                                }
                                // Handle deep link if available
                                if (notification.actionUrl != null) {
                                  // Navigate to action URL
                                }
                              },
                              onDismiss: () {
                                ref
                                    .read(notificationCenterProvider.notifier)
                                    .deleteNotification(notification.id);
                              },
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final InAppNotification notification;
  final VoidCallback? onTap;
  final VoidCallback? onDismiss;

  const _NotificationTile({
    required this.notification,
    this.onTap,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key(notification.id),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onDismiss?.call(),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.red,
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      child: InkWell(
        onTap: onTap,
        child: Container(
          color: notification.isRead
              ? null
              : ASchoolTheme.primary.withAlpha(8),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Category icon
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _categoryColor(notification.category).withAlpha(30),
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Text(
                  notification.categoryIcon,
                  style: const TextStyle(fontSize: 20),
                ),
              ),
              const SizedBox(width: 12),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: TextStyle(
                              fontWeight: notification.isRead
                                  ? FontWeight.normal
                                  : FontWeight.w600,
                              fontSize: 14,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          notification.timeAgo,
                          style: TextStyle(
                            fontSize: 11,
                            color: Theme.of(context).textTheme.bodySmall?.color,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      notification.body,
                      style: TextStyle(
                        fontSize: 13,
                        color: Theme.of(context).textTheme.bodySmall?.color,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              // Unread dot
              if (!notification.isRead) ...[
                const SizedBox(width: 8),
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 4),
                  decoration: const BoxDecoration(
                    color: ASchoolTheme.primary,
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _categoryColor(String category) {
    switch (category) {
      case 'attendance':
        return Colors.blue;
      case 'fee':
        return Colors.green;
      case 'notice':
        return Colors.orange;
      case 'exam':
        return Colors.purple;
      case 'system':
        return Colors.grey;
      case 'gamification':
        return Colors.amber;
      default:
        return Colors.teal;
    }
  }
}
