import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

class StudentResults extends ConsumerWidget {
  const StudentResults({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(resultsProvider);

    return Scaffold(
      appBar: const CustomAppBar(
        title: 'Results & Reports',
        showBackButton: false,
      ),
      body: PullToRefresh(
        onRefresh: () => ref.read(resultsProvider.notifier).refresh(),
        child: state.when(
          loading: () => const ShimmerLoadingList(),
          error: (error, stack) => ErrorContainer(
            errorMessage: error.toString(),
            onRetry: () => ref.read(resultsProvider.notifier).refresh(),
          ),
          data: (exams) {
            if (exams.isEmpty) {
              return const NoDataContainer(
                title: 'No results published yet',
                subtitle:
                    'Your exam results will appear here once they are graded and published.',
                icon: Icons.emoji_events_outlined,
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: exams.length,
              itemBuilder: (context, index) {
                return _ExamResultCard(result: exams[index]);
              },
            );
          },
        ),
      ),
    );
  }
}

class _ExamResultCard extends StatelessWidget {
  final ExamResult result;

  const _ExamResultCard({required this.result});

  static Color _gradeColor(String grade) {
    switch (grade) {
      case 'A+':
        return const Color(0xFF1B5E20);
      case 'A':
        return Colors.green;
      case 'B+':
        return Colors.blue;
      case 'B':
        return Colors.indigo;
      case 'C+':
        return Colors.orange;
      case 'C':
        return Colors.deepOrange;
      default:
        return Colors.red;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final overallGrade = result.grade;
    final gradeColor = _gradeColor(overallGrade);

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      shadowColor: Colors.black.withAlpha(20),
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          leading: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: gradeColor.withAlpha(20),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Text(
                overallGrade,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 22,
                  color: gradeColor,
                ),
              ),
            ),
          ),
          title: Text(
            result.examName,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 4),
              Row(
                children: [
                  _MiniStat(
                      label: 'Score',
                      value: '${result.percentage.toStringAsFixed(1)}%'),
                  const SizedBox(width: 16),
                  _MiniStat(label: 'GPA', value: result.gpa.toStringAsFixed(2)),
                  if (result.rank != null) ...[
                    const SizedBox(width: 16),
                    _MiniStat(label: 'Rank', value: '#${result.rank}'),
                  ],
                ],
              ),
            ],
          ),
          children: [
            // Subject-wise results table
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade200),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  // Table header
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius:
                          const BorderRadius.vertical(top: Radius.circular(12)),
                    ),
                    child: const Row(
                      children: [
                        Expanded(
                            flex: 3,
                            child: Text('Subject',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                    color: Colors.black54))),
                        Expanded(
                            child: Text('Full',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                    color: Colors.black54))),
                        Expanded(
                            child: Text('Got',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                    color: Colors.black54))),
                        Expanded(
                            child: Text('Grade',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                    color: Colors.black54))),
                      ],
                    ),
                  ),
                  if (result.subjects.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: const BorderRadius.vertical(
                            bottom: Radius.circular(12)),
                      ),
                      child: const Text(
                        'Subject-wise marks are not published yet.',
                        style: TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    )
                  else
                    ...result.subjects.asMap().entries.map((entry) {
                      final i = entry.key;
                      final sub = entry.value;
                      final got = safeNumOrNull(sub['obtained']) ??
                          safeNumOrNull(sub['obtained_marks']) ??
                          0;
                      final full = safeNumOrNull(sub['full_marks']) ?? 100;
                      final pct = full > 0 ? (got / full * 100) : 0;
                      final failed = pct < 40;
                      final grade = sub['grade']?.toString() ?? 'N/A';
                      final sGradeColor = _gradeColor(grade);

                      return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: failed
                              ? Colors.red.withAlpha(15)
                              : (i.isEven ? Colors.white : Colors.grey.shade50),
                          border: i < result.subjects.length - 1
                              ? Border(
                                  bottom:
                                      BorderSide(color: Colors.grey.shade200),
                                )
                              : null,
                          borderRadius: i == result.subjects.length - 1
                              ? const BorderRadius.vertical(
                                  bottom: Radius.circular(12))
                              : BorderRadius.zero,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: Text(
                                sub['subject']?.toString() ??
                                    sub['subject_name']?.toString() ??
                                    '',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: failed
                                      ? Colors.red.shade700
                                      : Colors.black87,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                '$full',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    fontSize: 13, color: Colors.grey.shade600),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                '$got',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: failed
                                      ? Colors.red.shade700
                                      : Colors.black87,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Center(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: sGradeColor.withAlpha(20),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    grade,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: sGradeColor,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                if ((result.examId ?? '').isNotEmpty) ...[
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () =>
                          context.go('/results/marksheet/${result.examId}'),
                      icon: const Icon(Icons.receipt_long_rounded, size: 18),
                      label: const Text('Marksheet'),
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.go('/dashboard/ai-tutor'),
                    icon: const Icon(Icons.smart_toy_rounded, size: 18),
                    label: const Text('AI Insights'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: BorderSide(
                          color: ASchoolTheme.primary.withAlpha(100)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label, value;
  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        Text(label,
            style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade500,
                fontWeight: FontWeight.w500)),
      ],
    );
  }
}
