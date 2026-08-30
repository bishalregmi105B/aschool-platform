/// Assignment model — maps to backend Assignment (assignments table)
import '../utils/safe_parse.dart';

class Assignment {
  final String id;
  final String? classId;
  final String? sectionId;
  final String? subjectId;
  final String? subjectName;
  final String title;
  final String? description;
  final String? dueDate;
  final String? dueDateBs;
  final int? maxMarks;
  final String? attachmentUrl;
  final List<String> attachmentUrls;
  final String? createdById;
  final String? createdByName;
  final bool isOverdue;
  final String? submissionStatus; // pending, submitted, graded
  final AssignmentSubmission? submission;

  const Assignment({
    required this.id,
    this.classId,
    this.sectionId,
    this.subjectId,
    this.subjectName,
    required this.title,
    this.description,
    this.dueDate,
    this.dueDateBs,
    this.maxMarks,
    this.attachmentUrl,
    this.attachmentUrls = const [],
    this.createdById,
    this.createdByName,
    this.isOverdue = false,
    this.submissionStatus,
    this.submission,
  });

  bool get isSubmitted =>
      submissionStatus == 'submitted' || submissionStatus == 'graded';
  bool get isGraded => submissionStatus == 'graded';
  bool get isPending => !isSubmitted;

  String get subject => subjectName ?? 'General';
  String get teacher => createdByName ?? 'Teacher';
  int? get marks => submission?.marksObtained;
  int? get totalMarks => maxMarks;
  String? get feedback => submission?.feedback;
  List<String> get attachments => [
        if (attachmentUrl != null && attachmentUrl!.isNotEmpty) attachmentUrl!,
        ...attachmentUrls
            .where((url) => url.isNotEmpty && url != attachmentUrl),
        if (submission?.fileUrl != null && submission!.fileUrl!.isNotEmpty)
          submission!.fileUrl!,
      ];

  factory Assignment.fromJson(Map<String, dynamic> json) {
    final attachmentUrls = safeStringList(json['attachment_urls']);
    return Assignment(
      id: safeString(json['id']),
      classId: safeStringOrNull(json['class_id']),
      sectionId: safeStringOrNull(json['section_id']),
      subjectId: safeStringOrNull(json['subject_id']),
      subjectName: safeStringOrNull(json['subject_name']) ??
          safeStringOrNull(json['subject']),
      title: safeString(json['title']),
      description: safeStringOrNull(json['description']),
      dueDate: safeStringOrNull(json['due_date']),
      dueDateBs: safeStringOrNull(json['due_date_bs']),
      maxMarks: safeIntOrNull(json['max_marks']) ??
          safeIntOrNull(json['total_marks']),
      attachmentUrl: safeStringOrNull(json['attachment_url']) ??
          (attachmentUrls.isNotEmpty ? attachmentUrls.first : null),
      attachmentUrls: attachmentUrls,
      createdById: safeStringOrNull(json['created_by_id']),
      createdByName: safeStringOrNull(json['created_by_name']),
      isOverdue: safeBool(json['is_overdue']),
      submissionStatus: safeStringOrNull(json['submission_status']),
      submission: json['submission'] is Map
          ? AssignmentSubmission.fromJson(safeMap(json['submission']))
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'due_date': dueDate,
        'max_marks': maxMarks,
        'class_id': classId,
        'section_id': sectionId,
        'subject_id': subjectId,
      };
}

extension AssignmentListFilters on List<Assignment> {
  List<Assignment> get pending =>
      where((assignment) => assignment.isPending).toList();
  List<Assignment> get submitted =>
      where((assignment) => assignment.isSubmitted).toList();
}

class AssignmentSubmission {
  final String id;
  final String? studentId;
  final String? fileUrl;
  final String? remarks;
  final int? marksObtained;
  final String? feedback;
  final String? submittedAt;

  const AssignmentSubmission({
    required this.id,
    this.studentId,
    this.fileUrl,
    this.remarks,
    this.marksObtained,
    this.feedback,
    this.submittedAt,
  });

  factory AssignmentSubmission.fromJson(Map<String, dynamic> json) {
    return AssignmentSubmission(
      id: safeString(json['id']),
      studentId: safeStringOrNull(json['student_id']),
      fileUrl: safeStringOrNull(json['file_url']),
      remarks: safeStringOrNull(json['remarks']),
      marksObtained: safeIntOrNull(json['marks_obtained']),
      feedback: safeStringOrNull(json['feedback']),
      submittedAt: safeStringOrNull(json['submitted_at']),
    );
  }
}
