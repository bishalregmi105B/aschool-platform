import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class AnnouncementScreen extends ConsumerStatefulWidget {
  const AnnouncementScreen({super.key});

  @override
  ConsumerState<AnnouncementScreen> createState() => _AnnouncementScreenState();
}

class _AnnouncementScreenState extends ConsumerState<AnnouncementScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _items = await NoticesService.fetchNotices(targetRole: 'teacher');
    } catch (_) {
      _items = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _loading
          ? const LoadingShimmer()
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        NoDataContainer(
                          title: 'No announcements yet',
                          subtitle:
                              'School-wide announcements will appear here.',
                          icon: Icons.campaign_outlined,
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _items.length,
                      itemBuilder: (_, i) {
                        final item = _items[i];
                        return ESchoolAnimatedEntry(
                          index: i,
                          child: ESchoolCard(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.campaign_outlined),
                              title: Text(
                                  item['title']?.toString() ?? 'Announcement'),
                              subtitle: Text(
                                item['content']?.toString() ?? '',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateDialog,
        icon: const Icon(Icons.add),
        label: const Text('New Announcement'),
      ),
    );
  }

  Future<void> _showCreateDialog() async {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => ESchoolDialog(
        icon: Icons.campaign_outlined,
        title: 'Create Announcement',
        subtitle: 'Publish an update for teachers and administration.',
        actions: [
          ESchoolSecondaryButton(
            label: 'Cancel',
            onPressed: () => Navigator.pop(dialogContext),
          ),
          ESchoolPrimaryButton(
            label: 'Publish',
            icon: Icons.send_rounded,
            onPressed: () async {
              final title = titleCtrl.text.trim();
              final content = contentCtrl.text.trim();
              if (title.isEmpty || content.isEmpty) return;
              await NoticesService.createNotice(
                title: title,
                content: content,
                targetRoles: const ['teacher', 'school_admin'],
              );
              if (!dialogContext.mounted) return;
              Navigator.pop(dialogContext);
              await _load();
            },
          ),
        ],
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ESchoolTextEditor(
              controller: titleCtrl,
              label: 'Title',
              hintText: 'Enter announcement title',
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 10),
            ESchoolTextEditor(
              controller: contentCtrl,
              label: 'Content',
              hintText: 'Write your announcement details',
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
