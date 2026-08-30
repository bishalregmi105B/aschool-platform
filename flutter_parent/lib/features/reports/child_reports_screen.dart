import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

class ChildReportsScreen extends ConsumerWidget {
  const ChildReportsScreen({super.key});

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
      data: (reports) {
        if (reports.isEmpty) {
          return RefreshIndicator(
            onRefresh: () =>
                ref.refresh(parentResultsProvider(selectedChildId).future),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [
                SizedBox(height: 120),
                NoDataContainer(
                  title: 'No reports available',
                  subtitle: 'Detailed child report cards will appear here.',
                  icon: Icons.bar_chart_rounded,
                ),
              ],
            ),
          );
        }

        final summary = _ReportsSummary.fromReports(reports);
        final trends = _SubjectTrend.fromReports(reports);

        return DefaultTabController(
          length: 2,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                child: _SummaryHeader(summary: summary),
              ),
              const TabBar(
                labelColor: ASchoolTheme.primary,
                unselectedLabelColor: ASchoolTheme.mutedText,
                indicatorColor: ASchoolTheme.primary,
                tabs: [
                  Tab(text: 'Exam Reports'),
                  Tab(text: 'Subject Trends'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    RefreshIndicator(
                      onRefresh: () => ref.refresh(
                          parentResultsProvider(selectedChildId).future),
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(16),
                        itemCount: reports.length,
                        itemBuilder: (_, index) => _ReportCard(
                          report: reports[index],
                          index: index,
                          studentId: selectedChildId,
                        ),
                      ),
                    ),
                    RefreshIndicator(
                      onRefresh: () => ref.refresh(
                          parentResultsProvider(selectedChildId).future),
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(16),
                        itemCount: trends.length,
                        itemBuilder: (_, index) => _SubjectTrendCard(
                          trend: trends[index],
                          index: index,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SummaryHeader extends StatelessWidget {
  final _ReportsSummary summary;

  const _SummaryHeader({required this.summary});

  @override
  Widget build(BuildContext context) {
    return ESchoolCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Child Performance Overview',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: StatCard(
                  title: 'Avg Score',
                  value: '${summary.averagePct.toStringAsFixed(1)}%',
                  icon: Icons.analytics_rounded,
                  color: ASchoolTheme.primary,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: StatCard(
                  title: 'Best Rank',
                  value: summary.bestRank > 0 ? '#${summary.bestRank}' : '-',
                  icon: Icons.emoji_events_rounded,
                  color: ASchoolTheme.warning,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: StatCard(
                  title: 'Exams',
                  value: '${summary.totalExams}',
                  icon: Icons.assignment_turned_in_rounded,
                  color: ASchoolTheme.success,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Top exam: ${summary.topExamName} (${summary.topExamPct.toStringAsFixed(1)}%)',
            style: const TextStyle(
              fontSize: 12,
              color: ASchoolTheme.mutedText,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final ExamResult report;
  final int index;
  final String? studentId;

  const _ReportCard({
    required this.report,
    required this.index,
    required this.studentId,
  });

  @override
  Widget build(BuildContext context) {
    final pct = report.percentage;
    final gradeColor = _gradeColor(pct);

    return ESchoolAnimatedEntry(
      index: index,
      child: ESchoolCard(
        margin: const EdgeInsets.only(bottom: 12),
        padding: EdgeInsets.zero,
        child: ExpansionTile(
          title: Text(
            report.examName,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          subtitle: Text(
            '${pct.toStringAsFixed(1)}% • Rank: ${report.rank == null ? '-' : '#${report.rank}'} • GPA: ${report.gpa.toStringAsFixed(2)}',
          ),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: gradeColor.withAlpha(24),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              _gradeLabel(pct),
              style: TextStyle(color: gradeColor, fontWeight: FontWeight.w700),
            ),
          ),
          children: [
            for (final subject in report.subjects)
              ListTile(
                dense: true,
                title: Text(subject['subject']?.toString() ?? 'Subject'),
                subtitle: Text(
                    '${((safeDoubleOrNull(subject['obtained'])) ?? 0).toStringAsFixed(0)} / ${((safeDoubleOrNull(subject['full_marks'])) ?? 0).toStringAsFixed(0)}'),
                trailing: Text(
                  '${_subjectPercentage(subject).toStringAsFixed(1)}%',
                  style: TextStyle(
                    color: _gradeColor(_subjectPercentage(subject)),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            if ((report.examId ?? '').isNotEmpty &&
                studentId != null &&
                studentId!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => context.go(
                      '/results/marksheet/${report.examId}/$studentId',
                    ),
                    icon: const Icon(Icons.receipt_long_rounded, size: 18),
                    label: const Text('View Marksheet'),
                  ),
                ),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _SubjectTrendCard extends StatelessWidget {
  final _SubjectTrend trend;
  final int index;

  const _SubjectTrendCard({required this.trend, required this.index});

  @override
  Widget build(BuildContext context) {
    return ESchoolAnimatedEntry(
      index: index,
      child: ESchoolCard(
        margin: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    trend.subject,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Best ${trend.best.toStringAsFixed(1)}% • Worst ${trend.worst.toStringAsFixed(1)}%',
                    style: const TextStyle(
                      color: ASchoolTheme.mutedText,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: _gradeColor(trend.average).withAlpha(22),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${trend.average.toStringAsFixed(1)}%',
                style: TextStyle(
                  color: _gradeColor(trend.average),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReportsSummary {
  final int totalExams;
  final double averagePct;
  final int bestRank;
  final String topExamName;
  final double topExamPct;

  const _ReportsSummary({
    required this.totalExams,
    required this.averagePct,
    required this.bestRank,
    required this.topExamName,
    required this.topExamPct,
  });

  factory _ReportsSummary.fromReports(List<ExamResult> reports) {
    final avg =
        reports.fold<double>(0, (sum, report) => sum + report.percentage) /
            reports.length;

    final bestRank = reports
        .where((report) => report.rank != null && report.rank! > 0)
        .map((report) => report.rank!)
        .fold<int>(0, (best, rank) => best == 0 || rank < best ? rank : best);

    final sorted = [...reports]
      ..sort((a, b) => b.percentage.compareTo(a.percentage));

    final top = sorted.first;
    return _ReportsSummary(
      totalExams: reports.length,
      averagePct: avg,
      bestRank: bestRank,
      topExamName: top.examName,
      topExamPct: top.percentage,
    );
  }
}

class _SubjectTrend {
  final String subject;
  final double average;
  final double best;
  final double worst;

  const _SubjectTrend({
    required this.subject,
    required this.average,
    required this.best,
    required this.worst,
  });

  static List<_SubjectTrend> fromReports(List<ExamResult> reports) {
    final bySubject = <String, List<double>>{};
    for (final report in reports) {
      for (final subject in report.subjects) {
        final name = subject['subject']?.toString() ?? 'Subject';
        bySubject.putIfAbsent(name, () => []).add(_subjectPercentage(subject));
      }
    }

    final trends = bySubject.entries.map((entry) {
      final values = entry.value;
      final average = values.reduce((a, b) => a + b) / values.length;
      final sorted = [...values]..sort();
      return _SubjectTrend(
        subject: entry.key,
        average: average,
        best: sorted.last,
        worst: sorted.first,
      );
    }).toList();

    trends.sort((a, b) => b.average.compareTo(a.average));
    return trends;
  }
}

double _subjectPercentage(Map<String, dynamic> subject) {
  final obtained = safeDoubleOrNull(subject['obtained']) ?? 0;
  final fullMarks = safeDoubleOrNull(subject['full_marks']) ?? 0;
  return fullMarks == 0 ? 0 : (obtained / fullMarks) * 100;
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
