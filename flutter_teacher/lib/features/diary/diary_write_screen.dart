import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class DiaryWriteScreen extends ConsumerStatefulWidget {
  const DiaryWriteScreen({super.key});

  @override
  ConsumerState<DiaryWriteScreen> createState() => _DiaryWriteScreenState();
}

class _DiaryWriteScreenState extends ConsumerState<DiaryWriteScreen> {
  List<Map<String, dynamic>> _entries = [];
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
      final r = await ApiClient.instance
          .get('/communications/diary', queryParameters: {'per_page': 100});
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _entries = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (e, st) {
      debugPrint('DiaryWriteScreen load failed: $e\n$st');
      _entries = [];
      _error = 'Could not load diary entries.';
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
          : _error != null
              ? ErrorContainer(errorMessage: _error!, onRetry: _load)
              : RefreshIndicator(
              onRefresh: _load,
              child: _entries.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        NoDataContainer(
                          title: 'No diary entries yet',
                          subtitle:
                              'Create entries for homework and reminders.',
                          icon: Icons.menu_book_outlined,
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _entries.length,
                      itemBuilder: (_, i) {
                        final entry = _entries[i];
                        final published = ((entry['published_at'] ?? '')
                                .toString()
                                .isNotEmpty)
                            ? (entry['published_at'])
                                .toString()
                                .split('T')
                                .first
                            : '-';
                        return ESchoolAnimatedEntry(
                          index: i,
                          child: ESchoolCard(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.menu_book_outlined),
                              title: Text(
                                  entry['title']?.toString() ?? 'Diary Entry'),
                              subtitle: Text(
                                entry['content']?.toString() ?? '',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              trailing: Text(
                                published,
                                style: const TextStyle(
                                  color: ASchoolTheme.mutedText,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddEntryDialog,
        icon: const Icon(Icons.add),
        label: const Text('Add Entry'),
      ),
    );
  }

  Future<void> _showAddEntryDialog() async {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => ESchoolDialog(
        icon: Icons.menu_book_outlined,
        title: 'Add Diary Entry',
        subtitle: 'Create a note for class reminders or assignments.',
        actions: [
          ESchoolSecondaryButton(
            label: 'Cancel',
            onPressed: () => Navigator.pop(dialogContext),
          ),
          ESchoolPrimaryButton(
            label: 'Save',
            icon: Icons.check_rounded,
            onPressed: () async {
              final title = titleCtrl.text.trim();
              final content = contentCtrl.text.trim();
              if (title.isEmpty || content.isEmpty) return;
              await ApiClient.instance.post('/communications/diary', data: {
                'title': title,
                'content': content,
                'is_published': true,
              });
              if (!dialogContext.mounted) return;
              Navigator.pop(dialogContext);
              await _load();
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Diary entry saved')),
              );
            },
          ),
        ],
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ESchoolTextEditor(
              controller: titleCtrl,
              label: 'Title',
              hintText: 'Entry title',
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 10),
            ESchoolTextEditor(
              controller: contentCtrl,
              label: 'Content',
              hintText: 'Write the diary note',
              maxLines: 4,
            ),
          ],
        ),
      ),
    );
    titleCtrl.dispose();
    contentCtrl.dispose();
  }
}
