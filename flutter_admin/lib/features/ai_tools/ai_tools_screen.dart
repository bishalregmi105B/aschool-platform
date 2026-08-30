import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// AI tool hub — backed by the backend `/ai-tools/*` routes
/// (question paper, lesson plan, insights, timetable).
class AiToolsScreen extends ConsumerStatefulWidget {
  const AiToolsScreen({super.key});

  @override
  ConsumerState<AiToolsScreen> createState() => _AiToolsScreenState();
}

class _AiToolsScreenState extends ConsumerState<AiToolsScreen> {
  @override
  Widget build(BuildContext context) {
    // Backend ai-tools endpoints are gated on the `ai_tools` plugin
    // (manifests/ai_tools.yaml), not `ai_insights`.
    return PluginGate(
      pluginSlug: 'ai_tools',
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
            icon: Icons.analytics,
            title: 'School Insights',
            subtitle: 'AI-analyzed weekly trends and recommendations',
            color: ASchoolTheme.danger,
            onTap: () => _openTool('school_insights'),
          ),
          _AiToolCard(
            icon: Icons.schedule,
            title: 'Timetable Solver',
            subtitle: 'Clash-free timetable from your classes',
            color: const Color(0xFF8B5CF6),
            onTap: () => _openTool('timetable_solver'),
          ),
          _AiToolCard(
            icon: Icons.grading,
            title: 'Auto Grader',
            subtitle: 'Runs on assignment submissions (Assignments module)',
            color: ASchoolTheme.success,
            dimmed: true,
            onTap: () => _snack(
                'AI grading runs per assignment submission — open Assignments.'),
          ),
          _AiToolCard(
            icon: Icons.lightbulb,
            title: 'Study Tips Generator',
            subtitle: 'No backend AI tool yet',
            color: ASchoolTheme.warning,
            dimmed: true,
            onTap: () => _snack('No backend AI tool for study tips yet.'),
          ),
        ],
      ),
    );
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
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
  final bool dimmed;

  const _AiToolCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
    this.dimmed = false,
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
                  color: color.withAlpha(dimmed ? 12 : 25),
                  borderRadius: BorderRadius.circular(14),
                ),
                child:
                    Icon(icon, color: dimmed ? Colors.grey : color, size: 28),
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

/// Input spec mirroring the backend handler's expected request fields
/// (`backend/app/api/v1/ai_tools.py`).
class _FieldSpec {
  final String key;
  final String label;
  final String hint;
  final bool numeric;
  final bool optional;

  const _FieldSpec(
    this.key,
    this.label, {
    this.hint = '',
    this.numeric = false,
    this.optional = false,
  });
}

/// Generic AI tool screen: structured inputs → real /ai-tools endpoint →
/// formatted result.
class _AiToolDetail extends ConsumerStatefulWidget {
  final String tool;
  const _AiToolDetail({required this.tool});

  @override
  ConsumerState<_AiToolDetail> createState() => _AiToolDetailState();
}

class _AiToolDetailState extends ConsumerState<_AiToolDetail> {
  final AiRepository _repo = AiRepository();
  late final Map<String, TextEditingController> _controllers;
  String? _result;
  bool _generating = false;

  // Timetable tool state
  List<Map<String, dynamic>> _years = [];
  String? _selectedYearId;

  String get _toolTitle {
    switch (widget.tool) {
      case 'question_paper':
        return 'Question Paper Generator';
      case 'lesson_plan':
        return 'Lesson Plan Builder';
      case 'school_insights':
        return 'School Insights';
      case 'timetable_solver':
        return 'Timetable Solver';
      default:
        return 'AI Tool';
    }
  }

  List<_FieldSpec> get _fields {
    switch (widget.tool) {
      case 'question_paper':
        return const [
          _FieldSpec('subject', 'Subject', hint: 'e.g. Science'),
          _FieldSpec('grade', 'Grade', hint: 'e.g. 10'),
          _FieldSpec('total_marks', 'Total marks',
              hint: 'e.g. 50', numeric: true),
          _FieldSpec('duration_minutes', 'Duration (minutes)',
              hint: 'e.g. 90', numeric: true),
          _FieldSpec('topics', 'Topics (optional)',
              hint: 'e.g. Unit 3, Optics', optional: true),
        ];
      case 'lesson_plan':
        return const [
          _FieldSpec('subject', 'Subject', hint: 'e.g. Mathematics'),
          _FieldSpec('grade', 'Grade', hint: 'e.g. 8'),
          _FieldSpec('topic', 'Topic', hint: 'e.g. Algebra basics'),
          _FieldSpec('duration_minutes', 'Duration (minutes)',
              hint: 'e.g. 45', numeric: true, optional: true),
        ];
      default:
        return const [];
    }
  }

  @override
  void initState() {
    super.initState();
    _controllers = {
      for (final f in _fields) f.key: TextEditingController(),
    };
    if (widget.tool == 'timetable_solver') _loadYears();
  }

  Future<void> _loadYears() async {
    try {
      final r = await ApiClient.instance.get('/academics/years');
      final data = r.data is Map<String, dynamic> ? r.data['data'] : null;
      if (data is List) {
        _years = data
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        if (_years.isNotEmpty) {
          final current =
              _years.where((y) => y['is_current'] == true).toList();
          _selectedYearId =
              (current.isNotEmpty ? current.first : _years.first)['id']
                  ?.toString();
        }
      }
    } catch (e, st) {
      // Year list stays empty; generate disabled with a message.
      debugPrint('AiToolsScreen loadYears failed: $e\n$st');
    }
    if (mounted) setState(() {});
  }

  Future<void> _generate() async {
    final body = <String, dynamic>{};
    for (final f in _fields) {
      final text = _controllers[f.key]!.text.trim();
      if (text.isEmpty) {
        if (!f.optional) {
          setState(() => _result = 'Please fill in "${f.label}".');
          return;
        }
        continue;
      }
      body[f.key] = f.numeric
          ? (int.tryParse(text) ?? double.tryParse(text) ?? text)
          : text;
    }
    setState(() {
      _generating = true;
      _result = null;
    });
    try {
      switch (widget.tool) {
        case 'question_paper':
          _result = _formatPaper(await _repo.generateQuestionPaper(
            subject: safeString(body['subject']),
            grade: safeString(body['grade']),
            totalMarks: safeNum(body['total_marks']),
            durationMinutes: safeNum(body['duration_minutes']),
            topics: safeStringOrNull(body['topics']),
          ));
          break;
        case 'lesson_plan':
          _result = _formatLessonPlan(await _repo.generateLessonPlan(
            subject: safeString(body['subject']),
            grade: safeString(body['grade']),
            topic: safeString(body['topic']),
            durationMinutes: safeNumOrNull(body['duration_minutes']) ?? 45,
          ));
          break;
        case 'school_insights':
          _result = _formatInsights(await _repo.weeklyInsights());
          break;
        case 'timetable_solver':
          if (_selectedYearId == null) {
            setState(
                () => _result = 'No academic year available to generate for.');
            return;
          }
          _result = _formatTimetable(await _repo.generateTimetable(
            academicYearId: _selectedYearId!,
          ));
          break;
        default:
          _result = 'Unknown tool.';
      }
    } on ApiException catch (e) {
      _result = e.message;
    } catch (e, st) {
      debugPrint('AiToolsScreen generate failed: $e\n$st');
      _result = 'Error generating. Please try again.';
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  // ── result formatters (defensive against missing/null fields) ─────────

  String _formatPaper(Map<String, dynamic> paper) {
    final buf = StringBuffer();
    buf.writeln(
        'Subject: ${paper['subject'] ?? '-'}  •  Grade: ${paper['grade'] ?? '-'}');
    buf.writeln(
        'Total marks: ${paper['total_marks'] ?? '-'}  •  Duration: ${paper['duration'] ?? '-'}');
    final instructions = paper['instructions'];
    if (instructions is List && instructions.isNotEmpty) {
      buf.writeln();
      buf.writeln('Instructions:');
      for (final line in instructions) {
        buf.writeln('• $line');
      }
    }
    final sections = paper['sections'];
    if (sections is List) {
      for (final s in sections) {
        if (s is! Map) continue;
        buf.writeln();
        buf.writeln('— ${s['name'] ?? 'Section'}'
            '${s['marks'] != null ? ' (${s['marks']} marks)' : ''} —');
        final sectionNote = s['instructions'];
        if (sectionNote is String && sectionNote.isNotEmpty) {
          buf.writeln(sectionNote);
        }
        final questions = s['questions'];
        if (questions is List) {
          for (final q in questions) {
            if (q is! Map) continue;
            buf.writeln();
            buf.writeln('${q['number'] ?? ''}. ${q['text'] ?? ''}'
                '${q['marks'] != null ? ' [${q['marks']}]' : ''}');
            final options = q['options'];
            if (options is List) {
              for (final o in options) {
                buf.writeln('   $o');
              }
            }
            if (q['answer'] != null) buf.writeln('   Answer: ${q['answer']}');
          }
        }
      }
    }
    return buf.toString().trim();
  }

  String _formatLessonPlan(Map<String, dynamic> plan) {
    final buf = StringBuffer();
    buf.writeln(
        'Subject: ${plan['subject'] ?? '-'}  •  Grade: ${plan['grade'] ?? '-'}');
    buf.writeln(
        'Topic: ${plan['topic'] ?? '-'}  •  Duration: ${plan['duration'] ?? '-'}');
    final objectives = plan['learning_objectives'];
    if (objectives is List && objectives.isNotEmpty) {
      buf.writeln();
      buf.writeln('Learning objectives:');
      for (final o in objectives) {
        buf.writeln('• $o');
      }
    }
    final materials = plan['materials_needed'];
    if (materials is List && materials.isNotEmpty) {
      buf.writeln();
      buf.writeln('Materials:');
      buf.writeln(materials.join(', '));
    }
    final structure = plan['lesson_structure'];
    if (structure is List) {
      for (final phase in structure) {
        if (phase is! Map) continue;
        buf.writeln();
        buf.writeln('— ${phase['phase'] ?? 'Phase'}'
            '${phase['duration'] != null ? ' (${phase['duration']})' : ''} —');
        final activities = phase['activities'];
        if (activities is List) {
          for (final a in activities) {
            buf.writeln('• $a');
          }
        }
        final instructions = phase['teacher_instructions'];
        if (instructions is String && instructions.isNotEmpty) {
          buf.writeln(instructions);
        }
      }
    }
    final assessment = plan['assessment'];
    if (assessment is Map) {
      buf.writeln();
      buf.writeln('Assessment:');
      final formative = assessment['formative'];
      if (formative is List) {
        for (final f in formative) {
          buf.writeln('• $f');
        }
      }
      final summative = assessment['summative'];
      if (summative is String && summative.isNotEmpty) {
        buf.writeln('• $summative');
      }
    }
    final homework = plan['homework'];
    if (homework is String && homework.isNotEmpty) {
      buf.writeln();
      buf.writeln('Homework: $homework');
    }
    return buf.toString().trim();
  }

  String _formatInsights(Map<String, dynamic> report) {
    final buf = StringBuffer();
    buf.writeln('Weekly insights — risk level: ${report['risk_level'] ?? '-'}');
    final summary = report['summary'];
    if (summary is String && summary.isNotEmpty) {
      buf.writeln();
      buf.writeln(summary);
    }
    void listSection(String title, dynamic items) {
      if (items is List && items.isNotEmpty) {
        buf.writeln();
        buf.writeln('$title:');
        for (final item in items) {
          buf.writeln('• $item');
        }
      }
    }

    listSection('Highlights', report['highlights']);
    listSection('Concerns', report['concerns']);
    listSection('Recommendations', report['recommendations']);
    final metrics = report['metrics'];
    if (metrics is Map) {
      buf.writeln();
      buf.writeln('Metrics:');
      metrics.forEach((k, v) {
        buf.writeln('• ${k.toString().replaceAll('_', ' ')}: $v');
      });
    }
    return buf.toString().trim();
  }

  String _formatTimetable(Map<String, dynamic> tt) {
    final buf = StringBuffer();
    final days = tt['days'];
    buf.writeln(
        'Days: ${days is List ? days.join(', ') : '-'}  •  Periods/day: ${tt['periods_per_day'] ?? '-'}');
    final conflicts = tt['conflicts'];
    buf.writeln(
        'Conflicts: ${conflicts is List ? conflicts.length : 'unknown'}');
    final classes = tt['classes'];
    if (classes is List && classes.isNotEmpty) {
      buf.writeln();
      buf.writeln('Classes:');
      for (final c in classes) {
        if (c is! Map) continue;
        final slots = c['slots'];
        buf.writeln('• ${c['class_name'] ?? 'Class'}'
            ' — ${c['section_name'] ?? ''}'
            ' (${slots is List ? slots.length : 0} slots)');
      }
    } else {
      buf.writeln();
      buf.writeln('No classes with sections found to schedule.');
    }
    return buf.toString().trim();
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasInput =
        _fields.isNotEmpty || widget.tool == 'timetable_solver';
    return Scaffold(
      appBar: AppBar(title: Text(_toolTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            if (_fields.isNotEmpty)
              Expanded(
                flex: _fields.length > 3 ? 2 : 1,
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final f in _fields)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: TextField(
                          controller: _controllers[f.key],
                          keyboardType: f.numeric
                              ? const TextInputType.numberWithOptions()
                              : TextInputType.text,
                          decoration: InputDecoration(
                            labelText:
                                '${f.label}${f.optional ? ' (optional)' : ''}',
                            hintText: f.hint,
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            if (widget.tool == 'timetable_solver') ...[
              if (_years.isEmpty)
                const Text('No academic years found.'),
              if (_years.isNotEmpty)
                DropdownButtonFormField<String>(
                  initialValue: _selectedYearId,
                  decoration: const InputDecoration(
                    labelText: 'Academic year',
                    border: OutlineInputBorder(),
                  ),
                  items: _years
                      .map((y) => DropdownMenuItem<String>(
                            value: y['id']?.toString(),
                            child: Text(y['name']?.toString() ?? 'Year'),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedYearId = v),
                ),
            ],
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
            if (_result != null || !hasInput)
              Expanded(
                child: Card(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: SelectableText(
                      _result ??
                          (hasInput
                              ? ''
                              : widget.tool == 'school_insights'
                                  ? 'Tap Generate to build this week\'s AI report.'
                                  : 'Tap Generate to build the timetable.'),
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
