/// Section model — maps to backend Section (sections table)
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
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      nameNepali: json['name_nepali'] as String?,
      classId: json['class_id'] as String? ?? '',
      capacity: json['capacity'] as int?,
      classTeacherId: json['class_teacher_id'] as String?,
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
