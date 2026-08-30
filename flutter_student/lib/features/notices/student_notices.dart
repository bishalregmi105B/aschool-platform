import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class StudentNotices extends ConsumerStatefulWidget {
  const StudentNotices({super.key});

  @override
  ConsumerState<StudentNotices> createState() => _StudentNoticesState();
}

class _StudentNoticesState extends ConsumerState<StudentNotices> {
  List<Map<String, dynamic>> _notices = [];
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
      _notices = await NoticesService.fetchNotices(targetRole: 'student');
    } catch (e, st) {
      debugPrint('StudentNoticesScreen load failed: $e\n$st');
      _error = 'Unable to load notices right now.';
    }
    if (mounted) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null && !_loading && _notices.isEmpty) {
      return Center(child: Text(_error!));
    }

    return NoticeBoardList(
      notices: _notices,
      isLoading: _loading,
      onRefresh: _load,
      emptyTitle: 'No notices for students',
      emptySubtitle: 'School updates for students will appear here.',
    );
  }
}
