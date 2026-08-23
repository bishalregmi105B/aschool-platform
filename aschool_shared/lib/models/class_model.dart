/// Class (grade) model — maps to backend Class (classes table)
/// Named ClassModel to avoid collision with Dart's built-in Class.
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
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      nameNepali: json['name_nepali'] as String?,
      gradeNumber: json['grade_number'] as int? ?? json['numeric_grade'] as int?,
      sortOrder: json['sort_order'] as int? ?? 0,
      sections: ((json['sections'] ?? []) as List)
          .map((s) => Section.fromJson(Map<String, dynamic>.from(s)))
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
