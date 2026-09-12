import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Post-submit score summary for an online exam (S-A2). Shown after a
/// successful submit or a 409 "already submitted" (score included) — the
/// detailed marksheet/report remains the teachers' concern for now.
class OnlineExamResultScreen extends StatelessWidget {
  final String examTitle;
  final OnlineExamSubmitResult result;
  final bool autoSubmitted;

  const OnlineExamResultScreen({
    super.key,
    required this.examTitle,
    required this.result,
    this.autoSubmitted = false,
  });

  Color get _scoreColor =>
      result.percentage >= 40 ? ASchoolTheme.success : ASchoolTheme.danger;

  String get _headline {
    if (result.alreadySubmitted) return 'Already submitted';
    if (autoSubmitted) return 'Time is up — exam submitted';
    return 'Exam submitted';
  }

  String get _subheadline {
    if (result.alreadySubmitted) {
      return 'This exam was already submitted earlier, so no new attempt '
          'was recorded.';
    }
    if (autoSubmitted) {
      return 'Your saved answers were submitted automatically.';
    }
    return 'Your answers have been submitted for grading.';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: dark ? ASchoolTheme.darkPageBackground : Colors.white,
      appBar: CustomAppBar(
        title: 'Result',
        showUtilities: false,
        onBackPressed: () => _backToExams(context),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    color: _scoreColor.withAlpha(25),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    result.alreadySubmitted
                        ? Icons.info_outline_rounded
                        : Icons.check_circle_outline_rounded,
                    size: 48,
                    color: _scoreColor,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  _headline,
                  style: theme.textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  _subheadline,
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: ASchoolTheme.mutedText),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  examTitle,
                  style: theme.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color:
                        dark ? ASchoolTheme.darkSurface : ASchoolTheme.tertiary,
                    borderRadius:
                        BorderRadius.circular(ASchoolTheme.radiusLg),
                    border: Border.all(
                      color: dark
                          ? ASchoolTheme.darkBorder
                          : Colors.grey.shade200,
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _ScoreColumn(
                          label: 'Score',
                          value: _formatMarks(result.score),
                          color: _scoreColor,
                        ),
                      ),
                      Container(
                          width: 1,
                          height: 40,
                          color: Colors.grey.withAlpha(60)),
                      Expanded(
                        child: _ScoreColumn(
                          label: 'Total marks',
                          value: _formatMarks(result.totalMarks),
                          color: ASchoolTheme.mutedText,
                        ),
                      ),
                      Container(
                          width: 1,
                          height: 40,
                          color: Colors.grey.withAlpha(60)),
                      Expanded(
                        child: _ScoreColumn(
                          label: 'Percentage',
                          value:
                              '${result.percentage.toStringAsFixed(1)}%',
                          color: _scoreColor,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => _backToExams(context),
                    style: FilledButton.styleFrom(
                      backgroundColor: ASchoolTheme.primary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: const Icon(Icons.arrow_back_rounded, size: 20),
                    label: const Text('Back to exams'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatMarks(double value) => value % 1 == 0
      ? value.toInt().toString()
      : value.toStringAsFixed(1);

  void _backToExams(BuildContext context) {
    // Pop back to the exams list. The runner screen was replaced by this
    // one, so its dispose has already released the wakelock.
    Navigator.of(context).popUntil((route) => route.isFirst);
  }
}

class _ScoreColumn extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _ScoreColumn({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Text(
          value,
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: theme.textTheme.bodySmall
              ?.copyWith(color: ASchoolTheme.mutedText),
        ),
      ],
    );
  }
}
