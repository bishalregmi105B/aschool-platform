/// Academic year model — maps to backend AcademicYear (academic_years table)
import '../utils/safe_parse.dart';

class AcademicYear {
  final String id;
  final String name;
  final String? nameNepali;
  final String? startDateBs;
  final String? endDateBs;
  final String? startDateAd;
  final String? endDateAd;
  final bool isCurrent;

  const AcademicYear({
    required this.id,
    required this.name,
    this.nameNepali,
    this.startDateBs,
    this.endDateBs,
    this.startDateAd,
    this.endDateAd,
    this.isCurrent = false,
  });

  factory AcademicYear.fromJson(Map<String, dynamic> json) {
    return AcademicYear(
      id: safeString(json['id']),
      name: safeString(json['name']),
      nameNepali: safeStringOrNull(json['name_nepali']),
      startDateBs: safeStringOrNull(json['start_date_bs']),
      endDateBs: safeStringOrNull(json['end_date_bs']),
      startDateAd: safeStringOrNull(json['start_date_ad']),
      endDateAd: safeStringOrNull(json['end_date_ad']),
      isCurrent: safeBool(json['is_current']),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'name_nepali': nameNepali,
        'start_date_bs': startDateBs,
        'end_date_bs': endDateBs,
        'start_date_ad': startDateAd,
        'end_date_ad': endDateAd,
        'is_current': isCurrent,
      };

  /// Display date — prefers BS (Nepali) format, falls back to AD
  String get displayStartDate => startDateBs ?? startDateAd ?? '';
  String get displayEndDate => endDateBs ?? endDateAd ?? '';
  String get displayRange => '$displayStartDate – $displayEndDate';
}
