/// Topic Detail Screen — shows topic content and study materials
/// Teachers can: view/edit topic description, upload study materials
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

final topicMaterialsProvider = FutureProvider.autoDispose
    .family<List<StudyMaterial>, String>((ref, topicId) async {
  final resp =
      await ApiClient.instance.get('/lms/materials?topic_id=$topicId');
  if (resp.data['success'] == true) {
    return (resp.data['data'] as List)
        .map((e) => StudyMaterial.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
  return [];
});

class TopicDetailScreen extends ConsumerStatefulWidget {
  final Topic topic;
  final String lessonId;

  const TopicDetailScreen(
      {super.key, required this.topic, required this.lessonId});

  @override
  ConsumerState<TopicDetailScreen> createState() => _TopicDetailScreenState();
}

class _TopicDetailScreenState extends ConsumerState<TopicDetailScreen> {
  bool _uploading = false;

  Future<void> _uploadMaterial() async {
    setState(() => _uploading = true);
    try {
      final file = await FileUploadService.instance.pickAndUploadImage(
        module: UploadModule.lms,
        linkedEntityId: widget.topic.id,
      );
      if (file == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Upload cancelled')),
          );
        }
        return;
      }
      await ApiClient.instance.post('/lms/materials', data: {
        'topic_id': widget.topic.id,
        'lesson_id': widget.lessonId,
        'name': file.originalName,
        'file_url': file.fileUrl,
        'type': file.fileType,
      });
      if (mounted) {
        ref.refresh(topicMaterialsProvider(widget.topic.id));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Material uploaded successfully!'),
              backgroundColor: Colors.green),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Upload failed'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final materialsState =
        ref.watch(topicMaterialsProvider(widget.topic.id));

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text(widget.topic.name,
            style:
                const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(
            icon: _uploading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.upload_file_rounded),
            tooltip: 'Upload Material',
            onPressed: _uploading ? null : _uploadMaterial,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16).copyWith(bottom: 80),
        children: [
          // Topic Info Card
          Card(
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16)),
            elevation: 0,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: ASchoolTheme.primary.withAlpha(20),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.topic_rounded,
                            color: ASchoolTheme.primary, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(widget.topic.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16)),
                            Text('Topic',
                                style: TextStyle(
                                    color: Colors.grey.shade500,
                                    fontSize: 12)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (widget.topic.description?.isNotEmpty == true) ...[
                    const SizedBox(height: 14),
                    const Divider(),
                    const SizedBox(height: 10),
                    Text(
                      widget.topic.description!,
                      style: TextStyle(
                          color: Colors.grey.shade700,
                          fontSize: 14,
                          height: 1.5),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Study Materials Section
          Row(
            children: [
              const Text('Study Materials',
                  style:
                      TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const Spacer(),
              UploadButton(
                label: 'Upload',
                icon: Icons.add_rounded,
                onTap: _uploadMaterial,
              ),
            ],
          ),
          const SizedBox(height: 12),

          materialsState.when(
            loading: () => const ShimmerLoadingList(),
            error: (e, _) => ErrorContainer(
              errorMessage: e.toString(),
              onRetry: () =>
                  ref.refresh(topicMaterialsProvider(widget.topic.id)),
            ),
            data: (materials) {
              if (materials.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(32),
                  alignment: Alignment.center,
                  child: Column(
                    children: [
                      Icon(Icons.folder_open_rounded,
                          size: 56, color: Colors.grey.shade300),
                      const SizedBox(height: 12),
                      Text('No materials yet',
                          style: TextStyle(
                              color: Colors.grey.shade500,
                              fontSize: 15,
                              fontWeight: FontWeight.w500)),
                      const SizedBox(height: 4),
                      Text('Upload PDFs, images or documents',
                          style: TextStyle(
                              color: Colors.grey.shade400, fontSize: 13)),
                    ],
                  ),
                );
              }
              return Column(
                children: materials
                    .map((m) => _MaterialTile(material: m))
                    .toList(),
              );
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _uploading ? null : _uploadMaterial,
        icon: const Icon(Icons.upload_file_rounded),
        label: const Text('Upload Material'),
        backgroundColor: ASchoolTheme.primary,
        foregroundColor: Colors.white,
      ),
    );
  }
}

class _MaterialTile extends StatelessWidget {
  final StudyMaterial material;

  const _MaterialTile({required this.material});

  IconData get _icon {
    if (material.isVideo) return Icons.play_circle_rounded;
    if (material.isPdf) return Icons.picture_as_pdf_rounded;
    if (material.type == 'image') return Icons.image_rounded;
    return Icons.insert_drive_file_rounded;
  }

  Color get _color {
    if (material.isVideo) return Colors.purple;
    if (material.isPdf) return Colors.red;
    if (material.type == 'image') return Colors.blue;
    return Colors.orange;
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 0,
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: _color.withAlpha(20),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(_icon, color: _color, size: 22),
        ),
        title: Text(material.name,
            style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
        subtitle: Text(
          material.type?.toUpperCase() ?? 'FILE',
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        ),
        trailing: IconButton(
          icon: const Icon(Icons.open_in_new_rounded, size: 20),
          color: Colors.grey,
          onPressed: () {
            AttachmentViewerWidget(
              attachmentUrls: [material.fileUrl],
            );
          },
        ),
      ),
    );
  }
}
