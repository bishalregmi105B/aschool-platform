import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

// --- State Management ---

final teacherAssignmentsProvider =
    FutureProvider.autoDispose<Map<String, List<Map<String, dynamic>>>>(
        (ref) async {
  final resp = await ApiClient.instance.get('/teacher/assignments');
  final all = List<Map<String, dynamic>>.from(resp.data['data'] ?? []);

  final active = all.where((a) => a['status'] == 'active').toList();
  final past = all.where((a) => a['status'] != 'active').toList();

  return {
    'active': active,
    'past': past,
  };
});

final assignmentClassesProvider =
    FutureProvider.autoDispose<List<ClassModel>>((ref) async {
  final academicRepo = ref.read(academicRepositoryProvider);
  return await academicRepo.getClasses();
});

final assignmentSubjectsProvider = FutureProvider.autoDispose
    .family<List<Subject>, String>((ref, classId) async {
  final academicRepo = ref.read(academicRepositoryProvider);
  return await academicRepo.getSubjects(classId: classId);
});

final assignmentSubmissionsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, assignmentId) async {
  final resp =
      await ApiClient.instance.get('/assignments/$assignmentId/submissions');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
});

// --- UI ---

class AssignmentsScreen extends ConsumerStatefulWidget {
  const AssignmentsScreen({super.key});

  @override
  ConsumerState<AssignmentsScreen> createState() => _AssignmentsScreenState();
}

class _AssignmentsScreenState extends ConsumerState<AssignmentsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  void _showCreateSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withAlpha(22),
      builder: (_) => _CreateAssignmentSheet(
        onSuccess: () {
          ref.invalidate(teacherAssignmentsProvider);
          Navigator.pop(context);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(teacherAssignmentsProvider);

    return Scaffold(
      body: Column(
        children: [
          // Header with Create Button
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: FilledButton.icon(
                onPressed: _showCreateSheet,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Create New Assignment',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                style: FilledButton.styleFrom(
                  backgroundColor: ASchoolTheme.primary,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ),

          // Custom Tab Bar
          Container(
            color: Colors.white,
            child: TabBar(
              controller: _tabCtrl,
              labelColor: ASchoolTheme.primary,
              unselectedLabelColor: Colors.grey,
              indicatorColor: ASchoolTheme.primary,
              indicatorWeight: 3,
              labelStyle:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
              tabs: const [
                Tab(text: 'Active'),
                Tab(text: 'Past'),
              ],
            ),
          ),
          const Divider(height: 1),

          // Tab Views
          Expanded(
            child: PullToRefresh(
              onRefresh: () => ref.refresh(teacherAssignmentsProvider.future),
              child: state.when(
                loading: () => const ShimmerLoadingList(),
                error: (err, _) => ErrorContainer(
                  errorMessage: err.toString(),
                  onRetry: () => ref.refresh(teacherAssignmentsProvider.future),
                ),
                data: (data) {
                  return TabBarView(
                    controller: _tabCtrl,
                    children: [
                      _buildList(data['active'] ?? []),
                      _buildList(data['past'] ?? []),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList(List<Map<String, dynamic>> items) {
    if (items.isEmpty) {
      return const Center(
        child: NoDataContainer(
          title: 'No Assignments',
          subtitle: 'You have no assignments in this category.',
          icon: Icons.assignment_turned_in_rounded,
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16).copyWith(bottom: 100),
      itemCount: items.length,
      itemBuilder: (_, i) => _AssignmentCard(assignment: items[i]),
    );
  }
}

class _AssignmentCard extends ConsumerWidget {
  final Map<String, dynamic> assignment;

  const _AssignmentCard({required this.assignment});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final submitted = assignment['submitted_count'] ?? 0;
    final total = assignment['total_students'] ?? 1;
    final progress = total > 0 ? (submitted / total) : 0.0;

    final isPast = assignment['status'] != 'active';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 0,
      color: Colors.white,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade200),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: (isPast ? Colors.grey : ASchoolTheme.primary)
                          .withAlpha(20),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.assignment_rounded,
                      color: isPast ? Colors.grey : ASchoolTheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          assignment['title'] ?? 'Untitled Assignment',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${assignment['subject'] ?? ''} • ${assignment['class_name'] ?? ''}',
                          style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey.shade600,
                              fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                  if (!isPast)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                          color: Colors.red.withAlpha(20),
                          borderRadius: BorderRadius.circular(8)),
                      child: Row(
                        children: [
                          const Icon(Icons.timer_rounded,
                              size: 12, color: Colors.red),
                          const SizedBox(width: 4),
                          Text((assignment['due_date'] ?? '').isNotEmpty ? adToBsString(DateTime.tryParse(assignment['due_date']!) ?? DateTime.now()) : '',
                              style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.red)),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Submission Progress',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey.shade600)),
                  Text('$submitted / $total',
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 6,
                  color: progress == 1.0 ? Colors.green : ASchoolTheme.primary,
                  backgroundColor: Colors.grey.shade200,
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => _showSubmissionsSheet(context),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                    side: BorderSide(color: Colors.grey.shade300),
                  ),
                  child: const Text('View Submissions'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSubmissionsSheet(BuildContext context) {
    CustomBottomSheet.show<void>(
      context: context,
      title: 'Submissions',
      height: MediaQuery.of(context).size.height * 0.86,
      child: _AssignmentSubmissionsSheet(assignment: assignment),
    );
  }
}

class _AssignmentSubmissionsSheet extends ConsumerWidget {
  final Map<String, dynamic> assignment;

  const _AssignmentSubmissionsSheet({required this.assignment});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentId = assignment['id']?.toString() ?? '';
    final state = ref.watch(assignmentSubmissionsProvider(assignmentId));

    return state.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: ErrorContainer(
          errorMessage: err.toString(),
          onRetry: () => ref.refresh(
            assignmentSubmissionsProvider(assignmentId).future,
          ),
        ),
      ),
      data: (submissions) {
        if (submissions.isEmpty) {
          return const Center(
            child: NoDataContainer(
              title: 'No submissions yet',
              subtitle: 'Submitted work will appear here.',
              icon: Icons.assignment_late_rounded,
            ),
          );
        }

        final gradedCount =
            submissions.where((item) => item['status'] == 'graded').length;
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                children: [
                  _SubmissionStat(
                    label: 'Submitted',
                    value: submissions.length.toString(),
                    color: ASchoolTheme.primary,
                  ),
                  const SizedBox(width: 12),
                  _SubmissionStat(
                    label: 'Graded',
                    value: gradedCount.toString(),
                    color: Colors.green,
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                itemCount: submissions.length,
                itemBuilder: (context, index) => _SubmissionTile(
                  assignment: assignment,
                  submission: submissions[index],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SubmissionStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _SubmissionStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withAlpha(20),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withAlpha(45)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade700,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubmissionTile extends ConsumerWidget {
  final Map<String, dynamic> assignment;
  final Map<String, dynamic> submission;

  const _SubmissionTile({
    required this.assignment,
    required this.submission,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = submission['status']?.toString() ?? 'submitted';
    final graded = status == 'graded';
    final studentName = submission['student_name']?.toString().trim();
    final rollNumber = submission['roll_number']?.toString();
    final content = submission['content']?.toString().trim();
    final attachments =
        List<String>.from(submission['attachment_urls'] ?? const []);
    final marks = submission['marks_obtained'] ?? submission['marks'];
    final maxMarks = submission['max_marks'] ?? assignment['max_marks'];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      color: Colors.white,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade200),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  backgroundColor: ASchoolTheme.primary.withAlpha(22),
                  foregroundColor: ASchoolTheme.primary,
                  backgroundImage: _photoProvider(submission),
                  child: _photoProvider(submission) == null
                      ? const Icon(Icons.person_rounded)
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        studentName?.isNotEmpty == true
                            ? studentName!
                            : 'Student',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          if (rollNumber != null && rollNumber.isNotEmpty)
                            'Roll $rollNumber',
                          _formatDate(submission['submitted_at']),
                        ].where((item) => item.isNotEmpty).join(' • '),
                        style: TextStyle(
                          color: Colors.grey.shade600,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                _StatusPill(graded: graded),
              ],
            ),
            if (content != null && content.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                content,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.grey.shade800, height: 1.35),
              ),
            ],
            if (attachments.isNotEmpty) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(Icons.attach_file_rounded,
                      size: 16, color: Colors.grey.shade600),
                  const SizedBox(width: 4),
                  Text(
                    '${attachments.length} attachment${attachments.length == 1 ? '' : 's'}',
                    style: TextStyle(
                      color: Colors.grey.shade700,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                if (marks != null)
                  Text(
                    'Marks: ${_formatNumber(marks)}${maxMarks != null ? ' / ${_formatNumber(maxMarks)}' : ''}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  )
                else
                  Text(
                    maxMarks != null
                        ? 'Not graded / ${_formatNumber(maxMarks)}'
                        : 'Not graded',
                    style: TextStyle(
                      color: Colors.grey.shade700,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                const Spacer(),
                FilledButton.tonalIcon(
                  onPressed: () => _showGradeDialog(context, ref),
                  icon: Icon(graded ? Icons.edit_rounded : Icons.grade_rounded),
                  label: Text(graded ? 'Update Grade' : 'Grade'),
                ),
              ],
            ),
            if ((submission['feedback']?.toString().trim().isNotEmpty ??
                false)) ...[
              const SizedBox(height: 8),
              Text(
                submission['feedback'].toString(),
                style: TextStyle(
                  color: Colors.grey.shade700,
                  fontSize: 13,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  ImageProvider? _photoProvider(Map<String, dynamic> submission) {
    final photoUrl = submission['photo_url']?.toString();
    if (photoUrl == null || photoUrl.isEmpty) return null;
    return NetworkImage(photoUrl);
  }

  void _showGradeDialog(BuildContext context, WidgetRef ref) {
    final assignmentId = assignment['id']?.toString() ?? '';
    final submissionId = submission['id']?.toString() ?? '';
    final marksCtrl = TextEditingController(
      text: (submission['marks_obtained'] ?? submission['marks'])?.toString() ??
          '',
    );
    final feedbackCtrl = TextEditingController(
      text: submission['feedback']?.toString() ?? '',
    );

    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        var saving = false;
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> saveGrade() async {
              final marks = num.tryParse(marksCtrl.text.trim());
              final maxMarks = num.tryParse(
                  (submission['max_marks'] ?? assignment['max_marks'])
                          ?.toString() ??
                      '');
              if (marks == null || marks < 0) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Enter valid marks')),
                );
                return;
              }
              if (maxMarks != null && marks > maxMarks) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                        'Marks cannot be more than ${_formatNumber(maxMarks)}'),
                  ),
                );
                return;
              }

              setDialogState(() => saving = true);
              try {
                await ApiClient.instance.post(
                  '/assignments/$assignmentId/submissions/$submissionId/grade',
                  data: {
                    'marks': marks,
                    'feedback': feedbackCtrl.text.trim(),
                  },
                );
                ref.invalidate(assignmentSubmissionsProvider(assignmentId));
                ref.invalidate(teacherAssignmentsProvider);
                if (context.mounted) Navigator.pop(context);
                if (dialogContext.mounted) {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(
                    const SnackBar(content: Text('Grade saved')),
                  );
                }
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Failed to save grade')),
                  );
                  setDialogState(() => saving = false);
                }
              }
            }

            return ESchoolDialog(
              icon: Icons.assignment_turned_in_outlined,
              title: 'Grade Submission',
              subtitle: 'Enter marks and optional feedback.',
              actions: [
                ESchoolSecondaryButton(
                  label: 'Cancel',
                  onPressed: saving ? null : () => Navigator.pop(context),
                ),
                ESchoolPrimaryButton(
                  label: 'Save',
                  busy: saving,
                  onPressed: saving ? null : saveGrade,
                ),
              ],
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ESchoolTextEditor(
                    controller: marksCtrl,
                    label: 'Marks',
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    suffixText: (submission['max_marks'] ??
                                assignment['max_marks']) !=
                            null
                        ? '/ ${_formatNumber(submission['max_marks'] ?? assignment['max_marks'])}'
                        : null,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 10),
                  ESchoolTextEditor(
                    controller: feedbackCtrl,
                    label: 'Feedback',
                    maxLines: 3,
                  ),
                ],
              ),
            );
          },
        );
      },
    ).whenComplete(() {
      marksCtrl.dispose();
      feedbackCtrl.dispose();
    });
  }

  static String _formatDate(dynamic value) {
    final text = value?.toString() ?? '';
    if (text.length >= 10) return text.substring(0, 10);
    return text;
  }

  static String _formatNumber(dynamic value) {
    if (value is num && value % 1 == 0) return value.toInt().toString();
    final parsed = num.tryParse(value?.toString() ?? '');
    if (parsed == null) return value?.toString() ?? '';
    if (parsed % 1 == 0) return parsed.toInt().toString();
    return parsed.toStringAsFixed(1);
  }
}

class _StatusPill extends StatelessWidget {
  final bool graded;

  const _StatusPill({required this.graded});

  @override
  Widget build(BuildContext context) {
    final color = graded ? Colors.green : Colors.orange;
    final foregroundColor =
        graded ? Colors.green.shade700 : Colors.orange.shade800;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha(22),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        graded ? 'Graded' : 'Submitted',
        style: TextStyle(
          color: foregroundColor,
          fontWeight: FontWeight.bold,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _CreateAssignmentSheet extends ConsumerStatefulWidget {
  final VoidCallback onSuccess;

  const _CreateAssignmentSheet({required this.onSuccess});

  @override
  ConsumerState<_CreateAssignmentSheet> createState() =>
      _CreateAssignmentSheetState();
}

class _CreateAssignmentSheetState
    extends ConsumerState<_CreateAssignmentSheet> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String? _selectedClassId;
  String? _selectedSubjectId;
  DateTime? _dueDate;
  bool _saving = false;

  Future<void> _submit() async {
    if (_titleCtrl.text.trim().isEmpty ||
        _selectedClassId == null ||
        _selectedSubjectId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Please fill all required fields'),
          backgroundColor: Colors.orange));
      return;
    }

    setState(() => _saving = true);

    try {
      await ApiClient.instance.post('/teacher/assignments', data: {
        'title': _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'class_id': _selectedClassId,
        'subject_id': _selectedSubjectId,
        'due_date': _dueDate?.toIso8601String(),
      });
      widget.onSuccess();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Failed to create assignment'),
            backgroundColor: Colors.red));
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final classesState = ref.watch(assignmentClassesProvider);

    return CustomBottomSheet(
      title: 'New Assignment',
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _titleCtrl,
              decoration: InputDecoration(
                labelText: 'Assignment Title',
                labelStyle: const TextStyle(fontSize: 14),
                filled: true,
                fillColor: Colors.grey.shade50,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                prefixIcon: const Icon(Icons.title_rounded, size: 20),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _descCtrl,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: 'Description / Instructions',
                labelStyle: const TextStyle(fontSize: 14),
                filled: true,
                fillColor: Colors.grey.shade50,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 14),
            classesState.when(
              loading: () => const CircularProgressIndicator(),
              error: (_, __) => const Text('Error loading classes'),
              data: (classes) => DropdownButtonFormField<String>(
                initialValue: _selectedClassId,
                decoration: InputDecoration(
                  labelText: 'Class Section',
                  labelStyle: const TextStyle(fontSize: 14),
                  filled: true,
                  fillColor: Colors.grey.shade50,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                  prefixIcon: const Icon(Icons.class_rounded, size: 20),
                ),
                items: classes
                    .map((c) =>
                        DropdownMenuItem(value: c.id, child: Text(c.name)))
                    .toList(),
                onChanged: (v) {
                  setState(() {
                    _selectedClassId = v;
                    _selectedSubjectId = null;
                  });
                },
              ),
            ),
            const SizedBox(height: 14),
            if (_selectedClassId != null)
              Consumer(builder: (context, ref, child) {
                final subjectsState =
                    ref.watch(assignmentSubjectsProvider(_selectedClassId!));
                return subjectsState.when(
                  loading: () => const CircularProgressIndicator(),
                  error: (_, __) => const Text('Error loading subjects'),
                  data: (subjects) => DropdownButtonFormField<String>(
                    initialValue: _selectedSubjectId,
                    decoration: InputDecoration(
                      labelText: 'Subject',
                      labelStyle: const TextStyle(fontSize: 14),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                      prefixIcon: const Icon(Icons.book_rounded, size: 20),
                    ),
                    items: subjects
                        .map((s) =>
                            DropdownMenuItem(value: s.id, child: Text(s.name)))
                        .toList(),
                    onChanged: (v) => setState(() => _selectedSubjectId = v),
                  ),
                );
              }),
            const SizedBox(height: 14),
            InkWell(
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: DateTime.now().add(const Duration(days: 1)),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (date != null) setState(() => _dueDate = date);
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_rounded,
                        color: Colors.grey, size: 18),
                    const SizedBox(width: 12),
                    Text(
                      _dueDate == null
                          ? 'Select Due Date'
                          : adToBsString(_dueDate!),
                      style: TextStyle(
                        fontSize: 14,
                        color: _dueDate == null ? Colors.grey.shade600 : null,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: ASchoolTheme.primary,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _saving
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Create Assignment',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
