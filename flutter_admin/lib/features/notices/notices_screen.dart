import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class NoticesScreen extends StatefulWidget {
  const NoticesScreen({super.key});

  @override
  State<NoticesScreen> createState() => _NoticesScreenState();
}

class _NoticesScreenState extends State<NoticesScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _notices = [];

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
      _notices = await NoticesService.fetchNotices();
    } catch (_) {
      _error = 'Unable to load notices right now.';
    }
    if (mounted) {
      setState(() => _loading = false);
    }
  }

  Future<void> _createNotice() async {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Add Notice', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(
                  labelText: 'Title', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: contentCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                  labelText: 'Content', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () async {
                  await NoticesService.createNotice(
                    title: titleCtrl.text.trim(),
                    content: contentCtrl.text.trim(),
                    targetRoles: const [
                      'school_admin',
                      'teacher',
                      'parent',
                      'student'
                    ],
                  );
                  if (!mounted) return;
                  Navigator.pop(context);
                },
                child: const Text('Publish Notice'),
              ),
            ),
          ],
        ),
      ),
    );

    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: (_error != null && !_loading && _notices.isEmpty)
          ? Center(child: Text(_error!))
          : NoticeBoardList(
              notices: _notices,
              isLoading: _loading,
              onRefresh: _load,
              emptyTitle: 'No notices published yet',
              emptySubtitle: 'Tap Add Notice to publish your first notice.',
            ),
      floatingActionButton: FloatingActionButton.extended(
          onPressed: _createNotice,
          icon: const Icon(Icons.add),
          label: const Text('Add Notice')),
    );
  }
}
