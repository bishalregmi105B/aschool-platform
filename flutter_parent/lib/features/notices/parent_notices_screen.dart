import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Parent notices — school announcements and updates
class ParentNoticesScreen extends ConsumerStatefulWidget {
  const ParentNoticesScreen({super.key});

  @override
  ConsumerState<ParentNoticesScreen> createState() =>
      _ParentNoticesScreenState();
}

class _ParentNoticesScreenState extends ConsumerState<ParentNoticesScreen> {
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
      _notices = await NoticesService.fetchNotices(targetRole: 'parent');
    } catch (e, st) {
      debugPrint('ParentNoticesScreen load failed: $e\n$st');
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
      emptyTitle: 'No notices for parents',
      emptySubtitle: 'Updates and announcements for parents will appear here.',
    );
  }
}
