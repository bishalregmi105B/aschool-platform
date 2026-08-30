/// Attendance models — maps to backend Attendance & TeacherAttendance
import '../utils/safe_parse.dart';

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
      id: safeString(json['id']),
      studentId: safeString(json['student_id']),
      classId: safeString(json['class_id']),
      sectionId: safeStringOrNull(json['section_id']),
      date: safeString(json['date']),
      dateBs: safeStringOrNull(json['date_bs']),
      status: safeString(json['status'], fallback: 'absent'),
      checkInTime: safeStringOrNull(json['check_in_time']),
      checkOutTime: safeStringOrNull(json['check_out_time']),
      markedById: safeStringOrNull(json['marked_by_id']),
      remarks: safeStringOrNull(json['remarks']),
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
      totalDays: safeInt(json['total_days']),
      presentDays: safeIntOrNull(json['present_days']) ??
          safeIntOrNull(json['present']) ??
          0,
      absentDays: safeIntOrNull(json['absent_days']) ??
          safeIntOrNull(json['absent']) ??
          0,
      lateDays:
          safeIntOrNull(json['late_days']) ?? safeIntOrNull(json['late']) ?? 0,
      halfDays: safeInt(json['half_day_days']),
      leaveDays: safeInt(json['leave_days']),
      percentage: safeDouble(json['percentage']),
    );
  }
}
