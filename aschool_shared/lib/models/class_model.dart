/// Class (grade) model — maps to backend Class (classes table)
/// Named ClassModel to avoid collision with Dart's built-in Class.
import '../utils/safe_parse.dart';
import 'section.dart';

class ClassModel {
  final String id;
  final String name;
  final String? nameNepali;
  final int? gradeNumber;
  final int sortOrder;
  final List<Section> sections;

  const ClassModel({
    required this.id,
    required this.name,
    this.nameNepali,
    this.gradeNumber,
    this.sortOrder = 0,
    this.sections = const [],
  });

  factory ClassModel.fromJson(Map<String, dynamic> json) {
    return ClassModel(
      id: safeString(json['id']),
      name: safeString(json['name']),
      nameNepali: safeStringOrNull(json['name_nepali']),
      gradeNumber:
          safeIntOrNull(json['grade_number']) ?? safeIntOrNull(json['numeric_grade']),
      sortOrder: safeInt(json['sort_order']),
      sections: safeMapList(json['sections'])
          .map(Section.fromJson)
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'name_nepali': nameNepali,
        'grade_number': gradeNumber,
        'sort_order': sortOrder,
        'sections': sections.map((s) => s.toJson()).toList(),
      };

  /// e.g. "Grade 10" or "कक्षा १०"
  String get displayName => nameNepali ?? name;
}
