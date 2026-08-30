/// Communication & UI Models
import '../utils/safe_parse.dart';

class Notice {
  final String id;
  final String title;
  final String content;
  final String date;
  final String? type; // general, academic, exam, holiday
  final String? fileUrl;
  final List<String> targetRoles;

  const Notice({
    required this.id,
    required this.title,
    required this.content,
    required this.date,
    this.type,
    this.fileUrl,
    this.targetRoles = const [],
  });

  factory Notice.fromJson(Map<String, dynamic> json) {
    return Notice(
      id: safeString(json['id']),
      title: safeString(json['title']),
      content: safeString(json['content']),
      date:
          safeString(json['date'], fallback: safeString(json['created_at'])),
      type: safeStringOrNull(json['type']),
      fileUrl: safeStringOrNull(json['file_url']),
      targetRoles: safeStringList(json['target_roles']),
    );
  }
}

class Announcement {
  final String id;
  final String title;
  final String message;
  final String? classId;
  final String? sectionId;
  final String? fileUrl;
  final String? createdById;
  final String? createdByName;
  final String createdAt;

  const Announcement({
    required this.id,
    required this.title,
    required this.message,
    this.classId,
    this.sectionId,
    this.fileUrl,
    this.createdById,
    this.createdByName,
    required this.createdAt,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: safeString(json['id']),
      title: safeString(json['title']),
      message: safeString(json['message'],
          fallback: safeString(json['description'])),
      classId: safeStringOrNull(json['class_id']),
      sectionId: safeStringOrNull(json['section_id']),
      fileUrl: safeStringOrNull(json['file_url']),
      createdById: safeStringOrNull(json['created_by_id']),
      createdByName: safeStringOrNull(json['created_by_name']),
      createdAt: safeString(json['created_at']),
    );
  }
}

class SliderBanner {
  final String id;
  final String title;
  final String imageUrl;
  final String? linkUrl;
  final bool isActive;

  const SliderBanner({
    required this.id,
    required this.title,
    required this.imageUrl,
    this.linkUrl,
    this.isActive = true,
  });

  factory SliderBanner.fromJson(Map<String, dynamic> json) {
    return SliderBanner(
      id: safeString(json['id']),
      title: safeString(json['title']),
      imageUrl: safeString(json['image_url'],
          fallback: safeString(json['image'])),
      linkUrl: safeStringOrNull(json['link_url']),
      isActive: safeBool(json['is_active'], fallback: true),
    );
  }
}
