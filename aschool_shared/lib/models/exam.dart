/// Exam models — matches backend exam.py (Exam, ExamSchedule, ExamResult)
import '../utils/safe_parse.dart';
import 'subject.dart';

class Exam {
  final String id;
  final String name;
  final String? description;
  final String? examType; // offline, online
  final String? startDate;
  final String? endDate;
  final String? status; // upcoming, ongoing, completed
  final bool isPublished;
  final String? academicYearId;
  final List<ExamTimetableSlot> timetable;

  const Exam({
    required this.id,
    required this.name,
    this.description,
    this.examType,
    this.startDate,
    this.endDate,
    this.status,
    this.isPublished = false,
    this.academicYearId,
    this.timetable = const [],
  });

  String get term => examType ?? status ?? 'Exam';
  List<Map<String, dynamic>> get subjects => timetable
      .map(
        (slot) => {
          'subject': slot.subjectName ?? slot.subject?.name ?? 'Subject',
          'date': slot.date ?? '',
          'time': [
            if (slot.startTime?.isNotEmpty ?? false) slot.startTime,
            if (slot.endTime?.isNotEmpty ?? false) slot.endTime,
          ].whereType<String>().join(' - '),
          'full_marks': slot.totalMarks ?? totalMarksFallback,
        },
      )
      .toList();
  int get totalMarksFallback => timetable.fold<int>(
        0,
        (sum, slot) => sum + (slot.totalMarks ?? 0),
      );

  factory Exam.fromJson(Map<String, dynamic> json) {
    return Exam(
      id: safeString(json['id']),
      name: safeString(json['name']),
      description: safeStringOrNull(json['description']),
      examType: safeStringOrNull(json['exam_type']),
      startDate: safeStringOrNull(json['start_date']),
      endDate: safeStringOrNull(json['end_date']),
      status: safeStringOrNull(json['status']) ??
          safeStringOrNull(json['exam_status']),
      isPublished: safeBool(
        json['is_published'],
        fallback: safeBool(json['publish']),
      ),
      academicYearId: safeStringOrNull(json['academic_year_id']),
      timetable: safeMapList(json['timetable'])
          .map(ExamTimetableSlot.fromJson)
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'exam_type': examType,
        'start_date': startDate,
        'end_date': endDate,
      };
}

class ExamTimetableSlot {
  final String id;
  final String? subjectId;
  final String? subjectName;
  final String? date;
  final String? startTime;
  final String? endTime;
  final int? totalMarks;
  final double? passingMarks;
  final Subject? subject;

  const ExamTimetableSlot({
    required this.id,
    this.subjectId,
    this.subjectName,
    this.date,
    this.startTime,
    this.endTime,
    this.totalMarks,
    this.passingMarks,
    this.subject,
  });

  factory ExamTimetableSlot.fromJson(Map<String, dynamic> json) {
    return ExamTimetableSlot(
      id: safeString(json['id']),
      subjectId: safeStringOrNull(json['subject_id']),
      subjectName: safeStringOrNull(json['subject_name']),
      date: safeStringOrNull(json['date']),
      startTime: safeStringOrNull(json['starting_time']) ??
          safeStringOrNull(json['start_time']),
      endTime: safeStringOrNull(json['ending_time']) ??
          safeStringOrNull(json['end_time']),
      totalMarks: safeIntOrNull(json['total_marks']),
      passingMarks: safeDoubleOrNull(json['passing_marks']),
      subject: json['subject'] is Map
          ? Subject.fromJson(safeMap(json['subject']))
          : null,
    );
  }
}

class ExamResult {
  final String id;
  final String? examId;
  final String examName;
  final String? subjectId;
  final String? subjectName;
  final double? marksObtained;
  final double? totalMarks;
  final double percentage;
  final String grade;
  final double gpa;
  final String? remarks;
  final int? rank;
  final List<Map<String, dynamic>> subjects;

  const ExamResult({
    required this.id,
    this.examId,
    this.examName = 'Exam Result',
    this.subjectId,
    this.subjectName,
    this.marksObtained,
    this.totalMarks,
    this.percentage = 0,
    this.grade = 'N/A',
    this.gpa = 0,
    this.remarks,
    this.rank,
    this.subjects = const [],
  });

  factory ExamResult.fromJson(Map<String, dynamic> json) {
    final subjects = safeMapList(json['subjects']);
    final marksObtained = safeDoubleOrNull(json['marks_obtained']);
    final totalMarks = safeDoubleOrNull(json['total_marks']);
    final calculatedPercentage =
        totalMarks != null && totalMarks > 0 && marksObtained != null
            ? marksObtained / totalMarks * 100
            : 0.0;

    return ExamResult(
      id: safeString(json['id']),
      examId: safeStringOrNull(json['exam_id']),
      examName: safeStringOrNull(json['exam_name']) ??
          safeStringOrNull(json['exam']) ??
          'Exam Result',
      subjectId: safeStringOrNull(json['subject_id']),
      subjectName: safeStringOrNull(json['subject_name']),
      marksObtained: marksObtained,
      totalMarks: totalMarks,
      percentage:
          safeDoubleOrNull(json['percentage']) ?? calculatedPercentage,
      grade: safeString(json['grade'], fallback: 'N/A'),
      gpa: safeDouble(json['gpa']),
      remarks: safeStringOrNull(json['remarks']),
      rank: safeIntOrNull(json['rank']),
      subjects: subjects.isNotEmpty
          ? subjects
          : [
              if (subjectNameFor(json) != null)
                {
                  'subject': subjectNameFor(json),
                  'obtained': marksObtained ?? 0,
                  'full_marks': totalMarks ?? 0,
                  'grade': safeString(json['grade'], fallback: 'N/A'),
                }
            ],
    );
  }

  static String? subjectNameFor(Map<String, dynamic> json) =>
      safeStringOrNull(json['subject_name']) ??
      safeStringOrNull(json['subject']);
}

class OnlineExam {
  final String id;
  final String title;
  final String? subjectId;
  final String? subjectName;
  final int? duration; // minutes
  final int? totalQuestions;
  final int? totalMarks;
  final String? startDate;
  final String? endDate;
  final String status;
  final List<Question> questions;

  const OnlineExam({
    required this.id,
    required this.title,
    this.subjectId,
    this.subjectName,
    this.duration,
    this.totalQuestions,
    this.totalMarks,
    this.startDate,
    this.endDate,
    this.status = 'upcoming',
    this.questions = const [],
  });

  String get subject => subjectName ?? 'General';
  int get durationMinutes => duration ?? 0;

  factory OnlineExam.fromJson(Map<String, dynamic> json) {
    return OnlineExam(
      id: safeString(json['id']),
      title: safeString(json['title'], fallback: safeString(json['name'])),
      subjectId: safeStringOrNull(json['subject_id']),
      subjectName: safeStringOrNull(json['subject_name']),
      duration: safeIntOrNull(json['duration']),
      totalQuestions: safeIntOrNull(json['total_questions']),
      totalMarks: safeIntOrNull(json['total_marks']),
      startDate: safeStringOrNull(json['start_date']),
      endDate: safeStringOrNull(json['end_date']),
      status: safeStringOrNull(json['status']) ??
          safeStringOrNull(json['exam_status']) ??
          'upcoming',
      questions:
          safeMapList(json['questions']).map(Question.fromJson).toList(),
    );
  }
}

class Question {
  final String id;
  final String question;
  final String? image;
  final int marks;
  final List<AnswerOption> options;
  final List<String>? correctAnswers;

  const Question({
    required this.id,
    required this.question,
    this.image,
    this.marks = 1,
    this.options = const [],
    this.correctAnswers,
  });

  factory Question.fromJson(Map<String, dynamic> json) {
    return Question(
      id: safeString(json['id']),
      question: safeString(json['question']),
      image: safeStringOrNull(json['image']),
      marks: safeInt(json['marks'], fallback: 1),
      options: _optionsFrom(json['options']),
      correctAnswers: json['correct_answers'] is List
          ? safeStringList(json['correct_answers'])
          : [
              if (json['correct_answer'] != null)
                safeString(json['correct_answer'])
            ],
    );
  }

  /// Options may arrive as objects ({option/text: ...}) or plain strings.
  static List<AnswerOption> _optionsFrom(dynamic raw) {
    if (raw is! List) return const [];
    return [
      for (final option in raw)
        if (option is Map)
          AnswerOption.fromJson(safeMap(option))
        else if (option is String || option is num || option is bool)
          AnswerOption(id: option.toString(), text: option.toString()),
    ];
  }
}

class AnswerOption {
  final String id;
  final String text;
  final String? image;

  const AnswerOption({required this.id, required this.text, this.image});

  factory AnswerOption.fromJson(Map<String, dynamic> json) {
    return AnswerOption(
      id: safeString(json['id']),
      text: safeString(json['option'], fallback: safeString(json['text'])),
      image: safeStringOrNull(json['image']),
    );
  }
}
