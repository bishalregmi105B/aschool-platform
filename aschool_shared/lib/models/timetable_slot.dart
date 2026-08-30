/// Timetable slot model — maps to backend timetable.py
import 'subject.dart';

class TimetableSlot {
  final String id;
  final String dayOfWeek;
  final String startTime;
  final String endTime;
  final int? periodNumber;
  final bool isBreak;
  final String? subjectId;
  final String? subjectName;
  final String? teacherId;
  final String? teacherName;
  final String? roomId;
  final String? roomName;
  final Subject? subject;

  const TimetableSlot({
    required this.id,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    this.periodNumber,
    this.isBreak = false,
    this.subjectId,
    this.subjectName,
    this.teacherId,
    this.teacherName,
    this.roomId,
    this.roomName,
    this.subject,
  });

  String get subjectLabel => subjectName ?? subject?.name ?? 'Free Period';
  String get teacherLabel => teacherName ?? 'Teacher';
  bool get isCurrent {
    final now = DateTime.now();
    final currentMinutes = now.hour * 60 + now.minute;
    final start = _minutesFromTime(startTime);
    final end = _minutesFromTime(endTime);
    if (start == null || end == null) return false;
    return currentMinutes >= start && currentMinutes <= end;
  }

  factory TimetableSlot.fromJson(Map<String, dynamic> json) {
    final rawSubject = json['subject'];
    final rawTeacher = json['teacher'];

    Subject? subject;
    String? resolvedSubjectName = _asString(json['subject_name']);
    String? resolvedSubjectId = _asString(json['subject_id']);
    if (rawSubject is Map) {
      final subjectMap = Map<String, dynamic>.from(rawSubject);
      subject = Subject.fromJson(subjectMap);
      resolvedSubjectName ??= _asString(subjectMap['name']);
      resolvedSubjectId ??= _asString(subjectMap['id']);
    } else if (rawSubject is String) {
      resolvedSubjectName ??= rawSubject;
    }

    String? resolvedTeacherName = _asString(json['teacher_name']);
    String? resolvedTeacherId = _asString(json['teacher_id']);
    if (rawTeacher is Map) {
      final teacherMap = Map<String, dynamic>.from(rawTeacher);
      resolvedTeacherName ??= _asString(teacherMap['full_name']);
      resolvedTeacherName ??= _asString(teacherMap['name']);
      resolvedTeacherId ??= _asString(teacherMap['id']);
    } else if (rawTeacher is String) {
      resolvedTeacherName ??= rawTeacher;
    }

    final period = _asInt(json['period_number']);
    final dayOfWeek =
        _asString(json['day_of_week']) ?? _asString(json['day']) ?? '';
    final startTime = _asString(json['start_time']) ?? '';

    return TimetableSlot(
      id: _asString(json['id']) ?? '$dayOfWeek-$period-$startTime',
      dayOfWeek: dayOfWeek,
      startTime: startTime,
      endTime: _asString(json['end_time']) ?? '',
      periodNumber: period,
      isBreak: json['is_break'] == true,
      subjectId: resolvedSubjectId,
      subjectName: resolvedSubjectName,
      teacherId: resolvedTeacherId,
      teacherName: resolvedTeacherName,
      roomId: json['room_id']?.toString(),
      roomName: _asString(json['room_name']),
      subject: subject,
    );
  }

  static String? _asString(dynamic value) {
    final text = value?.toString().trim();
    if (text == null || text.isEmpty || text == 'null') return null;
    return text;
  }

  static int? _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '');
  }

  static int? _minutesFromTime(String value) {
    final parts = value.split(':');
    if (parts.length < 2) return null;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return null;
    return hour * 60 + minute;
  }
}
