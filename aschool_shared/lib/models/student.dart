/// Student model — maps to backend Student (students table) to_dict() output
import 'guardian.dart';

class Student {
  final String id;
  final String? userId;
  final String? studentId;
  final String? enrollmentNumber;
  final String firstName;
  final String lastName;
  final String? gender;
  final String? dobBs;
  final String? dobAd;
  final String? bloodGroup;
  final String? classId;
  final String? className;
  final String? sectionId;
  final String? sectionName;
  final String? academicYearId;
  final String? academicYear;
  final int? rollNumber;
  final String? admissionNumber;
  final String? admissionDateBs;
  final String? nationality;
  final String? religion;
  final String? ethnicity;
  final Map<String, dynamic>? address;
  final String? status;
  final String? photoUrl;
  final String? email;
  final String? phone;
  final double? riskScore;
  final String? riskLevel;
  final int totalPoints;
  final int currentStreak;
  final List<Guardian> guardians;

  const Student({
    required this.id,
    this.userId,
    this.studentId,
    this.enrollmentNumber,
    required this.firstName,
    required this.lastName,
    this.gender,
    this.dobBs,
    this.dobAd,
    this.bloodGroup,
    this.classId,
    this.className,
    this.sectionId,
    this.sectionName,
    this.academicYearId,
    this.academicYear,
    this.rollNumber,
    this.admissionNumber,
    this.admissionDateBs,
    this.nationality,
    this.religion,
    this.ethnicity,
    this.address,
    this.status,
    this.photoUrl,
    this.email,
    this.phone,
    this.riskScore,
    this.riskLevel,
    this.totalPoints = 0,
    this.currentStreak = 0,
    this.guardians = const [],
  });

  String get fullName => '$firstName $lastName'.trim();
  String get classSection => [className, sectionName].where((s) => s != null).join(' - ');

  factory Student.fromJson(Map<String, dynamic> json) {
    return Student(
      id: json['id'] as String,
      userId: json['user_id'] as String?,
      studentId: json['student_id'] as String?,
      enrollmentNumber: json['enrollment_number'] as String?,
      firstName: json['first_name'] as String? ?? '',
      lastName: json['last_name'] as String? ?? '',
      gender: json['gender'] as String?,
      dobBs: json['dob_bs'] as String?,
      dobAd: json['dob_ad'] as String?,
      bloodGroup: json['blood_group'] as String?,
      classId: json['class_id'] as String?,
      className: json['class_name'] as String?,
      sectionId: json['section_id'] as String?,
      sectionName: json['section_name'] as String?,
      academicYearId: json['academic_year_id'] as String?,
      academicYear: json['academic_year'] as String?,
      rollNumber: json['roll_number'] as int?,
      admissionNumber: json['admission_number'] as String?,
      admissionDateBs: json['admission_date_bs'] as String?,
      nationality: json['nationality'] as String?,
      religion: json['religion'] as String?,
      ethnicity: json['ethnicity'] as String?,
      address: json['address'] as Map<String, dynamic>?,
      status: json['status'] as String?,
      photoUrl: json['photo_url'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      riskScore: (json['risk_score'] as num?)?.toDouble(),
      riskLevel: json['risk_level'] as String?,
      totalPoints: json['total_points'] as int? ?? 0,
      currentStreak: json['current_streak'] as int? ?? 0,
      guardians: ((json['guardians'] ?? []) as List)
          .map((g) => Guardian.fromJson(Map<String, dynamic>.from(g)))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'student_id': studentId,
        'first_name': firstName,
        'last_name': lastName,
        'full_name': fullName,
        'gender': gender,
        'dob_bs': dobBs,
        'class_id': classId,
        'section_id': sectionId,
        'roll_number': rollNumber,
        'status': status,
      };
}
