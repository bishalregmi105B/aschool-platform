import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Exam schedules, results summary, grade distribution
class ExamsScreen extends ConsumerStatefulWidget {
  const ExamsScreen({super.key});

  @override
  ConsumerState<ExamsScreen> createState() => _ExamsScreenState();
}

class _ExamsScreenState extends ConsumerState<ExamsScreen> {
  List<Map<String, dynamic>> _exams = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await ApiClient.instance.get('/exams');
      setState(() {
        _exams = List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
        _loading = false;
      });
    } catch (e) {
      debugPrint('ExamsScreen load failed: $e');
      setState(() {
        _error = 'Could not load exams.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();
    if (_error != null) {
      return ErrorContainer(errorMessage: _error!, onRetry: _load);
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: _exams.isEmpty
          ? ListView(children: const [
              SizedBox(height: 120),
              Center(child: Text('No exams scheduled')),
            ])
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _exams.length,
              itemBuilder: (_, i) => _buildExamCard(_exams[i]),
            ),
    );
  }

  Widget _buildExamCard(Map<String, dynamic> exam) {
    final status = exam['status'] ?? 'upcoming';
    final isOngoing = status == 'ongoing';
    final isCompleted = status == 'completed';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _showExamDetail(exam),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(exam['name'] ?? '',
                        style: Theme.of(context).textTheme.titleMedium),
                  ),
                  _statusChip(status),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 14, color: Colors.grey[500]),
                  const SizedBox(width: 4),
                  Text(
                      NepaliFormatter.preferredDateRange(
                        startBs: exam['start_date_bs']?.toString(),
                        endBs: exam['end_date_bs']?.toString(),
                        startAd: exam['start_date']?.toString(),
                        endAd: exam['end_date']?.toString(),
                        separator: ' – ',
                      ),
                      style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.class_, size: 14, color: Colors.grey[500]),
                  const SizedBox(width: 4),
                  Text(exam['class_name']?.toString() ?? 'All classes',
                      style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                ],
              ),
              if (isOngoing || isCompleted) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    _miniStat(
                        'Subjects',
                        '${safeList(exam['subject_ids']).length}'),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusChip(String status) {
    Color bg;
    Color fg;
    switch (status) {
      case 'ongoing':
        bg = ASchoolTheme.warning.withAlpha(30);
        fg = ASchoolTheme.warning;
        break;
      case 'completed':
        bg = ASchoolTheme.success.withAlpha(30);
        fg = ASchoolTheme.success;
        break;
      default:
        bg = ASchoolTheme.primary.withAlpha(30);
        fg = ASchoolTheme.primary;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(status.toUpperCase(),
          style:
              TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
    );
  }

  Widget _miniStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[500])),
      ],
    );
  }

  void _showExamDetail(Map<String, dynamic> exam) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ExamDetailSheet(exam: exam),
    );
  }
}

class _ExamDetailSheet extends StatefulWidget {
  final Map<String, dynamic> exam;
  const _ExamDetailSheet({required this.exam});

  @override
  State<_ExamDetailSheet> createState() => _ExamDetailSheetState();
}

class _ExamDetailSheetState extends State<_ExamDetailSheet> {
  List<Map<String, dynamic>>? _subjects;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSubjects();
  }

  Future<void> _loadSubjects() async {
    try {
      final examId = widget.exam['id']?.toString() ?? '';
      final resp =
          await ApiClient.instance.get('/exams/$examId/subjects');
      if (mounted) {
        setState(() {
          _subjects = List<Map<String, dynamic>>.from(
              resp.data['data'] ?? []);
          _loading = false;
        });
      }
    } catch (e, st) {
      debugPrint('ExamDetailSheet loadSubjects failed: $e\n$st');
      if (mounted) {
        setState(() {
          _error = 'Could not load exam subjects.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final exam = widget.exam;
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, ctrl) => ListView(
        controller: ctrl,
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
          Text(exam['name'] ?? '',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(
            NepaliFormatter.preferredDateRange(
              startBs: exam['start_date_bs']?.toString(),
              endBs: exam['end_date_bs']?.toString(),
              startAd: exam['start_date']?.toString(),
              endAd: exam['end_date']?.toString(),
              separator: ' – ',
            ),
          ),
          const SizedBox(height: 20),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_error != null)
            ErrorContainer(errorMessage: _error!, onRetry: _loadSubjects)
          else if (_subjects == null || _subjects!.isEmpty)
            const Text('No subjects found for this exam.',
                style: TextStyle(color: Colors.grey))
          else
            ..._subjects!.map((s) => Card(
                  child: ListTile(
                    title: Text(s['name']?.toString() ?? ''),
                    subtitle: s['code'] != null
                        ? Text(s['code'].toString())
                        : null,
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'Full: ${s['total_full_marks'] ?? s['full_marks'] ?? ''}',
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                        Text(
                          'Pass: ${s['total_pass_marks'] ?? s['pass_marks'] ?? ''}',
                          style: TextStyle(
                              fontSize: 11, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                )),
        ],
      ),
    );
  }
}
