/// LMS Models — maps to backend lms.py (Lesson, Topic, StudyMaterial)
import '../utils/safe_parse.dart';

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
      id: safeString(json['id']),
      name: safeString(json['name']),
      description: safeStringOrNull(json['description']),
      classId: safeStringOrNull(json['class_id']),
      sectionId: safeStringOrNull(json['section_id']),
      subjectId: safeStringOrNull(json['subject_id']),
      topics: safeMapList(json['topics'] ?? json['topic'])
          .map(Topic.fromJson)
          .toList(),
      studyMaterials:
          safeMapList(json['study_materials'] ?? json['file'])
              .map(StudyMaterial.fromJson)
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
      id: safeString(json['id']),
      lessonId: safeString(json['lesson_id']),
      name: safeString(json['name']),
      description: safeStringOrNull(json['description']),
      studyMaterials:
          safeMapList(json['study_materials'] ?? json['file'])
              .map(StudyMaterial.fromJson)
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
      id: safeString(json['id']),
      name: safeString(json['name'], fallback: safeString(json['file_name'])),
      type: safeStringOrNull(json['type']),
      fileUrl:
          safeString(json['file_url'], fallback: safeString(json['url'])),
      thumbnailUrl: safeStringOrNull(json['thumbnail_url']),
      description: safeStringOrNull(json['description']),
    );
  }
}
