/// LMS Models — maps to backend lms.py (Lesson, Topic, StudyMaterial)

class Lesson {
  final String id;
  final String name;
  final String? description;
  final String? classId;
  final String? sectionId;
  final String? subjectId;
  final List<Topic> topics;
  final List<StudyMaterial> studyMaterials;

  const Lesson({
    required this.id,
    required this.name,
    this.description,
    this.classId,
    this.sectionId,
    this.subjectId,
    this.topics = const [],
    this.studyMaterials = const [],
  });

  factory Lesson.fromJson(Map<String, dynamic> json) {
    return Lesson(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      classId: json['class_id']?.toString(),
      sectionId: json['section_id']?.toString(),
      subjectId: json['subject_id']?.toString(),
      topics: ((json['topics'] ?? json['topic'] ?? []) as List)
          .map((t) => Topic.fromJson(Map<String, dynamic>.from(t)))
          .toList(),
      studyMaterials: ((json['study_materials'] ?? json['file'] ?? []) as List)
          .map((m) => StudyMaterial.fromJson(Map<String, dynamic>.from(m)))
          .toList(),
    );
  }
}

class Topic {
  final String id;
  final String lessonId;
  final String name;
  final String? description;
  final List<StudyMaterial> studyMaterials;

  const Topic({
    required this.id,
    required this.lessonId,
    required this.name,
    this.description,
    this.studyMaterials = const [],
  });

  factory Topic.fromJson(Map<String, dynamic> json) {
    return Topic(
      id: json['id'] as String,
      lessonId: json['lesson_id']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      studyMaterials: ((json['study_materials'] ?? json['file'] ?? []) as List)
          .map((m) => StudyMaterial.fromJson(Map<String, dynamic>.from(m)))
          .toList(),
    );
  }
}

class StudyMaterial {
  final String id;
  final String name;
  final String? type; // pdf, video, doc, image
  final String fileUrl;
  final String? thumbnailUrl;
  final String? description;

  const StudyMaterial({
    required this.id,
    required this.name,
    this.type,
    required this.fileUrl,
    this.thumbnailUrl,
    this.description,
  });

  bool get isVideo => type == 'video' || fileUrl.contains('youtube') || fileUrl.endsWith('.mp4');
  bool get isPdf => type == 'pdf' || fileUrl.endsWith('.pdf');

  factory StudyMaterial.fromJson(Map<String, dynamic> json) {
    return StudyMaterial(
      id: json['id'] as String,
      name: json['name'] as String? ?? json['file_name'] as String? ?? '',
      type: json['type'] as String?,
      fileUrl: json['file_url'] as String? ?? json['url'] as String? ?? '',
      thumbnailUrl: json['thumbnail_url'] as String?,
      description: json['description'] as String?,
    );
  }
}
