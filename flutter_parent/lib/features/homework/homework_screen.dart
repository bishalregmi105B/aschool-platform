import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ParentHomeworkScreen extends ConsumerStatefulWidget {
  const ParentHomeworkScreen({super.key});

  @override
  ConsumerState<ParentHomeworkScreen> createState() =>
      _ParentHomeworkScreenState();
}

class _ParentHomeworkScreenState extends ConsumerState<ParentHomeworkScreen> {
  List<Map<String, dynamic>> _assignments = [];
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
      final r = await ApiClient.instance.get('/parent/assignments');
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      if (data is Map) {
        final pending = safeMapList(data['pending']).map(
          (entry) => {
            ...entry,
            'submission_status': 'pending',
          },
        );
        final submitted = safeMapList(data['submitted']).map(
          (entry) => {
            ...entry,
            'submission_status':
                (entry['marks'] == null) ? 'submitted' : 'graded',
          },
        );
        _assignments = [...pending, ...submitted];
      } else {
        _assignments = [];
      }
    } catch (e, st) {
      debugPrint('ParentHomeworkScreen load failed: $e\n$st');
      _assignments = [];
      _error = 'Could not load homework.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();
    if (_error != null) {
      return ErrorContainer(errorMessage: _error!, onRetry: _load);
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: _assignments.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                NoDataContainer(
                  title: 'No homework assigned',
                  subtitle: 'Assigned homework will appear here.',
                  icon: Icons.assignment_outlined,
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _assignments.length,
              itemBuilder: (_, i) {
                final a = _assignments[i];
                final details = <String>[
                  if ((a['student_name'] ?? '').toString().isNotEmpty)
                    a['student_name'].toString(),
                  if ((a['subject'] ?? '').toString().isNotEmpty)
                    a['subject'].toString(),
                  if ((a['due_date_bs'] ?? '').toString().isNotEmpty)
                    a['due_date_bs'].toString()
                  else if ((a['due_date'] ?? '').toString().isNotEmpty)
                    a['due_date'].toString().split('T').first,
                ].join(' • ');
                final status = (a['submission_status'] ?? 'pending').toString();
                return ESchoolAnimatedEntry(
                  index: i,
                  child: ESchoolCard(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: EdgeInsets.zero,
                    child: ListTile(
                      leading: const Icon(Icons.assignment_outlined),
                      title: Text(a['title']?.toString() ?? 'Assignment'),
                      subtitle: Text(
                        details.isNotEmpty
                            ? details
                            : (a['description']?.toString() ?? ''),
                      ),
                      trailing: Chip(label: Text(status)),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
