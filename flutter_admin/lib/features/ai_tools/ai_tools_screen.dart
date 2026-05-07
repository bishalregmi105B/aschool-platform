import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// AI tool hub — question paper, lesson plan, auto-grade, chatbot
class AiToolsScreen extends ConsumerStatefulWidget {
  const AiToolsScreen({super.key});

  @override
  ConsumerState<AiToolsScreen> createState() => _AiToolsScreenState();
}

class _AiToolsScreenState extends ConsumerState<AiToolsScreen> {
  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'ai_insights',
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _AiToolCard(
            icon: Icons.quiz,
            title: 'Question Paper Generator',
            subtitle: 'AI-generated question papers from syllabus',
            color: ASchoolTheme.primary,
            onTap: () => _openTool('question_paper'),
          ),
          _AiToolCard(
            icon: Icons.book,
            title: 'Lesson Plan Builder',
            subtitle: 'Structured lesson plans with activities',
            color: ASchoolTheme.secondary,
            onTap: () => _openTool('lesson_plan'),
          ),
          _AiToolCard(
            icon: Icons.grading,
            title: 'Auto Grader',
            subtitle: 'Grade answer sheets with AI assistance',
            color: ASchoolTheme.success,
            onTap: () => _openTool('auto_grader'),
          ),
          _AiToolCard(
            icon: Icons.lightbulb,
            title: 'Study Tips Generator',
            subtitle: 'Personalized study tips for students',
            color: ASchoolTheme.warning,
            onTap: () => _openTool('study_tips'),
          ),
          _AiToolCard(
            icon: Icons.analytics,
            title: 'School Insights',
            subtitle: 'AI-analyzed trends and recommendations',
            color: ASchoolTheme.danger,
            onTap: () => _openTool('school_insights'),
          ),
          _AiToolCard(
            icon: Icons.schedule,
            title: 'Timetable Solver',
            subtitle: 'AI-optimized timetable generation',
            color: const Color(0xFF8B5CF6),
            onTap: () => _openTool('timetable_solver'),
          ),
        ],
      ),
    );
  }

  void _openTool(String tool) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => _AiToolDetail(tool: tool)),
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
          child: Row(
            children: [
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
                        style:
                            TextStyle(fontSize: 13, color: Colors.grey[600])),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.grey[400]),
            ],
          ),
        ),
      ),
    );
  }
}

/// Generic AI tool interaction screen with prompt input + streaming response
class _AiToolDetail extends ConsumerStatefulWidget {
  final String tool;
  const _AiToolDetail({required this.tool});

  @override
  ConsumerState<_AiToolDetail> createState() => _AiToolDetailState();
}

class _AiToolDetailState extends ConsumerState<_AiToolDetail> {
  final _promptCtrl = TextEditingController();
  String? _result;
  bool _generating = false;

  String get _toolTitle {
    switch (widget.tool) {
      case 'question_paper':
        return 'Question Paper Generator';
      case 'lesson_plan':
        return 'Lesson Plan Builder';
      case 'auto_grader':
        return 'Auto Grader';
      case 'study_tips':
        return 'Study Tips Generator';
      case 'school_insights':
        return 'School Insights';
      case 'timetable_solver':
        return 'Timetable Solver';
      default:
        return 'AI Tool';
    }
  }

  String get _hintText {
    switch (widget.tool) {
      case 'question_paper':
        return 'e.g. Class 10 Science Unit 3 — 50 marks, mix of MCQ and long answer';
      case 'lesson_plan':
        return 'e.g. Class 8 Mathematics — Algebra basics, 45 min period';
      case 'auto_grader':
        return 'Paste or describe the answers to grade...';
      default:
        return 'Describe what you need...';
    }
  }

  Future<void> _generate() async {
    if (_promptCtrl.text.trim().isEmpty) return;
    setState(() {
      _generating = true;
      _result = null;
    });
    try {
      final resp = await ApiClient.instance.post(
        '/ai/${widget.tool}/generate',
        data: {'prompt': _promptCtrl.text.trim()},
      );
      setState(() => _result = resp.data['data']?['result'] ?? 'No result');
    } catch (e) {
      setState(() => _result = 'Error generating. Please try again.');
    } finally {
      setState(() => _generating = false);
    }
  }

  @override
  void dispose() {
    _promptCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_toolTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _promptCtrl,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: _hintText,
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
                    child: SelectableText(
                      _result!,
                      style: const TextStyle(fontSize: 14, height: 1.6),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
