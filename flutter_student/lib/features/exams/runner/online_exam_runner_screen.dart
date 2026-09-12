import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:aschool_shared/aschool_shared.dart';

import 'exam_math_text.dart';
import 'online_exam_result_screen.dart';
import 'online_exam_runner_state.dart';

/// Full-screen online-exam runner (S-A2): one question per page with
/// swipe/prev/next navigation, a question palette with answered state,
/// server-clock countdown, debounced per-question autosave and
/// auto-submit on time-out or a >5s absence (eSchool's anti-cheat).
class OnlineExamRunnerScreen extends ConsumerStatefulWidget {
  final OnlineExam exam;

  const OnlineExamRunnerScreen({super.key, required this.exam});

  @override
  ConsumerState<OnlineExamRunnerScreen> createState() =>
      _OnlineExamRunnerScreenState();
}

class _OnlineExamRunnerScreenState
    extends ConsumerState<OnlineExamRunnerScreen> with WidgetsBindingObserver {
  final PageController _pageController = PageController();
  bool _allowPop = false;

  OnlineExamRunnerNotifier get _notifier =>
      ref.read(onlineExamRunnerProvider(widget.exam).notifier);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Keep the screen awake for the whole attempt.
    unawaited(WakelockPlus.enable());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pageController.dispose();
    unawaited(WakelockPlus.disable());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      // eSchool's anti-cheat pattern: 5s away → auto-submit (resuming
      // inside the window cancels it).
      _notifier.onAppPaused();
    } else if (state == AppLifecycleState.resumed) {
      _notifier.onAppResumed();
    }
  }

  void _goTo(int index) {
    final state = ref.read(onlineExamRunnerProvider(widget.exam));
    if (state.questions.isEmpty) return;
    final clamped = index.clamp(0, state.questions.length - 1);
    _notifier.setCurrentIndex(clamped);
    if (_pageController.hasClients) {
      _pageController.animateToPage(
        clamped,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
      );
    }
  }

  /// Returns the chosen exit action, or null when dismissed.
  Future<String?> _confirmExit() {
    return showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Leave the exam?'),
        content: const Text(
          'The timer keeps running on the server and your answers are '
          'autosaved. You can also submit now and see your score.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, 'stay'),
            child: const Text('Keep going'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, 'exit'),
            child: const Text('Exit without submitting'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, 'submit'),
            child: const Text('Submit & exit'),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmSubmit() async {
    final state = ref.read(onlineExamRunnerProvider(widget.exam));
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Submit exam?'),
        content: Text(
          'You have answered ${state.answeredCount} of '
          '${state.questions.length} questions.'
          '${state.unansweredCount > 0 ? ' Unanswered questions score 0.' : ''}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _notifier.submitManually();
  }

  void _openPalette() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _QuestionPalette(
        exam: widget.exam,
        onSelect: (index) {
          Navigator.pop(context);
          _goTo(index);
        },
        onSubmit: () {
          Navigator.pop(context);
          _confirmSubmit();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = onlineExamRunnerProvider(widget.exam);

    // Navigate to the result when a submit succeeds (or 409-with-score).
    ref.listen(
      provider.select((s) => s.submitResult),
      (previous, next) {
        if (next == null || previous != null) return;
        if (!mounted) return;
        Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
          fullscreenDialog: true,
          builder: (_) => OnlineExamResultScreen(
            examTitle: widget.exam.title,
            result: next,
            autoSubmitted: ref
                .read(onlineExamRunnerProvider(widget.exam))
                .autoSubmitted,
          ),
        ));
      },
    );

    // Surface submit failures (window closed, network down) without kicking
    // the student out of the exam.
    ref.listen(
      provider.select((s) => s.submitError),
      (previous, next) {
        if (next == null || next == previous || !mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next),
            backgroundColor: ASchoolTheme.danger,
          ),
        );
      },
    );

    final state = ref.watch(provider);

    return PopScope(
      canPop: _allowPop,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        // Capture the navigator up-front; this State's context is invalid
        // across the dialog await-gap if the widget unmounted.
        final navigator = Navigator.of(context);
        final result = await _confirmExit();
        if (!mounted) return;
        switch (result) {
          case 'submit':
            await _notifier.submitManually(); // result opens via listener
            break;
          case 'exit':
            // Autosaved answers survive; the server clock keeps running.
            setState(() => _allowPop = true);
            navigator.pop();
            break;
          default:
            break; // stay in the exam
        }
      },
      child: Scaffold(
        backgroundColor: Theme.of(context).brightness == Brightness.dark
            ? ASchoolTheme.darkPageBackground
            : ASchoolTheme.surface,
        appBar: CustomAppBar(
          title: widget.exam.title,
          subtitle: widget.exam.subject,
          showUtilities: false,
          actions: [_TimerChip(seconds: state.remainingSeconds)],
        ),
        body: SafeArea(
          child: Column(
            children: [
              _SaveStatusStrip(state: state),
              Expanded(child: _buildBody(context, state)),
              _buildBottomBar(context, state),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, OnlineExamRunnerState state) {
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.loadError != null) {
      return ErrorContainer(
        errorMessage: state.loadError!,
        onRetry: _notifier.retryLoad,
      );
    }
    if (state.questions.isEmpty) {
      return const NoDataContainer(
        title: 'No questions',
        subtitle: 'This exam has no questions configured yet.',
        icon: Icons.quiz_outlined,
      );
    }
    return PageView.builder(
      controller: _pageController,
      itemCount: state.questions.length,
      onPageChanged: _notifier.setCurrentIndex,
      itemBuilder: (context, index) => _QuestionPage(
        question: state.questions[index],
        index: index,
        total: state.questions.length,
        answer: state.answers[state.questions[index].id],
        onSingleSelect: (optionId) =>
            _notifier.selectSingleOption(state.questions[index].id, optionId),
        onMultiToggle: (optionId) =>
            _notifier.toggleMultiOption(state.questions[index].id, optionId),
      ),
    );
  }

  Widget _buildBottomBar(BuildContext context, OnlineExamRunnerState state) {
    final canPrev = state.currentIndex > 0;
    final canNext = state.currentIndex < state.questions.length - 1;
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? ASchoolTheme.darkSurface
            : Colors.white,
        border: Border(
          top: BorderSide(
            color: Theme.of(context).brightness == Brightness.dark
                ? ASchoolTheme.darkBorder
                : Colors.grey.shade200,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: canPrev ? () => _goTo(state.currentIndex - 1) : null,
                  icon: const Icon(Icons.arrow_back_rounded, size: 18),
                  label: const Text('Prev'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: OutlinedButton.icon(
                  onPressed: _openPalette,
                  icon: const Icon(Icons.grid_view_rounded, size: 18),
                  label: Text(
                      '${state.answeredCount}/${state.questions.length}'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: canNext ? () => _goTo(state.currentIndex + 1) : null,
                  icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                  label: const Text('Next'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── app bar timer ───────────────────────────────────────────────────────────

class _TimerChip extends StatelessWidget {
  final int seconds;

  const _TimerChip({required this.seconds});

  String get _label {
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final secs = seconds % 60;
    if (hours > 0) {
      return '$hours:${minutes.toString().padLeft(2, '0')}:'
          '${secs.toString().padLeft(2, '0')}';
    }
    return '${minutes.toString().padLeft(2, '0')}:'
        '${secs.toString().padLeft(2, '0')}';
  }

  Color _color(bool dark) {
    if (seconds <= 60) return ASchoolTheme.danger;
    if (seconds <= 5 * 60) return ASchoolTheme.warning;
    return dark ? ASchoolTheme.darkTextPrimary : Colors.white;
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: (dark ? ASchoolTheme.darkElevatedSurface : Colors.white)
            .withAlpha(40),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.timer_outlined, size: 16, color: _color(dark)),
          const SizedBox(width: 6),
          Text(
            _label,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontFeatures: const [FontFeature.tabularFigures()],
              color: _color(dark),
            ),
          ),
        ],
      ),
    );
  }
}

// ── save indicator ──────────────────────────────────────────────────────────

class _SaveStatusStrip extends StatelessWidget {
  final OnlineExamRunnerState state;

  const _SaveStatusStrip({required this.state});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    IconData icon;
    String label;
    Color color;
    switch (state.saveStatus) {
      case AnswerSaveStatus.saved:
        icon = Icons.cloud_done_rounded;
        label = 'All answers saved';
        color = ASchoolTheme.success;
        break;
      case AnswerSaveStatus.saving:
        icon = Icons.cloud_upload_rounded;
        label = 'Saving…';
        color = ASchoolTheme.mutedText;
        break;
      case AnswerSaveStatus.pending:
        icon = Icons.schedule_rounded;
        label = 'Saving soon…';
        color = ASchoolTheme.mutedText;
        break;
      case AnswerSaveStatus.failed:
        icon = Icons.cloud_off_rounded;
        label = 'Not saved — will retry';
        color = ASchoolTheme.danger;
        break;
      case AnswerSaveStatus.idle:
        return const SizedBox.shrink();
    }
    return Container(
      width: double.infinity,
      color: Theme.of(context).brightness == Brightness.dark
          ? ASchoolTheme.darkSurface
          : Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(color: color),
          ),
          const Spacer(),
          Text(
            '${state.answeredCount} answered',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: ASchoolTheme.mutedText),
          ),
        ],
      ),
    );
  }
}

// ── one question page ───────────────────────────────────────────────────────

class _QuestionPage extends StatelessWidget {
  final Question question;
  final int index;
  final int total;
  final dynamic answer;
  final ValueChanged<String> onSingleSelect;
  final ValueChanged<String> onMultiToggle;

  const _QuestionPage({
    required this.question,
    required this.index,
    required this.total,
    required this.answer,
    required this.onSingleSelect,
    required this.onMultiToggle,
  });

  bool _isSelected(String optionId) {
    if (question.multi) {
      return answer is List && answer.contains(optionId);
    }
    return answer is String && answer == optionId;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final cardColor = dark ? ASchoolTheme.darkSurface : Colors.white;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Question ${index + 1} of $total',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              if (question.multi)
                const Padding(
                  padding: EdgeInsets.only(right: 8),
                  child: _MetaChip(
                    label: 'Select all that apply',
                    color: ASchoolTheme.warning,
                  ),
                ),
              _MetaChip(
                label: '${question.marks} mark${question.marks == 1 ? '' : 's'}',
                color: ASchoolTheme.primary,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cardColor,
              borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
              border: Border.all(
                color: dark ? ASchoolTheme.darkBorder : Colors.grey.shade200,
              ),
            ),
            child: ExamMathText(
              question.question,
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
              backgroundColor: cardColor,
            ),
          ),
          if (question.image != null && question.image!.isNotEmpty) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
              child: Image.network(
                question.image!,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (question.options.isEmpty)
            Text(
              'This question has no answer options.',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: ASchoolTheme.mutedText),
            )
          else
            ...question.options.map((option) {
              final selected = _isSelected(option.id);
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _OptionCard(
                  option: option,
                  selected: selected,
                  multi: question.multi,
                  onToggle: () => question.multi
                      ? onMultiToggle(option.id)
                      : onSingleSelect(option.id),
                ),
              );
            }),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final String label;
  final Color color;

  const _MetaChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  final AnswerOption option;
  final bool selected;
  final bool multi;
  final VoidCallback onToggle;

  const _OptionCard({
    required this.option,
    required this.selected,
    required this.multi,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final borderColor = selected
        ? ASchoolTheme.primary
        : dark
            ? ASchoolTheme.darkBorder
            : Colors.grey.shade300;
    final fillColor = selected
        ? ASchoolTheme.primary.withAlpha(15)
        : dark
            ? ASchoolTheme.darkSurface
            : Colors.white;

    return Material(
      color: fillColor,
      borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
      child: InkWell(
        onTap: onToggle,
        borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
            border: Border.all(color: borderColor, width: selected ? 1.5 : 1),
          ),
          child: Row(
            children: [
              Icon(
                selected
                    ? (multi
                        ? Icons.check_box_rounded
                        : Icons.check_circle_rounded)
                    : (multi
                        ? Icons.check_box_outline_blank_rounded
                        : Icons.radio_button_unchecked_rounded),
                size: 22,
                color: selected ? ASchoolTheme.primary : ASchoolTheme.mutedText,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ExamMathText(
                  option.text,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  ),
                  backgroundColor: fillColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── question palette bottom sheet ───────────────────────────────────────────

class _QuestionPalette extends ConsumerWidget {
  final OnlineExam exam;
  final ValueChanged<int> onSelect;
  final VoidCallback onSubmit;

  const _QuestionPalette({
    required this.exam,
    required this.onSelect,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(onlineExamRunnerProvider(exam));
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
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
            const SizedBox(height: 14),
            Row(
              children: [
                Text('Question palette',
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold)),
                const Spacer(),
                _PaletteCounter(
                  count: state.answeredCount,
                  label: 'Answered',
                  color: ASchoolTheme.success,
                ),
                const SizedBox(width: 10),
                _PaletteCounter(
                  count: state.unansweredCount,
                  label: 'Left',
                  color: ASchoolTheme.danger,
                ),
              ],
            ),
            const SizedBox(height: 14),
            Flexible(
              child: SingleChildScrollView(
                child: GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 6,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1,
                  ),
                  itemCount: state.questions.length,
                  itemBuilder: (context, index) => _PaletteCell(
                    number: index + 1,
                    answered: state.isAnswered(state.questions[index].id),
                    isCurrent: index == state.currentIndex,
                    onTap: () => onSelect(index),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: state.submitting ? null : onSubmit,
                style: FilledButton.styleFrom(
                  backgroundColor: ASchoolTheme.success,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                icon: state.submitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.check_rounded, size: 20),
                label: Text(
                    state.submitting ? 'Submitting…' : 'Submit exam'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaletteCounter extends StatelessWidget {
  final int count;
  final String label;
  final Color color;

  const _PaletteCounter({
    required this.count,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$count',
              style: TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 13, color: color)),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(fontSize: 12, color: color)),
        ],
      ),
    );
  }
}

class _PaletteCell extends StatelessWidget {
  final int number;
  final bool answered;
  final bool isCurrent;
  final VoidCallback onTap;

  const _PaletteCell({
    required this.number,
    required this.answered,
    required this.isCurrent,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fillColor =
        answered ? ASchoolTheme.success : (dark ? ASchoolTheme.darkSurface : Colors.white);
    final textColor = answered
        ? Colors.white
        : ASchoolTheme.danger;
    return Material(
      color: fillColor,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isCurrent
                  ? ASchoolTheme.primary
                  : answered
                      ? Colors.transparent
                      : ASchoolTheme.danger.withAlpha(120),
              width: isCurrent ? 2 : 1,
            ),
          ),
          child: Text(
            '$number',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: textColor,
            ),
          ),
        ),
      ),
    );
  }
}
