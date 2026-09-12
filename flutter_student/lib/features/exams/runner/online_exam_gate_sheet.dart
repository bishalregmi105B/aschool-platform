import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import 'online_exam_runner_screen.dart';

/// Entry gate for an online exam (S-A2, eSchool pattern): shows the exam
/// meta + instructions/T&C, requires an explicit "I agree" before START,
/// and turns a 409 (attempt already submitted) into a friendly
/// "already taken" state with the recorded score.
class OnlineExamGateSheet extends ConsumerStatefulWidget {
  final OnlineExam exam;

  const OnlineExamGateSheet({super.key, required this.exam});

  /// Convenience entry point.
  static Future<void> show(BuildContext context, OnlineExam exam) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => OnlineExamGateSheet(exam: exam),
    );
  }

  @override
  ConsumerState<OnlineExamGateSheet> createState() =>
      _OnlineExamGateSheetState();
}

class _OnlineExamGateSheetState extends ConsumerState<OnlineExamGateSheet> {
  bool _agreed = false;
  bool _starting = false;
  bool _alreadyTaken = false;
  double? _takenScore;
  String? _error;

  ExamRepository get _repo => ref.read(examRepositoryProvider);

  static const List<String> _defaultRules = [
    'The exam must be completed in one sitting — the timer on the server '
        'keeps running even if you close the app.',
    'Your answers are saved automatically after every change; reopening a '
        'live attempt restores them and the remaining time.',
    'Leaving the app for more than 5 seconds submits the exam automatically '
        'with your saved answers.',
    'The exam submits itself when the timer reaches zero.',
    'The exam can only be submitted once. Double-check your answers before '
        'you submit.',
  ];

  List<String> get _rules {
    final custom = widget.exam.instructions;
    if (custom == null || custom.trim().isEmpty) return _defaultRules;
    final lines = custom
        .split(RegExp(r'\n+|•|;'))
        .map((line) => line.trim().replaceAll(RegExp(r'^[-*\d.)\s]+'), ''))
        .where((line) => line.length > 2)
        .toList();
    return lines.isEmpty ? _defaultRules : lines;
  }

  Future<void> _start() async {
    if (!_agreed || _starting) return;
    setState(() {
      _starting = true;
      _error = null;
    });
    try {
      await _repo.startOnlineExam(widget.exam.id);
      if (!mounted) return;
      // Capture the navigator before closing the sheet — this context is
      // unmounted as soon as the sheet pops.
      final navigator = Navigator.of(context);
      navigator.pop();
      unawaited(navigator.push(MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => OnlineExamRunnerScreen(exam: widget.exam),
      )));
    } on OnlineExamAlreadySubmittedException catch (e) {
      if (!mounted) return;
      setState(() {
        _starting = false;
        _alreadyTaken = true;
        _takenScore = e.score;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _starting = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _starting = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;

    if (_alreadyTaken) return _buildAlreadyTaken(context, theme);

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: dark ? ASchoolTheme.darkBorder : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: ASchoolTheme.primary.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.computer_rounded,
                      color: ASchoolTheme.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.exam.title,
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.exam.subject,
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: ASchoolTheme.mutedText),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _ExamMeta(
                  icon: Icons.access_time_rounded,
                  label: '${widget.exam.durationMinutes} mins',
                ),
                const SizedBox(width: 16),
                _ExamMeta(
                  icon: Icons.quiz_outlined,
                  label: '${widget.exam.totalQuestions ?? '-'} questions',
                ),
                const SizedBox(width: 16),
                _ExamMeta(
                  icon: Icons.rule_rounded,
                  label: 'FM: ${widget.exam.totalMarks ?? '-'}',
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text('Instructions',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ..._rules.map(
              (rule) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 3),
                      child: Icon(Icons.check_circle_outline_rounded,
                          size: 14, color: ASchoolTheme.success),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        rule,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: dark
                              ? ASchoolTheme.darkTextMuted
                              : ASchoolTheme.mutedText,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => setState(() => _agreed = !_agreed),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Checkbox(
                      value: _agreed,
                      onChanged: (value) =>
                          setState(() => _agreed = value ?? false),
                      activeColor: ASchoolTheme.primary,
                    ),
                    const Expanded(
                      child: Text(
                        'I have read and agree to the exam rules',
                        style: TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: const TextStyle(
                    color: ASchoolTheme.danger, fontSize: 13),
              ),
            ],
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _agreed && !_starting ? _start : null,
                style: FilledButton.styleFrom(
                  backgroundColor: ASchoolTheme.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                icon: _starting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.play_arrow_rounded, size: 22),
                label: Text(_starting ? 'Starting…' : 'Start exam'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAlreadyTaken(BuildContext context, ThemeData theme) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: ASchoolTheme.warning.withAlpha(25),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.lock_outline_rounded,
                  size: 32, color: ASchoolTheme.warning),
            ),
            const SizedBox(height: 16),
            Text(
              'Already taken',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'You have already taken "${widget.exam.title}". Each online '
              'exam allows a single attempt.',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: ASchoolTheme.mutedText),
              textAlign: TextAlign.center,
            ),
            if (_takenScore != null) ...[
              const SizedBox(height: 16),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(
                  color: ASchoolTheme.success.withAlpha(20),
                  borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
                ),
                child: Text(
                  'Score: ${_takenScore! % 1 == 0 ? _takenScore!.toInt() : _takenScore!.toStringAsFixed(1)}'
                  '${widget.exam.totalMarks != null ? ' / ${widget.exam.totalMarks}' : ''}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: ASchoolTheme.success,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                style: FilledButton.styleFrom(
                  backgroundColor: ASchoolTheme.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('OK'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExamMeta extends StatelessWidget {
  final IconData icon;
  final String label;

  const _ExamMeta({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: ASchoolTheme.mutedText),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: ASchoolTheme.mutedText,
          ),
        ),
      ],
    );
  }
}
