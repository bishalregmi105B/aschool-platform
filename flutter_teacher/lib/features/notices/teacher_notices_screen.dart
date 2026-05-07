import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Teacher notices — view school notices + create class notices
class TeacherNoticesScreen extends ConsumerStatefulWidget {
  const TeacherNoticesScreen({super.key});

  @override
  ConsumerState<TeacherNoticesScreen> createState() =>
      _TeacherNoticesScreenState();
}

class _TeacherNoticesScreenState extends ConsumerState<TeacherNoticesScreen> {
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
      _notices = await NoticesService.fetchNotices(targetRole: 'teacher');
    } catch (_) {
      _error = 'Unable to load notices right now.';
    }
    if (mounted) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _loading
          ? const LoadingShimmer()
          : (_error != null && _notices.isEmpty)
              ? Center(child: Text(_error!))
              : NoticeBoardList(
                  notices: _notices,
                  isLoading: _loading,
                  onRefresh: _load,
                  emptyTitle: 'No notices for teachers',
                  emptySubtitle:
                      'School and class notices for teachers will appear here.',
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _createNotice,
        icon: const Icon(Icons.add),
        label: const Text('New Notice'),
      ),
    );
  }

  void _createNotice() {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Create Notice',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(
                  labelText: 'Title', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: contentCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                  labelText: 'Content', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () async {
                  await NoticesService.createNotice(
                    title: titleCtrl.text.trim(),
                    content: contentCtrl.text.trim(),
                    targetRoles: const ['teacher', 'school_admin'],
                  );
                  if (!mounted) return;
                  Navigator.pop(context);
                  await _load();
                },
                child: const Text('Publish'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
