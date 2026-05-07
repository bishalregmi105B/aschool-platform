import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

class ResultsScreen extends ConsumerWidget {
  const ResultsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedChildId = ref.watch(selectedChildIdForApiProvider);
    final state = ref.watch(parentResultsProvider(selectedChildId));

    return state.when(
      loading: () => const LoadingShimmer(),
      error: (err, _) => ErrorContainer(
        errorMessage: err.toString(),
        onRetry: () => ref.invalidate(parentResultsProvider(selectedChildId)),
      ),
      data: (exams) => RefreshIndicator(
        onRefresh: () =>
            ref.refresh(parentResultsProvider(selectedChildId).future),
        child: exams.isEmpty
            ? ListView(
                children: const [
                  SizedBox(height: 120),
                  NoDataContainer(
                    title: 'No results published',
                    subtitle: 'Published report cards will appear here.',
                    icon: Icons.assessment_rounded,
                  ),
                ],
              )
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: exams.length,
                itemBuilder: (_, i) => ESchoolAnimatedEntry(
                  index: i,
                  child: _ExamCard(
                    result: exams[i],
                    studentId: selectedChildId,
                  ),
                ),
              ),
      ),
    );
  }
}

class _ExamCard extends StatelessWidget {
  final ExamResult result;
  final String? studentId;

  const _ExamCard({required this.result, required this.studentId});

  @override
  Widget build(BuildContext context) {
    final subjects = result.subjects;
    final totalObtained = result.marksObtained ??
        subjects.fold<double>(
          0,
          (sum, subject) =>
              sum + ((subject['obtained'] as num?)?.toDouble() ?? 0),
        );
    final totalFull = result.totalMarks ??
        subjects.fold<double>(
          0,
          (sum, subject) =>
              sum + ((subject['full_marks'] as num?)?.toDouble() ?? 0),
        );
    final pct = result.percentage;
    final examId = result.examId ?? '';
    final canOpenMarksheet =
        examId.isNotEmpty && studentId != null && studentId!.isNotEmpty;

    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 16),
      padding: EdgeInsets.zero,
      child: ExpansionTile(
        title: Text(
          result.examName,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          '${totalObtained.toStringAsFixed(1)}/${totalFull.toStringAsFixed(1)} • ${pct.toStringAsFixed(1)}% • Rank: ${result.rank ?? '-'}',
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: _gradeColor(pct).withAlpha(20),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            _gradeLabel(pct),
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: _gradeColor(pct),
            ),
          ),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Table(
              columnWidths: const {
                0: FlexColumnWidth(3),
                1: FlexColumnWidth(1),
                2: FlexColumnWidth(1),
                3: FlexColumnWidth(1),
              },
              children: [
                const TableRow(
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: Colors.grey, width: 0.5),
                    ),
                  ),
                  children: [
                    Padding(
                      padding: EdgeInsets.all(8),
                      child: Text(
                        'Subject',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    Text('Full', style: TextStyle(fontWeight: FontWeight.w600)),
                    Text('Got', style: TextStyle(fontWeight: FontWeight.w600)),
                    Text('Grade',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
                ...subjects.map((subject) {
                  final obtained =
                      (subject['obtained'] as num?)?.toDouble() ?? 0;
                  final full =
                      (subject['full_marks'] as num?)?.toDouble() ?? 100;
                  final subjectPct = full > 0 ? obtained / full * 100 : 0.0;
                  return TableRow(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: Text(subject['subject'] ?? ''),
                      ),
                      Text('${full.toInt()}'),
                      Text(
                        '${obtained.toInt()}',
                        style: TextStyle(
                          color: subjectPct < 40 ? ASchoolTheme.danger : null,
                        ),
                      ),
                      Text(
                        _gradeLabel(subjectPct),
                        style: TextStyle(color: _gradeColor(subjectPct)),
                      ),
                    ],
                  );
                }),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Total: ${totalObtained.toStringAsFixed(1)}/${totalFull.toStringAsFixed(1)}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'GPA: ${result.gpa.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                if ((result.remarks ?? '').isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    result.remarks!,
                    style: const TextStyle(
                      color: ASchoolTheme.mutedText,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
                if (canOpenMarksheet) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => context.go(
                        '/results/marksheet/$examId/${studentId!}',
                      ),
                      icon: const Icon(Icons.receipt_long_rounded, size: 18),
                      label: const Text('Open Marksheet'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _gradeLabel(double pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C+';
    if (pct >= 40) return 'C';
    return 'F';
  }

  Color _gradeColor(double pct) {
    if (pct >= 80) return ASchoolTheme.success;
    if (pct >= 60) return ASchoolTheme.primary;
    if (pct >= 40) return ASchoolTheme.warning;
    return ASchoolTheme.danger;
  }
}
