/// Student model — maps to backend Student (students table) to_dict() output
import '../utils/safe_parse.dart';
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
      id: safeString(json['id']),
      userId: safeStringOrNull(json['user_id']),
      studentId: safeStringOrNull(json['student_id']),
      enrollmentNumber: safeStringOrNull(json['enrollment_number']),
      firstName: safeString(json['first_name']),
      lastName: safeString(json['last_name']),
      gender: safeStringOrNull(json['gender']),
      dobBs: safeStringOrNull(json['dob_bs']),
      dobAd: safeStringOrNull(json['dob_ad']),
      bloodGroup: safeStringOrNull(json['blood_group']),
      classId: safeStringOrNull(json['class_id']),
      className: safeStringOrNull(json['class_name']),
      sectionId: safeStringOrNull(json['section_id']),
      sectionName: safeStringOrNull(json['section_name']),
      academicYearId: safeStringOrNull(json['academic_year_id']),
      academicYear: safeStringOrNull(json['academic_year']),
      rollNumber: safeIntOrNull(json['roll_number']),
      admissionNumber: safeStringOrNull(json['admission_number']),
      admissionDateBs: safeStringOrNull(json['admission_date_bs']),
      nationality: safeStringOrNull(json['nationality']),
      religion: safeStringOrNull(json['religion']),
      ethnicity: safeStringOrNull(json['ethnicity']),
      address: safeMapOrNull(json['address']),
      status: safeStringOrNull(json['status']),
      photoUrl: safeStringOrNull(json['photo_url']),
      email: safeStringOrNull(json['email']),
      phone: safeStringOrNull(json['phone']),
      riskScore: safeDoubleOrNull(json['risk_score']),
      riskLevel: safeStringOrNull(json['risk_level']),
      totalPoints: safeInt(json['total_points']),
      currentStreak: safeInt(json['current_streak']),
      guardians:
          safeMapList(json['guardians']).map(Guardian.fromJson).toList(),
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
