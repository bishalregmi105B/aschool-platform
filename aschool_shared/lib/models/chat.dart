/// Chat & Communication Models
import '../utils/safe_parse.dart';

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
      id: safeString(json['id']),
      conversationId: safeStringOrNull(json['conversation_id']),
      senderId: safeString(json['sender_id']),
      senderName: safeStringOrNull(json['sender_name']),
      senderRole: safeStringOrNull(json['sender_role']),
      receiverId: safeStringOrNull(json['receiver_id']),
      message: safeString(json['message']),
      fileUrl: safeStringOrNull(json['file_url']),
      fileType: safeStringOrNull(json['file_type']),
      timestamp: safeString(json['timestamp'],
          fallback: safeString(json['created_at'])),
      isRead: safeBool(json['is_read']),
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
      id: safeString(json['id'], fallback: safeString(json['user_id'])),
      name: safeString(json['name']),
      avatarUrl: safeStringOrNull(json['avatar_url']),
      role: safeString(json['role'], fallback: 'student'),
      lastMessage: safeStringOrNull(json['last_message']),
      lastMessageTime: safeStringOrNull(json['last_message_time']),
      unreadCount: safeInt(json['unread_count']),
      isOnline: safeBool(json['is_online']),
    );
  }
}
