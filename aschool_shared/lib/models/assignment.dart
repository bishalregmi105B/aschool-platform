/// Assignment model — maps to backend Assignment (assignments table)
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
    return Assignment(
      id: json['id'] as String,
      classId: json['class_id'] as String?,
      sectionId: json['section_id'] as String?,
      subjectId: json['subject_id'] as String?,
      subjectName:
          json['subject_name'] as String? ?? json['subject'] as String?,
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      dueDate: json['due_date'] as String?,
      dueDateBs: json['due_date_bs'] as String?,
      maxMarks: (json['max_marks'] as num?)?.toInt() ??
          (json['total_marks'] as num?)?.toInt(),
      attachmentUrl: json['attachment_url'] as String? ??
          ((json['attachment_urls'] as List?)?.isNotEmpty == true
              ? (json['attachment_urls'] as List).first?.toString()
              : null),
      attachmentUrls: ((json['attachment_urls'] ?? []) as List)
          .map((e) => e.toString())
          .toList(),
      createdById: json['created_by_id'] as String?,
      createdByName: json['created_by_name'] as String?,
      isOverdue: json['is_overdue'] as bool? ?? false,
      submissionStatus: json['submission_status'] as String?,
      submission: json['submission'] != null
          ? AssignmentSubmission.fromJson(
              Map<String, dynamic>.from(json['submission']))
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
      id: json['id'] as String,
      studentId: json['student_id'] as String?,
      fileUrl: json['file_url'] as String?,
      remarks: json['remarks'] as String?,
      marksObtained: (json['marks_obtained'] as num?)?.toInt(),
      feedback: json['feedback'] as String?,
      submittedAt: json['submitted_at'] as String?,
    );
  }
}
