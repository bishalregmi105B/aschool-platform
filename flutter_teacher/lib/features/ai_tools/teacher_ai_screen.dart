import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Teacher AI tools — question paper, lesson plan, remarks, feedback
class TeacherAiScreen extends ConsumerWidget {
  const TeacherAiScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PluginGate(
      pluginSlug: 'ai_insights',
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _AiToolCard(
            icon: Icons.quiz,
            title: 'Question Paper Generator',
            subtitle: 'Generate papers from syllabus with answer key',
            color: ASchoolTheme.primary,
            onTap: () => _navigate(context, 'question_paper'),
          ),
          _AiToolCard(
            icon: Icons.menu_book,
            title: 'Lesson Plan Builder',
            subtitle: 'Structured plans with objectives & activities',
            color: const Color(0xFF059669),
            onTap: () => _navigate(context, 'lesson_plan'),
          ),
          _AiToolCard(
            icon: Icons.rate_review,
            title: 'Report Card Remarks',
            subtitle: 'AI-drafted personalized remarks per student',
            color: ASchoolTheme.warning,
            onTap: () => _navigate(context, 'remarks'),
          ),
          _AiToolCard(
            icon: Icons.grading,
            title: 'Assignment Feedback',
            subtitle: 'AI grades and suggests feedback',
            color: ASchoolTheme.secondary,
            onTap: () => _navigate(context, 'feedback'),
          ),
          _AiToolCard(
            icon: Icons.lightbulb,
            title: 'Student Study Tips',
            subtitle: 'Personalized study plans for struggling students',
            color: ASchoolTheme.danger,
            onTap: () => _navigate(context, 'study_tips'),
          ),
        ],
      ),
    );
  }

  void _navigate(BuildContext context, String tool) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => _TeacherAiDetail(tool: tool)),
    );
  }
}

class _AiToolCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _AiToolCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: color.withAlpha(25),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: Colors.grey[400]),
          ]),
        ),
      ),
    );
  }
}

class _TeacherAiDetail extends ConsumerStatefulWidget {
  final String tool;
  const _TeacherAiDetail({required this.tool});

  @override
  ConsumerState<_TeacherAiDetail> createState() => _TeacherAiDetailState();
}

class _TeacherAiDetailState extends ConsumerState<_TeacherAiDetail> {
  final _inputCtrl = TextEditingController();
  String? _result;
  bool _generating = false;

  String get _title {
    switch (widget.tool) {
      case 'question_paper':
        return 'Question Paper Generator';
      case 'lesson_plan':
        return 'Lesson Plan Builder';
      case 'remarks':
        return 'Report Card Remarks';
      case 'feedback':
        return 'Assignment Feedback';
      case 'study_tips':
        return 'Student Study Tips';
      default:
        return 'AI Tool';
    }
  }

  String get _hint {
    switch (widget.tool) {
      case 'question_paper':
        return 'Class 10 Science Unit 3, 50 marks, MCQ + long answer';
      case 'lesson_plan':
        return 'Class 8 Maths — Algebra basics, 45 min period';
      case 'remarks':
        return 'Student name and key observations...';
      case 'feedback':
        return 'Paste student answer or describe the work...';
      case 'study_tips':
        return 'Student performance context...';
      default:
        return 'Describe what you need...';
    }
  }

  Future<void> _generate() async {
    if (_inputCtrl.text.trim().isEmpty) return;
    setState(() {
      _generating = true;
      _result = null;
    });
    try {
      final resp = await ApiClient.instance.post(
        '/ai/${widget.tool}/generate',
        data: {'prompt': _inputCtrl.text.trim()},
      );
      setState(() => _result = resp.data['data']?['result'] ?? 'No result');
    } catch (_) {
      setState(() => _result = 'Error generating. Please try again.');
    } finally {
      setState(() => _generating = false);
    }
  }

  @override
  void dispose() {
    _inputCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        actions: [
          if (_result != null)
            IconButton(
              icon: const Icon(Icons.share),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: _result!));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Result copied')),
                );
              },
            ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          TextField(
            controller: _inputCtrl,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: _hint,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _generating ? null : _generate,
              icon: _generating
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.auto_awesome),
              label: Text(_generating ? 'Generating...' : 'Generate'),
            ),
          ),
          const SizedBox(height: 16),
          if (_result != null)
            Expanded(
              child: Card(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: SelectableText(_result!,
                      style: const TextStyle(fontSize: 14, height: 1.6)),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}
