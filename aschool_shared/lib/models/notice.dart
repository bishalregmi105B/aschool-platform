/// Communication & UI Models

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
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      content: json['content'] as String? ?? '',
      date: json['date'] as String? ?? json['created_at'] as String? ?? '',
      type: json['type'] as String?,
      fileUrl: json['file_url'] as String?,
      targetRoles: (json['target_roles'] as List?)?.map((e) => e.toString()).toList() ?? [],
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
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? json['description'] as String? ?? '',
      classId: json['class_id']?.toString(),
      sectionId: json['section_id']?.toString(),
      fileUrl: json['file_url'] as String?,
      createdById: json['created_by_id']?.toString(),
      createdByName: json['created_by_name'] as String?,
      createdAt: json['created_at'] as String? ?? '',
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
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      imageUrl: json['image_url'] as String? ?? json['image'] as String? ?? '',
      linkUrl: json['link_url'] as String?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}
