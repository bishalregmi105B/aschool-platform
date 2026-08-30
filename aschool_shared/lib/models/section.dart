/// Section model — maps to backend Section (sections table)
import '../utils/safe_parse.dart';

class Section {
  final String id;
  final String name;
  final String? nameNepali;
  final String classId;
  final int? capacity;
  final String? classTeacherId;

  const Section({
    required this.id,
    required this.name,
    this.nameNepali,
    required this.classId,
    this.capacity,
    this.classTeacherId,
  });

  factory Section.fromJson(Map<String, dynamic> json) {
    return Section(
      id: safeString(json['id']),
      name: safeString(json['name']),
      nameNepali: safeStringOrNull(json['name_nepali']),
      classId: safeString(json['class_id']),
      capacity: safeIntOrNull(json['capacity']),
      classTeacherId: safeStringOrNull(json['class_teacher_id']),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'name_nepali': nameNepali,
        'class_id': classId,
        'capacity': capacity,
        'class_teacher_id': classTeacherId,
      };
}
