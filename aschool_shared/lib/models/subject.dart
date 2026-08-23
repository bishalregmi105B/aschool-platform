/// Subject model — maps to backend Subject (subjects table)
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
    final type = (json['subject_type'] as String? ?? 'compulsory').toLowerCase();
    return Subject(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      nameNepali: json['name_nepali'] as String?,
      code: json['code'] as String?,
      classId: json['class_id'] as String?,
      classIds: _toStringList(json['class_ids']),
      teacherId: json['teacher_id'] as String?,
      teacherIds: _toStringList(json['teacher_ids']),
      teacherName: json['teacher_name'] as String?,
      creditHours: json['credit_hours'] as int?,
      subjectType: type,
      isOptional: json['is_optional'] as bool? ?? type == 'optional',
      hasPractical: json['has_practical'] as bool? ?? false,
      fullMarks: json['full_marks'] as int?,
      passMarks: json['pass_marks'] as int?,
      bgColor: json['bg_color'] as String?,
      image: json['image'] as String?,
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

  static List<String> _toStringList(dynamic value) {
    if (value == null) return [];
    if (value is List) return value.map((e) => e.toString()).toList();
    return [];
  }
}
