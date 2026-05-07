/// Attendance models — maps to backend Attendance & TeacherAttendance
class AttendanceRecord {
  final String id;
  final String studentId;
  final String classId;
  final String? sectionId;
  final String date;
  final String? dateBs;
  final String status; // present, absent, late, half_day, leave
  final String? checkInTime;
  final String? checkOutTime;
  final String? markedById;
  final String? remarks;

  const AttendanceRecord({
    required this.id,
    required this.studentId,
    required this.classId,
    this.sectionId,
    required this.date,
    this.dateBs,
    required this.status,
    this.checkInTime,
    this.checkOutTime,
    this.markedById,
    this.remarks,
  });

  bool get isPresent => status == 'present';
  bool get isAbsent => status == 'absent';
  bool get isLate => status == 'late';

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: json['id'] as String,
      studentId: json['student_id'] as String? ?? '',
      classId: json['class_id'] as String? ?? '',
      sectionId: json['section_id'] as String?,
      date: json['date'] as String? ?? '',
      dateBs: json['date_bs'] as String?,
      status: json['status'] as String? ?? 'absent',
      checkInTime: json['check_in_time'] as String?,
      checkOutTime: json['check_out_time'] as String?,
      markedById: json['marked_by_id'] as String?,
      remarks: json['remarks'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'student_id': studentId,
        'class_id': classId,
        'section_id': sectionId,
        'date': date,
        'status': status,
        'remarks': remarks,
      };
}

/// Summary for calendar display
class AttendanceSummary {
  final int totalDays;
  final int presentDays;
  final int absentDays;
  final int lateDays;
  final int halfDays;
  final int leaveDays;
  final double percentage;

  const AttendanceSummary({
    this.totalDays = 0,
    this.presentDays = 0,
    this.absentDays = 0,
    this.lateDays = 0,
    this.halfDays = 0,
    this.leaveDays = 0,
    this.percentage = 0.0,
  });

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) {
    return AttendanceSummary(
      totalDays: json['total_days'] as int? ?? 0,
      presentDays: json['present_days'] as int? ?? json['present'] as int? ?? 0,
      absentDays: json['absent_days'] as int? ?? json['absent'] as int? ?? 0,
      lateDays: json['late_days'] as int? ?? json['late'] as int? ?? 0,
      halfDays: json['half_day_days'] as int? ?? 0,
      leaveDays: json['leave_days'] as int? ?? 0,
      percentage: (json['percentage'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
