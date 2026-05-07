/// Chat & Communication Models
class ChatMessage {
  final String id;
  final String? conversationId;
  final String senderId;
  final String? senderName;
  final String? senderRole;
  final String? receiverId;
  final String message;
  final String? fileUrl;
  final String? fileType; // image, document, audio
  final String timestamp;
  final bool isRead;

  const ChatMessage({
    required this.id,
    this.conversationId,
    required this.senderId,
    this.senderName,
    this.senderRole,
    this.receiverId,
    required this.message,
    this.fileUrl,
    this.fileType,
    required this.timestamp,
    this.isRead = false,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: (json['id'] ?? '').toString(),
      conversationId: json['conversation_id']?.toString(),
      senderId: json['sender_id']?.toString() ?? '',
      senderName: json['sender_name'] as String?,
      senderRole: json['sender_role'] as String?,
      receiverId: json['receiver_id']?.toString(),
      message: json['message'] as String? ?? '',
      fileUrl: json['file_url'] as String?,
      fileType: json['file_type'] as String?,
      timestamp: json['timestamp'] as String? ?? json['created_at'] as String? ?? '',
      isRead: json['is_read'] as bool? ?? false,
    );
  }
}

class ChatContact {
  final String id;
  final String name;
  final String? avatarUrl;
  final String role; // teacher, parent, student, admin
  final String? lastMessage;
  final String? lastMessageTime;
  final int unreadCount;
  final bool isOnline;

  const ChatContact({
    required this.id,
    required this.name,
    this.avatarUrl,
    required this.role,
    this.lastMessage,
    this.lastMessageTime,
    this.unreadCount = 0,
    this.isOnline = false,
  });

  factory ChatContact.fromJson(Map<String, dynamic> json) {
    return ChatContact(
      id: (json['id'] ?? json['user_id'] ?? '').toString(),
      name: json['name'] as String? ?? '',
      avatarUrl: json['avatar_url'] as String?,
      role: json['role'] as String? ?? 'student',
      lastMessage: json['last_message'] as String?,
      lastMessageTime: json['last_message_time'] as String?,
      unreadCount: json['unread_count'] as int? ?? 0,
      isOnline: json['is_online'] as bool? ?? false,
    );
  }
}
