import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Admin → Assignments (R7.2) — REAL data.
///
/// Was a 100% static ModuleScreenTemplate with hardcoded "24 Open / 6 Due
/// Today" insights and dead action buttons (mobile audit finding). Now:
/// loads every assignment via GET /assignments (admin sees all), shows
/// honest per-assignment submission progress, and taps open the submissions
/// detail (GET /assignments/<id>/submissions).
class AssignmentsScreen extends StatefulWidget {
  const AssignmentsScreen({super.key});

  @override
  State<AssignmentsScreen> createState() => _AssignmentsScreenState();
}

class _AssignmentsScreenState extends State<AssignmentsScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _assignments = [];
  Map<String, dynamic>? _selected;
  List<Map<String, dynamic>> _submissions = [];
  bool _submissionsLoading = false;

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
      final res = await ApiClient.instance.get('/assignments',
          queryParameters: {'per_page': '100'});
      final payload = res.data['data'];
      final rows = payload is List
          ? payload
          : (payload is Map
              ? (payload['assignments'] ?? payload['items'] ?? <dynamic>[])
              : <dynamic>[]);
      setState(() {
        _assignments = rows
            .whereType<Map>()
            .map((r) => Map<String, dynamic>.from(r))
            .toList();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _openSubmissions(Map<String, dynamic> assignment) async {
    setState(() {
      _selected = assignment;
      _submissionsLoading = true;
      _submissions = [];
    });
    try {
      final res = await ApiClient.instance
          .get('/assignments/${assignment['id']}/submissions');
      final payload = res.data['data'];
      final rows = payload is List
          ? payload
          : (payload is Map ? (payload['submissions'] ?? <dynamic>[]) : <dynamic>[]);
      setState(() {
        _submissions = rows
            .whereType<Map>()
            .map((r) => Map<String, dynamic>.from(r))
            .toList();
        _submissionsLoading = false;
      });
    } catch (e) {
      setState(() => _submissionsLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Couldn\'t load submissions: $e')),
        );
      }
    }
  }

  String _todayKey() {
    final n = DateTime.now();
    return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
  }

  String _dueLabel(Map<String, dynamic> a) {
    final due = a['due_date'] ?? a['dueDate'];
    if (due == null) return 'No due date';
    return 'Due $due';
  }

  @override
  Widget build(BuildContext context) {
    final dueToday = _assignments
        .where((a) => (a['due_date'] ?? a['dueDate'] ?? '')
            .toString()
            .startsWith(_todayKey()))
        .length;

    return Scaffold(
      appBar: const CustomAppBar(
        title: 'Assignments',
        showUtilities: true,
      ),
      body: AsyncScreenScaffold(
        loading: _loading,
        error: _error,
        onRetry: _load,
        isEmpty: _assignments.isEmpty,
        emptyTitle: 'No assignments yet',
        emptySubtitle:
            'Teachers create assignments from their portal — they\'ll appear here with live submission counts.',
        emptyIcon: Icons.assignment_outlined,
        child: _selected != null
            ? _buildSubmissionsView()
            : _buildListView(dueToday),
      ),
      floatingActionButton: _selected != null
          ? FloatingActionButton(
              onPressed: () => setState(() => _selected = null),
              tooltip: 'Back to assignments',
              child: const Icon(Icons.arrow_back),
            )
          : null,
    );
  }

  Widget _buildListView(int dueToday) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Honest KPIs from the loaded rows — never fabricated.
          Row(
            children: [
              Expanded(
                child: ESchoolCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Total',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text('${_assignments.length}',
                          style: const TextStyle(
                              fontSize: 24, fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ESchoolCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Due today',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text('$dueToday',
                          style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                              color: dueToday > 0 ? ASchoolTheme.warning : null)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const ESchoolSectionTitle(title: 'All Assignments'),
          const SizedBox(height: 8),
          ..._assignments.asMap().entries.map((entry) {
            final a = entry.value;
            final submitted = (a['submitted_count'] ??
                    a['submission_count'] ??
                    0) as int;
            final total = (a['total_count'] ?? a['student_count'] ?? 0) as int;
            return ESchoolAnimatedEntry(
              index: entry.key,
              child: ESchoolCard(
                onTap: () => _openSubmissions(a),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.assignment_outlined,
                            size: 20, color: ASchoolTheme.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            (a['title'] ?? 'Untitled').toString(),
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 15),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const Icon(Icons.chevron_right, size: 20),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      [
                        a['class_name'],
                        a['subject_name'],
                      ]
                          .where((s) => s != null && s.toString().isNotEmpty)
                          .join(' · '),
                      style: TextStyle(
                          fontSize: 12, color: Theme.of(context).hintColor),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _dueLabel(a),
                      style: TextStyle(
                          fontSize: 12, color: Theme.of(context).hintColor),
                    ),
                    if (total > 0) ...[
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: total > 0 ? submitted / total : 0,
                          minHeight: 4,
                          backgroundColor: ASchoolTheme.primary.withAlpha(30),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$submitted / $total submitted',
                        style: TextStyle(
                            fontSize: 11, color: Theme.of(context).hintColor),
                      ),
                    ],
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildSubmissionsView() {
    final a = _selected!;
    return _submissionsLoading
        ? const LoadingShimmer(itemCount: 6)
        : _submissions.isEmpty
            ? const NoDataContainer(
                title: 'No submissions yet',
                subtitle:
                    'Students haven\'t submitted this assignment so far.',
                icon: Icons.inbox_outlined,
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    (a['title'] ?? 'Assignment').toString(),
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${_submissions.length} submission(s)',
                    style: TextStyle(
                        fontSize: 13, color: Theme.of(context).hintColor),
                  ),
                  const SizedBox(height: 12),
                  ..._submissions.map((s) {
                    final status = (s['status'] ?? 'submitted').toString();
                    final marks = s['marks'];
                    return ESchoolCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  (s['student_name'] ?? 'Student').toString(),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14),
                                ),
                              ),
                              ESchoolInfoPill(
                                icon: status == 'graded'
                                    ? Icons.check_circle_outline
                                    : Icons.schedule,
                                label: status,
                                color: status == 'graded'
                                    ? ASchoolTheme.success
                                    : ASchoolTheme.warning,
                              ),
                            ],
                          ),
                          if (marks != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                'Marks: $marks / ${a['max_marks'] ?? '—'}',
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600),
                              ),
                            ),
                          if (s['is_late'] == true)
                            const Padding(
                              padding: EdgeInsets.only(top: 2),
                              child: Text('Submitted late',
                                  style: TextStyle(
                                      fontSize: 11,
                                      fontStyle: FontStyle.italic)),
                            ),
                          if (s['feedback'] != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                '“${s['feedback']}”',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontStyle: FontStyle.italic,
                                    color: Theme.of(context).hintColor),
                              ),
                            ),
                        ],
                      ),
                    );
                  }),
                ],
              );
  }
}
