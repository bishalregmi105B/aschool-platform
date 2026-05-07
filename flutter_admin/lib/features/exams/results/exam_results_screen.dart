import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Exam Results — class-wise results, individual marksheets, AI remarks
class ExamResultsScreen extends ConsumerStatefulWidget {
  const ExamResultsScreen({super.key});

  @override
  ConsumerState<ExamResultsScreen> createState() => _ExamResultsScreenState();
}

class _ExamResultsScreenState extends ConsumerState<ExamResultsScreen> {
  List<Map<String, dynamic>> _exams = [];
  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _results = [];
  String? _selectedExamId;
  String? _selectedClassId;
  bool _loadingFilters = true;
  bool _loadingResults = false;

  @override
  void initState() {
    super.initState();
    _loadFilters();
  }

  Future<void> _loadFilters() async {
    setState(() => _loadingFilters = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/exams?status=completed&per_page=30'),
        ApiClient.instance.get('/academics/classes?per_page=30'),
      ]);
      setState(() {
        _exams =
            List<Map<String, dynamic>>.from(results[0].data['data'] ?? []);
        _classes =
            List<Map<String, dynamic>>.from(results[1].data['data'] ?? []);
        _loadingFilters = false;
      });
    } catch (_) {
      setState(() => _loadingFilters = false);
    }
  }

  Future<void> _loadResults() async {
    if (_selectedExamId == null || _selectedClassId == null) return;
    setState(() => _loadingResults = true);
    try {
      final res = await ApiClient.instance.get(
        '/exams/$_selectedExamId/results?class_id=$_selectedClassId',
      );
      setState(() {
        _results =
            List<Map<String, dynamic>>.from(res.data['data'] ?? []);
        _loadingResults = false;
      });
    } catch (_) {
      setState(() => _loadingResults = false);
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  int get _passedCount =>
      _results.where((r) => r['status'] == 'pass').length;

  double get _avgPercentage {
    if (_results.isEmpty) return 0;
    return _results.fold<double>(
          0,
          (sum, r) => sum + (r['percentage'] as num? ?? 0).toDouble(),
        ) /
        _results.length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Exam Results')),
      body: _loadingFilters
          ? const LoadingShimmer()
          : Column(
              children: [
                _buildFilters(),
                if (_loadingResults) const Expanded(child: LoadingShimmer()),
                if (!_loadingResults && _results.isEmpty && _selectedExamId != null)
                  Expanded(
                    child: NoDataContainer(
                      title: 'No results yet',
                      subtitle: _selectedClassId == null
                          ? 'Select a class to view results'
                          : 'No marks entered for this exam and class',
                      icon: Icons.assessment_rounded,
                    ),
                  ),
                if (!_loadingResults && _results.isNotEmpty) ...[
                  _buildStats(),
                  _buildTableHeader(),
                  Expanded(child: _buildResultsList()),
                ],
              ],
            ),
    );
  }

  // ── Filters Row ───────────────────────────────────────────────────────────

  Widget _buildFilters() {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              decoration: InputDecoration(
                labelText: 'Exam',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(ASchoolTheme.radiusSm),
                ),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
              value: _selectedExamId,
              items: _exams.map((e) {
                return DropdownMenuItem<String>(
                  value: e['id'] as String?,
                  child: Text(
                    e['name'] as String? ?? '',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13),
                  ),
                );
              }).toList(),
              onChanged: (v) {
                setState(() {
                  _selectedExamId = v;
                  _results = [];
                });
                _loadResults();
              },
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: DropdownButtonFormField<String>(
              decoration: InputDecoration(
                labelText: 'Class',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(ASchoolTheme.radiusSm),
                ),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
              value: _selectedClassId,
              items: _classes.map((c) {
                return DropdownMenuItem<String>(
                  value: c['id'] as String?,
                  child: Text(
                    c['name'] as String? ?? '',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13),
                  ),
                );
              }).toList(),
              onChanged: (v) {
                setState(() {
                  _selectedClassId = v;
                  _results = [];
                });
                _loadResults();
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── Stats Banner ──────────────────────────────────────────────────────────

  Widget _buildStats() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: ASchoolTheme.primary.withAlpha(8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _statPill('Total', '${_results.length}', ASchoolTheme.primary),
          _statPill('Passed', '$_passedCount', ASchoolTheme.success),
          _statPill('Failed',
              '${_results.length - _passedCount}', ASchoolTheme.danger),
          _statPill(
              'Avg', '${_avgPercentage.toStringAsFixed(1)}%', ASchoolTheme.warning),
        ],
      ),
    );
  }

  Widget _statPill(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: color,
            fontSize: 16,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: ASchoolTheme.mutedText,
          ),
        ),
      ],
    );
  }

  // ── Table Header ──────────────────────────────────────────────────────────

  Widget _buildTableHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: ASchoolTheme.tertiary,
      child: const Row(
        children: [
          SizedBox(
              width: 34,
              child: Text('Rk',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 12))),
          SizedBox(
              width: 36,
              child: Text('Roll',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 12))),
          Expanded(
              child: Text('Student',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 12))),
          SizedBox(
              width: 52,
              child: Text('%',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 12))),
          SizedBox(
              width: 42,
              child: Text('Grade',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 12))),
        ],
      ),
    );
  }

  // ── Results List ──────────────────────────────────────────────────────────

  Widget _buildResultsList() {
    return ListView.builder(
      itemCount: _results.length,
      itemBuilder: (_, i) {
        final r = _results[i];
        final isPassed = r['status'] == 'pass';
        final rank = (r['rank'] as num?)?.toInt() ?? (i + 1);
        final pct =
            (r['percentage'] as num?)?.toStringAsFixed(1) ?? '0.0';
        final grade = r['grade'] as String? ?? '';

        return InkWell(
          onTap: () => _showMarksheet(r),
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: ASchoolTheme.tertiary),
              ),
              color: isPassed ? null : ASchoolTheme.danger.withAlpha(8),
            ),
            child: Row(
              children: [
                SizedBox(
                  width: 34,
                  child: Text(
                    '$rank',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: rank <= 3
                          ? _rankColor(rank)
                          : ASchoolTheme.mutedText,
                      fontSize: 13,
                    ),
                  ),
                ),
                SizedBox(
                  width: 36,
                  child: Text(
                    '${r['roll_number'] ?? ''}',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
                Expanded(
                  child: Text(
                    r['student_name'] as String? ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                SizedBox(
                  width: 52,
                  child: Text(
                    '$pct%',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: isPassed
                          ? ASchoolTheme.success
                          : ASchoolTheme.danger,
                      fontSize: 13,
                    ),
                  ),
                ),
                SizedBox(
                  width: 42,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        border: Border.all(
                            color: ASchoolTheme.tertiary),
                        borderRadius: BorderRadius.circular(
                            ASchoolTheme.radiusSm),
                      ),
                      child: Text(
                        grade,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Color _rankColor(int rank) {
    return switch (rank) {
      1 => const Color(0xFFFFD700),
      2 => const Color(0xFFC0C0C0),
      3 => const Color(0xFFCD7F32),
      _ => ASchoolTheme.mutedText,
    };
  }

  // ── Marksheet Modal ───────────────────────────────────────────────────────

  void _showMarksheet(Map<String, dynamic> result) {
    if (_selectedExamId == null) return;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _MarksheetSheet(
        examId: _selectedExamId!,
        studentId: result['student_id'] as String,
      ),
    );
  }
}

// ── Marksheet Bottom Sheet ─────────────────────────────────────────────────

class _MarksheetSheet extends StatefulWidget {
  final String examId;
  final String studentId;

  const _MarksheetSheet({
    required this.examId,
    required this.studentId,
  });

  @override
  State<_MarksheetSheet> createState() => _MarksheetSheetState();
}

class _MarksheetSheetState extends State<_MarksheetSheet> {
  Map<String, dynamic>? _ms;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiClient.instance
          .get('/exams/${widget.examId}/marksheet/${widget.studentId}');
      setState(() {
        _ms = Map<String, dynamic>.from(res.data['data'] ?? {});
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Could not load marksheet';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.78,
      maxChildSize: 0.95,
      builder: (_, ctrl) => Column(
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.symmetric(vertical: 10),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: ASchoolTheme.tertiary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          Expanded(
            child: _loading
                ? const LoadingShimmer()
                : _error != null
                    ? Center(
                        child: Text(
                          _error!,
                          style: const TextStyle(
                              color: ASchoolTheme.mutedText),
                        ),
                      )
                    : _buildContent(ctrl),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(ScrollController ctrl) {
    final ms = _ms!;
    final subjects = List<Map<String, dynamic>>.from(
        ms['subjects'] as List? ?? []);

    return ListView(
      controller: ctrl,
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      children: [
        // Header
        Text(
          ms['student_name'] as String? ?? '',
          style: Theme.of(context)
              .textTheme
              .titleLarge
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        Text(
          '${ms['exam_name'] ?? ''} • ${ms['class_name'] ?? ''} ${ms['section_name'] ?? ''}',
          style: const TextStyle(color: ASchoolTheme.mutedText),
        ),
        const SizedBox(height: 16),

        // Summary cards
        Row(children: [
          Expanded(
            child: _summaryCard(
              '${ms['percentage'] ?? 0}%',
              'Score',
              ASchoolTheme.primary,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _summaryCard(
              ms['overall_grade'] as String? ?? '—',
              'Grade',
              ASchoolTheme.success,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _summaryCard(
              ms['rank_in_class'] != null
                  ? '#${ms['rank_in_class']}'
                  : '—',
              'Rank',
              ASchoolTheme.warning,
            ),
          ),
        ]),
        const SizedBox(height: 16),

        // Subject marks
        const SectionHeader(
          title: 'Subject Marks',
          padding: EdgeInsets.only(bottom: 8),
        ),
        ...subjects.map((s) {
          final isPassed = s['pass'] as bool? ?? true;
          return ESchoolCard(
            margin: const EdgeInsets.only(bottom: 8),
            color: isPassed ? null : const Color(0xFFFFF3F3),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s['subject_name'] as String? ?? '',
                        style: const TextStyle(
                            fontWeight: FontWeight.w600),
                      ),
                      if (!isPassed)
                        const Text(
                          'FAIL',
                          style: TextStyle(
                            color: ASchoolTheme.danger,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                    ],
                  ),
                ),
                Text(
                  '${s['obtained_marks'] ?? 0}/${s['full_marks'] ?? 0}',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: isPassed
                        ? ASchoolTheme.secondary
                        : ASchoolTheme.danger,
                  ),
                ),
                const SizedBox(width: 10),
                ESchoolInfoPill(
                  icon: Icons.grade_rounded,
                  label: s['grade'] as String? ?? '',
                  color: isPassed
                      ? ASchoolTheme.primary
                      : ASchoolTheme.danger,
                ),
              ],
            ),
          );
        }),

        // AI Remarks
        if (ms['ai_remarks'] != null) ...[
          const SizedBox(height: 8),
          ESchoolCard(
            color: ASchoolTheme.primary.withAlpha(6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(
                    Icons.auto_awesome_rounded,
                    size: 14,
                    color: ASchoolTheme.primary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'AI Remarks',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: ASchoolTheme.primary,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ]),
                const SizedBox(height: 6),
                Text(
                  ms['ai_remarks'] as String,
                  style: const TextStyle(fontSize: 13, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _summaryCard(String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: color.withAlpha(12),
        borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
        border: Border.all(color: color.withAlpha(30)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: ASchoolTheme.mutedText,
            ),
          ),
        ],
      ),
    );
  }
}
