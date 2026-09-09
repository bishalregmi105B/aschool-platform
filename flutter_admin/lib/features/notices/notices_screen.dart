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
    } catch (e, st) {
      debugPrint('NoticesScreen load failed: $e\n$st');
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
                  try {
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
                  } catch (e, st) {
                    debugPrint('NoticesScreen create failed: $e\n$st');
                    if (!mounted) return;
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content:
                              Text('Could not publish notice. Please retry.')),
                    );
                    return;
                  }
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
    final i18n = I18nService.instance;
    return Scaffold(
      body: (_error != null && !_loading && _notices.isEmpty)
          ? Center(child: Text(_error!))
          : NoticeBoardList(
              notices: _notices,
              isLoading: _loading,
              onRefresh: _load,
              emptyTitle: i18n.t('No notices published yet', 'कुनै सूचना छैन'),
              emptySubtitle: i18n.t('Tap Add Notice to publish your first notice.', 'सूचना थप्न थिच्नुहोस्'),
              onNoticeTap: (notice) => _showNoticeActions(notice),
            ),
      floatingActionButton: FloatingActionButton.extended(
          onPressed: _createNotice,
          icon: const Icon(Icons.add),
          label: Text(i18n.t('Add Notice', 'सूचना थप्नुहोस्'))),
    );
  }

  /// Detail + manage sheet: read the full notice, delete (admin).
  void _showNoticeActions(Map<String, dynamic> notice) {
    final noticeId = notice['id']?.toString();
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '${notice['title'] ?? ''}',
                style: Theme.of(sheetContext)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              Text(
                '${notice['published_at'] ?? notice['created_at'] ?? ''}',
                style: Theme.of(sheetContext).textTheme.bodySmall,
              ),
              const SizedBox(height: 10),
              Text(
                '${notice['content'] ?? ''}',
                style: Theme.of(sheetContext).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Theme.of(sheetContext).colorScheme.error,
                  side: BorderSide(
                      color: Theme.of(sheetContext)
                          .colorScheme
                          .error
                          .withValues(alpha: 0.4)),
                ),
                icon: const Icon(Icons.delete_outline, size: 18),
                onPressed: () async {
                  if (noticeId == null) return;
                  Navigator.of(sheetContext).pop();
                  try {
                    await ApiClient.instance.delete('/notices/$noticeId');
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text(I18nService.instance
                              .t('Notice deleted', 'सूचना मेटियो'))),
                    );
                    _load();
                  } catch (_) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Failed to delete notice')),
                    );
                  }
                },
                label: Text(I18nService.instance.t('Delete notice', 'सूचना मेटाउनुहोस्')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
