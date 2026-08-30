/// Announcement Screen — with attachment support and rich cards
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

final announcementsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.instance.get('/announcements');
  if (resp.data['success'] == true) {
    return List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
  }
  return [];
});

class AnnouncementScreen extends ConsumerWidget {
  const AnnouncementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(announcementsProvider);

    return Scaffold(
      body: PullToRefresh(
        onRefresh: () => ref.refresh(announcementsProvider.future),
        child: state.when(
          loading: () => const ShimmerLoadingList(),
          error: (e, _) => ErrorContainer(
            errorMessage: e.toString(),
            onRetry: () => ref.refresh(announcementsProvider.future),
          ),
          data: (items) {
            if (items.isEmpty) {
              return const NoDataContainer(
                title: 'No Announcements',
                subtitle: 'Class announcements will appear here.',
                icon: Icons.campaign_outlined,
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(16).copyWith(bottom: 100),
              itemCount: items.length,
              itemBuilder: (context, i) {
                return ESchoolAnimatedEntry(
                  index: i,
                  child: _AnnouncementCard(data: items[i]),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateSheet(context, ref),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Announcement',
            style: TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: ASchoolTheme.primary,
        foregroundColor: Colors.white,
      ),
    );
  }

  void _showCreateSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _CreateAnnouncementSheet(
        onSuccess: () {
          Navigator.pop(context);
          ref.refresh(announcementsProvider.future);
        },
      ),
    );
  }
}

// ─── Card ────────────────────────────────────────────────────────────────────

class _AnnouncementCard extends StatelessWidget {
  final Map<String, dynamic> data;

  const _AnnouncementCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final title = safeString(data['title'], fallback: 'Announcement');
    final message = safeString(data['message'] ?? data['content']);
    final createdByName = safeStringOrNull(data['created_by_name']);
    final createdAt = safeString(data['created_at']);
    final fileUrl = safeStringOrNull(data['file_url']);
    final urls = safeStringList(data['attachment_urls']);
    final attachmentUrls = urls.isNotEmpty
        ? urls
        : (fileUrl != null && fileUrl.isNotEmpty ? [fileUrl] : <String>[]);

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      elevation: 0,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade100),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: ASchoolTheme.primary.withAlpha(8),
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(18)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: ASchoolTheme.primary.withAlpha(20),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.campaign_rounded,
                        color: ASchoolTheme.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15)),
                        if (createdByName != null)
                          Text('By $createdByName',
                              style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontSize: 12)),
                      ],
                    ),
                  ),
                  if (attachmentUrls.isNotEmpty)
                    AttachmentCountChip(count: attachmentUrls.length),
                ],
              ),
            ),
            // Body
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(message,
                      style: TextStyle(
                          color: Colors.grey.shade700,
                          fontSize: 14,
                          height: 1.5)),
                  if (attachmentUrls.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    AttachmentViewerWidget(
                        attachmentUrls: attachmentUrls,
                        baseUrl: AppConstants.baseUrl),
                  ],
                  if (createdAt.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      _formatDate(createdAt),
                      style: TextStyle(
                          color: Colors.grey.shade400,
                          fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String raw) {
    try {
      final dt = DateTime.parse(raw).toLocal();
      return '${dt.day}/${dt.month}/${dt.year} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      debugPrint('AnnouncementScreen _formatDate parse failed: $e');
      return raw;
    }
  }
}

// ─── Create Sheet ─────────────────────────────────────────────────────────────

class _CreateAnnouncementSheet extends StatefulWidget {
  final VoidCallback onSuccess;

  const _CreateAnnouncementSheet({required this.onSuccess});

  @override
  State<_CreateAnnouncementSheet> createState() =>
      _CreateAnnouncementSheetState();
}

class _CreateAnnouncementSheetState
    extends State<_CreateAnnouncementSheet> {
  final _titleCtrl = TextEditingController();
  final _msgCtrl = TextEditingController();
  bool _saving = false;
  String? _uploadedFileUrl;
  String? _uploadedFileName;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _msgCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickAttachment() async {
    final file = await FileUploadService.instance.pickAndUploadImage(
      module: UploadModule.announcements,
    );
    if (file != null && mounted) {
      setState(() {
        _uploadedFileUrl = file.fileUrl;
        _uploadedFileName = file.originalName;
      });
    }
  }

  Future<void> _submit() async {
    final title = _titleCtrl.text.trim();
    final message = _msgCtrl.text.trim();
    if (title.isEmpty || message.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Title and message are required'),
            backgroundColor: Colors.orange),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await ApiClient.instance.post('/announcements', data: {
        'title': title,
        'message': message,
        if (_uploadedFileUrl != null)
          'attachment_urls': [_uploadedFileUrl],
      });
      widget.onSuccess();
    } catch (e, st) {
      debugPrint('AnnouncementScreen post failed: $e\n$st');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to post announcement'),
              backgroundColor: Colors.red),
        );
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.campaign_rounded, color: ASchoolTheme.primary),
              const SizedBox(width: 10),
              const Text('New Announcement',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 18)),
              const Spacer(),
              IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _titleCtrl,
            decoration: InputDecoration(
              labelText: 'Title *',
              filled: true,
              fillColor: Colors.grey.shade50,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
              prefixIcon:
                  const Icon(Icons.title_rounded, size: 20),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _msgCtrl,
            maxLines: 4,
            decoration: InputDecoration(
              labelText: 'Message *',
              filled: true,
              fillColor: Colors.grey.shade50,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 14),
          // Attachment section
          if (_uploadedFileUrl != null)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.green.withAlpha(15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.green.withAlpha(50)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.attach_file_rounded,
                      size: 18, color: Colors.green),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _uploadedFileName ?? 'Attachment',
                      style: const TextStyle(
                          color: Colors.green, fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => setState(() {
                      _uploadedFileUrl = null;
                      _uploadedFileName = null;
                    }),
                    child: const Icon(Icons.close_rounded,
                        size: 16, color: Colors.green),
                  ),
                ],
              ),
            )
          else
            OutlinedButton.icon(
              onPressed: _pickAttachment,
              icon: const Icon(Icons.attach_file_rounded, size: 18),
              label: const Text('Attach Image / File'),
              style: OutlinedButton.styleFrom(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: ASchoolTheme.primary,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _saving
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('Publish Announcement',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}
