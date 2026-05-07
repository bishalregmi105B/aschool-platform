import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// LMS — Video courses, quizzes, progress tracking
class StudentLMS extends ConsumerStatefulWidget {
  const StudentLMS({super.key});

  @override
  ConsumerState<StudentLMS> createState() => _StudentLMSState();
}

class _StudentLMSState extends ConsumerState<StudentLMS>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _courses = [];
  List<dynamic> _quizzes = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/student/lms');
      setState(() {
        _courses = (res.data?['courses'] as List?) ?? [];
        _quizzes = (res.data?['quizzes'] as List?) ?? [];
      });
    } catch (_) {}
    setState(() => _loading = false);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'lms',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'LMS'),
        body: Column(
          children: [
            TabBar(
              controller: _tabController,
              tabs: const [
                Tab(text: 'Courses'),
                Tab(text: 'Quizzes'),
              ],
            ),
            Expanded(
              child: _loading
                  ? const LoadingShimmer()
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _buildCourses(),
                        _buildQuizzes(),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCourses() {
    if (_courses.isEmpty) {
      return const NoDataContainer(
        title: 'No courses available',
        subtitle: 'Your assigned courses will appear here.',
        icon: Icons.play_lesson_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _courses.length,
        itemBuilder: (context, index) {
          final course = _courses[index];
          final progress = (course['progress'] as num?)?.toDouble() ?? 0;
          final totalLessons = (course['total_lessons'] as int?) ?? 0;
          final completedLessons = (course['completed_lessons'] as int?) ?? 0;

          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => _showCourseDetail(course),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Course banner
                  Container(
                    height: 120,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.primaries[index % Colors.primaries.length]
                              .shade600,
                          Colors.primaries[index % Colors.primaries.length]
                              .shade400,
                        ],
                      ),
                    ),
                    child: Stack(
                      children: [
                        Center(
                          child: Icon(Icons.play_circle_filled,
                              size: 48, color: Colors.white.withAlpha(200)),
                        ),
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.black54,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '$completedLessons/$totalLessons lessons',
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 11),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(course['title'] ?? '',
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(
                          '${course['subject'] ?? ''} • ${course['teacher'] ?? ''}',
                          style:
                              TextStyle(fontSize: 12, color: Colors.grey[600]),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: progress / 100,
                                  minHeight: 6,
                                  backgroundColor: Colors.grey[200],
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text('${progress.toStringAsFixed(0)}%',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 13)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildQuizzes() {
    if (_quizzes.isEmpty) {
      return const NoDataContainer(
        title: 'No quizzes available',
        subtitle: 'Upcoming quizzes will appear here.',
        icon: Icons.quiz_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _quizzes.length,
        itemBuilder: (context, index) {
          final quiz = _quizzes[index];
          final status = quiz['status'] ?? 'pending';
          final score = quiz['score'];

          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: _quizStatusColor(status).withAlpha(25),
                child: Icon(_quizStatusIcon(status),
                    color: _quizStatusColor(status), size: 20),
              ),
              title: Text(quiz['title'] ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                      '${quiz['subject'] ?? ''} • ${quiz['questions_count'] ?? 0} questions'),
                  if (quiz['deadline'] != null)
                    Text('Deadline: ${quiz['deadline']}',
                        style: const TextStyle(fontSize: 11)),
                ],
              ),
              trailing: status == 'completed' && score != null
                  ? Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: score >= 60
                            ? Colors.green.withAlpha(25)
                            : Colors.red.withAlpha(25),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '$score%',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: score >= 60 ? Colors.green : Colors.red,
                        ),
                      ),
                    )
                  : status == 'pending'
                      ? FilledButton(
                          onPressed: () => _showQuizPlayer(quiz),
                          child: const Text('Start'),
                        )
                      : null,
              isThreeLine: true,
            ),
          );
        },
      ),
    );
  }

  Color _quizStatusColor(String status) {
    switch (status) {
      case 'completed':
        return Colors.green;
      case 'in_progress':
        return Colors.orange;
      default:
        return Colors.blue;
    }
  }

  IconData _quizStatusIcon(String status) {
    switch (status) {
      case 'completed':
        return Icons.check_circle;
      case 'in_progress':
        return Icons.timer;
      default:
        return Icons.quiz;
    }
  }

  void _showCourseDetail(Map<String, dynamic> course) {
    final theme = Theme.of(context);
    final lessons = (course['lessons'] as List?) ?? [];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.75,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        expand: false,
        builder: (ctx, scroll) => ListView(
          controller: scroll,
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
            Text(course['title'] ?? '',
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(
              '${course['subject'] ?? ''} • ${course['teacher'] ?? ''}',
              style: TextStyle(color: Colors.grey[600]),
            ),
            if (course['description'] != null) ...[
              const SizedBox(height: 12),
              Text(course['description']),
            ],
            const SizedBox(height: 20),
            Text('Lessons',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...lessons.asMap().entries.map((entry) {
              final i = entry.key;
              final lesson = entry.value;
              final completed = lesson['completed'] == true;
              final locked = lesson['locked'] == true;

              return ListTile(
                leading: CircleAvatar(
                  backgroundColor: completed
                      ? Colors.green.withAlpha(25)
                      : locked
                          ? Colors.grey[200]
                          : Colors.blue.withAlpha(25),
                  child: completed
                      ? const Icon(Icons.check, color: Colors.green, size: 18)
                      : locked
                          ? const Icon(Icons.lock, color: Colors.grey, size: 18)
                          : Text('${i + 1}',
                              style: const TextStyle(
                                  color: Colors.blue,
                                  fontWeight: FontWeight.bold)),
                ),
                title: Text(lesson['title'] ?? 'Lesson ${i + 1}',
                    style: TextStyle(color: locked ? Colors.grey : null)),
                subtitle: Text(lesson['duration'] ?? '',
                    style: const TextStyle(fontSize: 12)),
                trailing: lesson['type'] == 'video'
                    ? const Icon(Icons.play_circle_outline)
                    : const Icon(Icons.article_outlined),
                enabled: !locked,
              );
            }),
          ],
        ),
      ),
    );
  }

  void _showQuizPlayer(Map<String, dynamic> quiz) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _QuizPlayer(
        quiz: quiz,
        onSubmitted: _load,
      ),
    );
  }
}

class _QuizPlayer extends StatefulWidget {
  final Map<String, dynamic> quiz;
  final Future<void> Function() onSubmitted;

  const _QuizPlayer({required this.quiz, required this.onSubmitted});

  @override
  State<_QuizPlayer> createState() => _QuizPlayerState();
}

class _QuizPlayerState extends State<_QuizPlayer> {
  final Map<int, String> _answers = {};
  Timer? _timer;
  late int _remainingSeconds;
  bool _submitting = false;

  List<dynamic> get _questions => (widget.quiz['questions'] as List?) ?? [];

  @override
  void initState() {
    super.initState();
    final minutes = (widget.quiz['time_limit_minutes'] as num?)?.toInt() ?? 0;
    _remainingSeconds = minutes * 60;
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
    final quizTitle = widget.quiz['title']?.toString() ?? 'Quiz';

    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.55,
      maxChildSize: 0.95,
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
                  quizTitle,
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
            '${_questions.length} questions • ${widget.quiz['total_marks'] ?? 0} marks',
            style: TextStyle(color: Colors.grey[600]),
          ),
          const SizedBox(height: 20),
          if (_questions.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child:
                  Center(child: Text('No questions configured for this quiz.')),
            )
          else
            ..._questions.asMap().entries.map((entry) {
              final index = entry.key;
              final question = Map<String, dynamic>.from(entry.value as Map);
              final options = (question['options'] as List?) ?? [];

              return Card(
                margin: const EdgeInsets.only(bottom: 14),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${index + 1}. ${question['question'] ?? question['title'] ?? ''}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      if (options.isEmpty)
                        const Text('This question has no answer options.')
                      else
                        ...options.map((option) {
                          final value = _optionValue(option);
                          final selected = _answers[index] == value;
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(selected
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked),
                            title: Text(_optionLabel(option)),
                            onTap: () =>
                                setState(() => _answers[index] = value),
                          );
                        }),
                    ],
                  ),
                ),
              );
            }),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _questions.isEmpty || _submitting ? null : _submit,
            icon: _submitting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.check),
            label: Text(_submitting ? 'Submitting...' : 'Submit Quiz'),
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

  String _optionValue(dynamic option) {
    if (option is Map) {
      return (option['value'] ??
              option['id'] ??
              option['text'] ??
              option['label'])
          .toString();
    }
    return option.toString();
  }

  String _optionLabel(dynamic option) {
    if (option is Map) {
      return (option['text'] ?? option['label'] ?? option['value'] ?? '')
          .toString();
    }
    return option.toString();
  }

  String? _correctAnswer(Map<String, dynamic> question) {
    final answer = question['correct_answer'] ??
        question['answer'] ??
        question['correctAnswer'];
    if (answer is List && answer.isNotEmpty) return answer.first.toString();
    return answer?.toString();
  }

  double _calculateScore() {
    var earned = 0.0;
    var total = 0.0;
    for (final entry in _questions.asMap().entries) {
      final question = Map<String, dynamic>.from(entry.value as Map);
      final marks = (question['marks'] as num?)?.toDouble() ?? 1.0;
      total += marks;
      if (_answers[entry.key] == _correctAnswer(question)) {
        earned += marks;
      }
    }
    return total > 0 ? (earned / total) * 100 : earned;
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      final answerPayload = _answers.map(
        (key, value) => MapEntry(key.toString(), value),
      );
      await ApiClient.instance.post(
        '/lms/quizzes/${widget.quiz['id']}/attempt',
        data: {
          'answers': answerPayload,
          'score': _calculateScore(),
        },
      );
      await widget.onSubmitted();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Quiz submitted'),
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
