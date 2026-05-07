import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

final studentMarksheetProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, examId) async {
  final student = await ref.watch(currentStudentProvider.future);
  if (student == null) {
    throw Exception('Student profile not found');
  }

  final repo = ref.read(examRepositoryProvider);
  return repo.getMarksheet(examId, student.id);
});

class StudentMarksheetScreen extends ConsumerWidget {
  final String examId;

  const StudentMarksheetScreen({super.key, required this.examId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(studentMarksheetProvider(examId));

    return Scaffold(
      appBar: const CustomAppBar(
        title: 'Marksheet',
      ),
      body: PullToRefresh(
        onRefresh: () => ref.refresh(studentMarksheetProvider(examId).future),
        child: state.when(
          loading: () => const ShimmerLoadingList(itemCount: 6),
          error: (error, _) => ErrorContainer(
            errorMessage: error.toString(),
            onRetry: () => ref.refresh(studentMarksheetProvider(examId).future),
          ),
          data: (data) {
            final subjects = ((data['subjects'] as List?) ?? [])
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList();

            final totalObtained =
                (data['total_obtained'] as num?)?.toDouble() ?? 0;
            final totalFull = (data['total_full'] as num?)?.toDouble() ?? 0;
            final percentage = (data['percentage'] as num?)?.toDouble() ?? 0;
            final failedSubjects = (data['failed_subjects'] as int?) ?? 0;
            final status = (data['status']?.toString() ?? 'pass').toLowerCase();
            final isPass = status == 'pass';

            if (subjects.isEmpty) {
              return const NoDataContainer(
                title: 'Marksheet unavailable',
                subtitle: 'Subject-wise marks are not published yet.',
                icon: Icons.receipt_long_outlined,
              );
            }

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          data['exam_name']?.toString() ?? 'Exam',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          data['student_name']?.toString() ?? 'Student',
                          style: TextStyle(
                            color: Colors.grey.shade700,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _SummaryChip(
                              label: 'Score',
                              value:
                                  '${totalObtained.toStringAsFixed(1)} / ${totalFull.toStringAsFixed(1)}',
                            ),
                            _SummaryChip(
                              label: 'Percentage',
                              value: '${percentage.toStringAsFixed(1)}%',
                            ),
                            _SummaryChip(
                              label: 'Status',
                              value: isPass ? 'PASS' : 'FAIL',
                              color: isPass ? Colors.green : Colors.red,
                            ),
                            _SummaryChip(
                              label: 'Failed Subjects',
                              value: '$failedSubjects',
                              color: failedSubjects > 0
                                  ? Colors.red
                                  : ASchoolTheme.primary,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: const [
                        Expanded(
                          flex: 3,
                          child: Text(
                            'Subject',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Colors.black54,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            'Got',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Colors.black54,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            'Full',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Colors.black54,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            'Grade',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Colors.black54,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                ...subjects.map((subject) {
                  final obtained =
                      (subject['obtained_marks'] as num?)?.toDouble() ??
                          (subject['obtained'] as num?)?.toDouble() ??
                          0;
                  final full = (subject['full_marks'] as num?)?.toDouble() ?? 0;
                  final grade = subject['grade']?.toString() ?? '-';
                  final isSubjectPass = subject['pass'] != false;

                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 12),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: Text(
                              subject['subject_name']?.toString() ??
                                  subject['subject']?.toString() ??
                                  'Subject',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: isSubjectPass
                                    ? Colors.black87
                                    : Colors.red.shade700,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              obtained.toStringAsFixed(1),
                              textAlign: TextAlign.center,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              full.toStringAsFixed(1),
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey.shade700),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              grade,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: isSubjectPass
                                    ? ASchoolTheme.primary
                                    : Colors.red,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;

  const _SummaryChip({
    required this.label,
    required this.value,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? ASchoolTheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: chipColor.withAlpha(20),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: chipColor.withAlpha(60)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: chipColor,
            ),
          ),
        ],
      ),
    );
  }
}
