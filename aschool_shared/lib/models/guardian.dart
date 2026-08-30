/// Guardian model — maps to backend Guardian (guardians table)
import '../utils/safe_parse.dart';

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
      id: safeString(json['id']),
      studentId: safeString(json['student_id']),
      userId: safeStringOrNull(json['user_id']),
      fullName: safeString(json['full_name']),
      fullNameNepali: safeStringOrNull(json['full_name_nepali']),
      phone: safeStringOrNull(json['phone']),
      phone2: safeStringOrNull(json['phone_2']),
      email: safeStringOrNull(json['email']),
      relation: safeString(json['relation'], fallback: 'guardian'),
      isPrimary: safeBool(json['is_primary']),
      occupation: safeStringOrNull(json['occupation']),
      educationLevel: safeStringOrNull(json['education_level']),
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
