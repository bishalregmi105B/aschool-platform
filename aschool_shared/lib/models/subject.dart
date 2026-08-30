/// Subject model — maps to backend Subject (subjects table)
import '../utils/safe_parse.dart';

class Subject {
  final String id;
  final String name;
  final String? nameNepali;
  final String? code;
  final String? classId;
  final List<String> classIds;
  final String? teacherId;
  final List<String> teacherIds;
  final String? teacherName;
  final int? creditHours;
  final String subjectType; // compulsory, optional, elective
  final bool isOptional;
  final bool hasPractical;
  final int? fullMarks;
  final int? passMarks;
  final String? bgColor;
  final String? image;

  const Subject({
    required this.id,
    required this.name,
    this.nameNepali,
    this.code,
    this.classId,
    this.classIds = const [],
    this.teacherId,
    this.teacherIds = const [],
    this.teacherName,
    this.creditHours,
    this.subjectType = 'compulsory',
    this.isOptional = false,
    this.hasPractical = false,
    this.fullMarks,
    this.passMarks,
    this.bgColor,
    this.image,
  });

  factory Subject.fromJson(Map<String, dynamic> json) {
    final type = safeString(json['subject_type'], fallback: 'compulsory').toLowerCase();
    return Subject(
      id: safeString(json['id']),
      name: safeString(json['name']),
      nameNepali: safeStringOrNull(json['name_nepali']),
      code: safeStringOrNull(json['code']),
      classId: safeStringOrNull(json['class_id']),
      classIds: safeStringList(json['class_ids']),
      teacherId: safeStringOrNull(json['teacher_id']),
      teacherIds: safeStringList(json['teacher_ids']),
      teacherName: safeStringOrNull(json['teacher_name']),
      creditHours: safeIntOrNull(json['credit_hours']),
      subjectType: type,
      isOptional: safeBool(json['is_optional'], fallback: type == 'optional'),
      hasPractical: safeBool(json['has_practical']),
      fullMarks: safeIntOrNull(json['full_marks']),
      passMarks: safeIntOrNull(json['pass_marks']),
      bgColor: safeStringOrNull(json['bg_color']),
      image: safeStringOrNull(json['image']),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'name_nepali': nameNepali,
        'code': code,
        'class_id': classId,
        'class_ids': classIds,
        'teacher_id': teacherId,
        'teacher_ids': teacherIds,
        'teacher_name': teacherName,
        'credit_hours': creditHours,
        'subject_type': subjectType,
        'is_optional': isOptional,
        'has_practical': hasPractical,
        'full_marks': fullMarks,
        'pass_marks': passMarks,
      };

  /// Display name with type suffix e.g. "Science - Theory"
  String get displayName {
    if (hasPractical) return '$name - ${subjectType == 'practical' ? 'Practical' : 'Theory'}';
    return nameNepali ?? name;
  }
}
