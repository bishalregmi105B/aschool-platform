/// Exam models — matches backend exam.py (Exam, ExamSchedule, ExamResult)
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
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      examType: json['exam_type'] as String?,
      startDate: json['start_date'] as String?,
      endDate: json['end_date'] as String?,
      status: json['status'] as String? ?? json['exam_status'] as String?,
      isPublished: json['is_published'] as bool? ?? (json['publish'] == 1),
      academicYearId: json['academic_year_id'] as String?,
      timetable: ((json['timetable'] ?? []) as List)
          .map((t) => ExamTimetableSlot.fromJson(Map<String, dynamic>.from(t)))
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
      id: (json['id'] ?? '').toString(),
      subjectId: json['subject_id']?.toString(),
      subjectName: json['subject_name'] as String?,
      date: json['date'] as String?,
      startTime:
          json['starting_time'] as String? ?? json['start_time'] as String?,
      endTime: json['ending_time'] as String? ?? json['end_time'] as String?,
      totalMarks: json['total_marks'] as int?,
      passingMarks: (json['passing_marks'] as num?)?.toDouble(),
      subject: json['subject'] != null
          ? Subject.fromJson(Map<String, dynamic>.from(json['subject']))
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
    final subjects = (json['subjects'] as List?)
            ?.map((subject) => Map<String, dynamic>.from(subject as Map))
            .toList() ??
        [];
    final marksObtained = (json['marks_obtained'] as num?)?.toDouble();
    final totalMarks = (json['total_marks'] as num?)?.toDouble();
    final calculatedPercentage =
        totalMarks != null && totalMarks > 0 && marksObtained != null
            ? marksObtained / totalMarks * 100
            : 0.0;

    return ExamResult(
      id: (json['id'] ?? '').toString(),
      examId: json['exam_id']?.toString(),
      examName: json['exam_name'] as String? ??
          json['exam'] as String? ??
          'Exam Result',
      subjectId: json['subject_id']?.toString(),
      subjectName: json['subject_name'] as String?,
      marksObtained: marksObtained,
      totalMarks: totalMarks,
      percentage:
          (json['percentage'] as num?)?.toDouble() ?? calculatedPercentage,
      grade: json['grade'] as String? ?? 'N/A',
      gpa: (json['gpa'] as num?)?.toDouble() ?? 0,
      remarks: json['remarks'] as String?,
      rank: json['rank'] as int?,
      subjects: subjects.isNotEmpty
          ? subjects
          : [
              if (subjectNameFor(json) != null)
                {
                  'subject': subjectNameFor(json),
                  'obtained': marksObtained ?? 0,
                  'full_marks': totalMarks ?? 0,
                  'grade': json['grade'] as String? ?? 'N/A',
                }
            ],
    );
  }

  static String? subjectNameFor(Map<String, dynamic> json) =>
      json['subject_name'] as String? ?? json['subject'] as String?;
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
      id: json['id'] as String,
      title: json['title'] as String? ?? json['name'] as String? ?? '',
      subjectId: json['subject_id']?.toString(),
      subjectName: json['subject_name'] as String?,
      duration: json['duration'] as int?,
      totalQuestions: json['total_questions'] as int?,
      totalMarks: json['total_marks'] as int?,
      startDate: json['start_date'] as String?,
      endDate: json['end_date'] as String?,
      status: json['status'] as String? ??
          json['exam_status'] as String? ??
          'upcoming',
      questions: ((json['questions'] ?? []) as List)
          .map((q) => Question.fromJson(Map<String, dynamic>.from(q)))
          .toList(),
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
      id: (json['id'] ?? '').toString(),
      question: json['question'] as String? ?? '',
      image: json['image'] as String?,
      marks: json['marks'] as int? ?? 1,
      options: ((json['options'] ?? []) as List).asMap().entries.map((entry) {
        final option = entry.value;
        if (option is Map) {
          return AnswerOption.fromJson(Map<String, dynamic>.from(option));
        }
        return AnswerOption(id: option.toString(), text: option.toString());
      }).toList(),
      correctAnswers: (json['correct_answers'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          [
            if (json['correct_answer'] != null)
              json['correct_answer'].toString()
          ],
    );
  }
}

class AnswerOption {
  final String id;
  final String text;
  final String? image;

  const AnswerOption({required this.id, required this.text, this.image});

  factory AnswerOption.fromJson(Map<String, dynamic> json) {
    return AnswerOption(
      id: (json['id'] ?? '').toString(),
      text: json['option'] as String? ?? json['text'] as String? ?? '',
      image: json['image'] as String?,
    );
  }
}
