/// Academic year model — maps to backend AcademicYear (academic_years table)
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
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      nameNepali: json['name_nepali'] as String?,
      startDateBs: json['start_date_bs'] as String?,
      endDateBs: json['end_date_bs'] as String?,
      startDateAd: json['start_date_ad'] as String?,
      endDateAd: json['end_date_ad'] as String?,
      isCurrent: json['is_current'] as bool? ?? false,
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
