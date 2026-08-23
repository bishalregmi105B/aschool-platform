/// In-app notification model — maps to backend InAppNotification.
class InAppNotification {
  final String id;
  final String title;
  final String body;
  final String category;
  final String priority;
  final Map<String, dynamic> data;
  final bool isRead;
  final String? readAt;
  final String? actionUrl;
  final String? createdAt;

  const InAppNotification({
    required this.id,
    required this.title,
    required this.body,
    this.category = 'general',
    this.priority = 'normal',
    this.data = const {},
    this.isRead = false,
    this.readAt,
    this.actionUrl,
    this.createdAt,
  });

  factory InAppNotification.fromJson(Map<String, dynamic> json) =>
      InAppNotification(
        id: json['id'] as String,
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        category: json['category'] as String? ?? 'general',
        priority: json['priority'] as String? ?? 'normal',
        data: json['data'] is Map
            ? Map<String, dynamic>.from(json['data'] as Map)
            : const {},
        isRead: json['is_read'] as bool? ?? false,
        readAt: json['read_at'] as String?,
        actionUrl: json['action_url'] as String?,
        createdAt: json['created_at'] as String?,
      );

  InAppNotification copyWith({bool? isRead, String? readAt}) {
    return InAppNotification(
      id: id,
      title: title,
      body: body,
      category: category,
      priority: priority,
      data: data,
      isRead: isRead ?? this.isRead,
      readAt: readAt ?? this.readAt,
      actionUrl: actionUrl,
      createdAt: createdAt,
    );
  }

  /// Category icon mapping for UI display
  String get categoryIcon {
    switch (category) {
      case 'attendance':
        return '📋';
      case 'fee':
        return '💰';
      case 'notice':
        return '📢';
      case 'exam':
        return '📝';
      case 'system':
        return '⚙️';
      case 'gamification':
        return '🏆';
      default:
        return '🔔';
    }
  }

  /// Time ago string for display
  String get timeAgo {
    if (createdAt == null) return '';
    try {
      final dt = DateTime.parse(createdAt!);
      final now = DateTime.now();
      final diff = now.difference(dt);

      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }
}
