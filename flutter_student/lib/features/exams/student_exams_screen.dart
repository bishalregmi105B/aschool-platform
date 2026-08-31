import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class StudentExamsScreen extends ConsumerStatefulWidget {
  const StudentExamsScreen({super.key});

  @override
  ConsumerState<StudentExamsScreen> createState() => _StudentExamsScreenState();
}

class _StudentExamsScreenState extends ConsumerState<StudentExamsScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(examsProvider);

    return Scaffold(
      appBar: const CustomAppBar(
        title: 'Exams',
      ),
      body: Column(
        children: [
          AnimatedToggle(
            values: const ['Offline', 'Online'],
            selectedIndex: _selectedIndex,
            onToggleCallback: (index) {
              setState(() {
                _selectedIndex = index;
              });
            },
          ),
          Expanded(
            child: PullToRefresh(
              onRefresh: () => ref.read(examsProvider.notifier).refresh(),
              child: state.when(
                loading: () => const ShimmerLoadingList(),
                error: (error, stack) => ErrorContainer(
                  errorMessage: error.toString(),
                  onRetry: () => ref.read(examsProvider.notifier).refresh(),
                ),
                data: (data) {
                  final isOffline = _selectedIndex == 0;
                  final exams =
                      isOffline ? data.offlineExams : data.onlineExams;

                  if (exams.isEmpty) {
                    return const NoDataContainer(
                      title: 'No upcoming exams 🎉',
                      subtitle: 'You have no scheduled exams at the moment.',
                      icon: Icons.quiz_outlined,
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: exams.length,
                    itemBuilder: (context, index) {
                      final exam = exams[index];
                      if (isOffline) {
                        return _OfflineExamCard(exam: exam as Exam);
                      } else {
                        return _OnlineExamCard(exam: exam as OnlineExam);
                      }
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OfflineExamCard extends StatelessWidget {
  final Exam exam;

  const _OfflineExamCard({required this.exam});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? ASchoolTheme.darkBorder
              : Colors.grey.shade200,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(5),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: ASchoolTheme.secondary.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    exam.term,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: ASchoolTheme.secondary,
                    ),
                  ),
                ),
                const Spacer(),
                const Icon(Icons.date_range_rounded,
                    size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  '${exam.startDate} - ${exam.endDate}',
                  style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w500),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              exam.name,
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            const Text(
              'Subjects Schedule',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? ASchoolTheme.darkBorder
              : Colors.grey.shade200,
        ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: exam.subjects.length,
                separatorBuilder: (_, __) =>
                    Divider(height: 1, color: Colors.grey.shade200),
                itemBuilder: (context, index) {
                  final sub = exam.subjects[index];
                  return Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: Text(
                            sub['subject'] ?? '',
                            style: const TextStyle(
                                fontWeight: FontWeight.w500, fontSize: 13),
                          ),
                        ),
                        Expanded(
                          flex: 3,
                          child: Text(
                            '${sub['date'] ?? ''} • ${sub['time'] ?? ''}',
                            style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'FM: ${sub['full_marks'] ?? ''}',
                            style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey.shade700,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnlineExamCard extends StatelessWidget {
  final OnlineExam exam;

  const _OnlineExamCard({required this.exam});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLive = exam.status == 'live' || exam.status == 'ongoing';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isLive ? Colors.green.withAlpha(50) : Colors.grey.shade200),
        boxShadow: isLive
            ? [
                BoxShadow(
                    color: Colors.green.withAlpha(20),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ]
            : [],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(
            color:
                isLive ? Colors.green.withAlpha(20) : Colors.blue.withAlpha(20),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            Icons.computer_rounded,
            color: isLive ? Colors.green : Colors.blue,
            size: 24,
          ),
        ),
        title: Text(
          exam.title,
          style: theme.textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              exam.subject,
              style: TextStyle(
                  color: Colors.grey.shade700, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.access_time_rounded,
                    size: 14, color: Colors.grey.shade500),
                const SizedBox(width: 4),
                Text('${exam.durationMinutes} mins',
                    style:
                        TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                const SizedBox(width: 12),
                Icon(Icons.rule_rounded, size: 14, color: Colors.grey.shade500),
                const SizedBox(width: 4),
                Text('FM: ${exam.totalMarks}',
                    style:
                        TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
              ],
            ),
          ],
        ),
        trailing: isLive
            ? FilledButton(
                onPressed: () => _startExam(context),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.green,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                ),
                child: const Text('Start'),
              )
            : Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  exam.status.toUpperCase(),
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
              ),
      ),
    );
  }

  Future<void> _startExam(BuildContext context) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final response = await ApiClient.instance.get('/exams/online/${exam.id}');
      final detailed = OnlineExam.fromJson(
        Map<String, dynamic>.from(response.data['data']),
      );
      if (!context.mounted) return;
      Navigator.pop(context);
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        builder: (_) => _OnlineExamPlayer(exam: detailed),
      );
    } catch (e) {
      if (!context.mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    }
  }
}

class _OnlineExamPlayer extends StatefulWidget {
  final OnlineExam exam;

  const _OnlineExamPlayer({required this.exam});

  @override
  State<_OnlineExamPlayer> createState() => _OnlineExamPlayerState();
}

class _OnlineExamPlayerState extends State<_OnlineExamPlayer> {
  final Map<int, String> _answers = {};
  Timer? _timer;
  late int _remainingSeconds;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.exam.durationMinutes * 60;
    if (_remainingSeconds > 0) {
      _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) return;
        if (_remainingSeconds <= 1) {
          timer.cancel();
          _submit();
          return;
        }
        setState(() => _remainingSeconds -= 1);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final questions = widget.exam.questions;

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.6,
      maxChildSize: 0.97,
      expand: false,
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.exam.title,
                  style: theme.textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
              ),
              if (_remainingSeconds > 0)
                Chip(
                  avatar: const Icon(Icons.timer, size: 16),
                  label: Text(_formatTime(_remainingSeconds)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${widget.exam.subject} • ${questions.length} questions • ${widget.exam.totalMarks ?? 0} marks',
            style: TextStyle(color: Colors.grey[600]),
          ),
          const SizedBox(height: 20),
          if (questions.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child:
                  Center(child: Text('No questions configured for this exam.')),
            )
          else
            ...questions.asMap().entries.map((entry) {
              final index = entry.key;
              final question = entry.value;
              return Card(
                margin: const EdgeInsets.only(bottom: 14),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${index + 1}. ${question.question}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      if (question.options.isEmpty)
                        const Text('This question has no answer options.')
                      else
                        ...question.options.map((option) {
                          final selected = _answers[index] == option.id;
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(selected
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked),
                            title: Text(option.text),
                            onTap: () =>
                                setState(() => _answers[index] = option.id),
                          );
                        }),
                    ],
                  ),
                ),
              );
            }),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: questions.isEmpty || _submitting ? null : _submit,
            icon: _submitting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.check),
            label: Text(_submitting ? 'Submitting...' : 'Submit Exam'),
          ),
        ],
      ),
    );
  }

  String _formatTime(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '$minutes:${secs.toString().padLeft(2, '0')}';
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      final answers = <String, dynamic>{};
      for (final entry in _answers.entries) {
        final question = widget.exam.questions[entry.key];
        final key = question.id.isNotEmpty ? question.id : entry.key.toString();
        answers[key] = entry.value;
      }

      await ApiClient.instance.post(
        '/exams/online/${widget.exam.id}/submit',
        data: {'answers': answers},
      );
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Exam submitted'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }
}
