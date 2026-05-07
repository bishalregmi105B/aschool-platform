/// Guardian model — maps to backend Guardian (guardians table)
class Guardian {
  final String id;
  final String studentId;
  final String? userId;
  final String fullName;
  final String? fullNameNepali;
  final String? phone;
  final String? phone2;
  final String? email;
  final String relation; // father, mother, guardian, other
  final bool isPrimary;
  final String? occupation;
  final String? educationLevel;

  const Guardian({
    required this.id,
    required this.studentId,
    this.userId,
    required this.fullName,
    this.fullNameNepali,
    this.phone,
    this.phone2,
    this.email,
    required this.relation,
    this.isPrimary = false,
    this.occupation,
    this.educationLevel,
  });

  factory Guardian.fromJson(Map<String, dynamic> json) {
    return Guardian(
      id: json['id'] as String,
      studentId: json['student_id'] as String? ?? '',
      userId: json['user_id'] as String?,
      fullName: json['full_name'] as String? ?? '',
      fullNameNepali: json['full_name_nepali'] as String?,
      phone: json['phone'] as String?,
      phone2: json['phone_2'] as String?,
      email: json['email'] as String?,
      relation: json['relation'] as String? ?? 'guardian',
      isPrimary: json['is_primary'] as bool? ?? false,
      occupation: json['occupation'] as String?,
      educationLevel: json['education_level'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'student_id': studentId,
        'full_name': fullName,
        'phone': phone,
        'relation': relation,
        'is_primary': isPrimary,
      };
}
