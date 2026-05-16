/// Lesson Detail Screen — shows topics and study materials for a lesson
/// Teachers can: view/create topics, upload study materials
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';
import 'topic_detail_screen.dart';

// ─── Providers ───────────────────────────────────────────────────────────────

final lessonTopicsProvider = FutureProvider.autoDispose
    .family<List<Topic>, String>((ref, lessonId) async {
  final resp = await ApiClient.instance
      .get('/lms/topics?lesson_id=$lessonId');
  if (resp.data['success'] == true) {
    return (resp.data['data'] as List)
        .map((e) => Topic.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
  return [];
});

final lessonMaterialsProvider = FutureProvider.autoDispose
    .family<List<StudyMaterial>, String>((ref, lessonId) async {
  final resp = await ApiClient.instance
      .get('/lms/materials?lesson_id=$lessonId');
  if (resp.data['success'] == true) {
    return (resp.data['data'] as List)
        .map((e) => StudyMaterial.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
  return [];
});

// ─── Screen ──────────────────────────────────────────────────────────────────

class LessonDetailScreen extends ConsumerStatefulWidget {
  final Lesson lesson;

  const LessonDetailScreen({super.key, required this.lesson});

  @override
  ConsumerState<LessonDetailScreen> createState() => _LessonDetailScreenState();
}

class _LessonDetailScreenState extends ConsumerState<LessonDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _uploadMaterial() async {
    final file = await FileUploadService.instance.pickAndUploadImage(
      module: UploadModule.lms,
      linkedEntityId: widget.lesson.id,
    );
    if (file == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Upload cancelled or failed')),
        );
      }
      return;
    }
    // Save material linked to lesson
    try {
      await ApiClient.instance.post('/lms/materials', data: {
        'lesson_id': widget.lesson.id,
        'name': file.originalName,
        'file_url': file.fileUrl,
        'type': file.fileType,
      });
      if (mounted) {
        ref.refresh(lessonMaterialsProvider(widget.lesson.id));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Material uploaded!'),
              backgroundColor: Colors.green),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to save material'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showAddTopicSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _AddTopicSheet(
        lessonId: widget.lesson.id,
        onSuccess: () {
          Navigator.pop(context);
          ref.refresh(lessonTopicsProvider(widget.lesson.id));
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text(widget.lesson.name,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.topic_rounded), text: 'Topics'),
            Tab(icon: Icon(Icons.attach_file_rounded), text: 'Materials'),
          ],
          labelColor: ASchoolTheme.primary,
          unselectedLabelColor: Colors.grey,
          indicatorColor: ASchoolTheme.primary,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.upload_file_rounded),
            tooltip: 'Upload Material',
            onPressed: _uploadMaterial,
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _TopicsTab(lesson: widget.lesson, onAddTopic: _showAddTopicSheet),
          _MaterialsTab(lesson: widget.lesson),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddTopicSheet,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Topic'),
        backgroundColor: ASchoolTheme.primary,
        foregroundColor: Colors.white,
      ),
    );
  }
}

// ─── Topics Tab ─────────────────────────────────────────────────────────────

class _TopicsTab extends ConsumerWidget {
  final Lesson lesson;
  final VoidCallback onAddTopic;

  const _TopicsTab({required this.lesson, required this.onAddTopic});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final topicsState = ref.watch(lessonTopicsProvider(lesson.id));

    return topicsState.when(
      loading: () => const ShimmerLoadingList(),
      error: (e, _) => ErrorContainer(
        errorMessage: e.toString(),
        onRetry: () => ref.refresh(lessonTopicsProvider(lesson.id)),
      ),
      data: (topics) {
        if (topics.isEmpty) {
          return NoDataContainer(
            title: 'No Topics Yet',
            subtitle: 'Add your first topic to build this lesson plan.',
            icon: Icons.topic_outlined,
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(16).copyWith(bottom: 100),
          itemCount: topics.length,
          itemBuilder: (context, i) {
            final topic = topics[i];
            return _TopicCard(topic: topic, index: i, lessonId: lesson.id);
          },
        );
      },
    );
  }
}

class _TopicCard extends ConsumerWidget {
  final Topic topic;
  final int index;
  final String lessonId;

  const _TopicCard(
      {required this.topic, required this.index, required this.lessonId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => TopicDetailScreen(
                topic: topic,
                lessonId: lessonId,
              ),
            ),
          );
        },
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade200),
            borderRadius: BorderRadius.circular(16),
          ),
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: ASchoolTheme.primary.withAlpha(20),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    '${index + 1}',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: ASchoolTheme.primary),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(topic.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 15)),
                    if (topic.description?.isNotEmpty == true) ...[
                      const SizedBox(height: 4),
                      Text(topic.description!,
                          style: TextStyle(
                              color: Colors.grey.shade600, fontSize: 13),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                    ],
                    if (topic.studyMaterials.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      AttachmentCountChip(
                          count: topic.studyMaterials.length),
                    ],
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Materials Tab ───────────────────────────────────────────────────────────

class _MaterialsTab extends ConsumerWidget {
  final Lesson lesson;

  const _MaterialsTab({required this.lesson});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final materialsState = ref.watch(lessonMaterialsProvider(lesson.id));

    return materialsState.when(
      loading: () => const ShimmerLoadingList(),
      error: (e, _) => ErrorContainer(
        errorMessage: e.toString(),
        onRetry: () => ref.refresh(lessonMaterialsProvider(lesson.id)),
      ),
      data: (materials) {
        if (materials.isEmpty) {
          return const NoDataContainer(
            title: 'No Study Materials',
            subtitle: 'Upload PDFs, images, or documents using the upload button.',
            icon: Icons.folder_open_rounded,
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(16).copyWith(bottom: 100),
          itemCount: materials.length,
          itemBuilder: (context, i) {
            final m = materials[i];
            return _MaterialTile(material: m);
          },
        );
      },
    );
  }
}

class _MaterialTile extends StatelessWidget {
  final StudyMaterial material;

  const _MaterialTile({required this.material});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 0,
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: _MaterialIcon(url: material.fileUrl, type: material.type),
        title: Text(material.name,
            style: const TextStyle(fontWeight: FontWeight.w500)),
        subtitle: Text(
          material.type?.toUpperCase() ?? 'FILE',
          style: TextStyle(
              fontSize: 11,
              color: Colors.grey.shade500,
              fontWeight: FontWeight.w600),
        ),
        trailing: IconButton(
          icon: const Icon(Icons.open_in_new_rounded, size: 20, color: Colors.grey),
          onPressed: () async {
            final uri = Uri.parse(material.fileUrl);
            try {
              // ignore: deprecated_member_use
              // Using url_launcher to open file
            } catch (_) {}
          },
        ),
      ),
    );
  }
}

class _MaterialIcon extends StatelessWidget {
  final String url;
  final String? type;

  const _MaterialIcon({required this.url, this.type});

  @override
  Widget build(BuildContext context) {
    IconData icon;
    Color color;
    if (type == 'image' || url.endsWith('.jpg') || url.endsWith('.png')) {
      icon = Icons.image_rounded;
      color = Colors.blue;
    } else if (type == 'pdf' || url.endsWith('.pdf')) {
      icon = Icons.picture_as_pdf_rounded;
      color = Colors.red;
    } else if (type == 'video') {
      icon = Icons.play_circle_rounded;
      color = Colors.purple;
    } else {
      icon = Icons.insert_drive_file_rounded;
      color = Colors.orange;
    }

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, color: color, size: 22),
    );
  }
}

// ─── Add Topic Sheet ─────────────────────────────────────────────────────────

class _AddTopicSheet extends StatefulWidget {
  final String lessonId;
  final VoidCallback onSuccess;

  const _AddTopicSheet({required this.lessonId, required this.onSuccess});

  @override
  State<_AddTopicSheet> createState() => _AddTopicSheetState();
}

class _AddTopicSheetState extends State<_AddTopicSheet> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  bool _saving = false;

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      await ApiClient.instance.post('/lms/topics', data: {
        'lesson_id': widget.lessonId,
        'name': _nameCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
      });
      widget.onSuccess();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to add topic'),
              backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
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
          const Text('Add New Topic',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: 20),
          TextField(
            controller: _nameCtrl,
            autofocus: true,
            decoration: InputDecoration(
              labelText: 'Topic Name *',
              filled: true,
              fillColor: Colors.grey.shade50,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
              prefixIcon: const Icon(Icons.topic_rounded, size: 20),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _descCtrl,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: 'Description / Notes (optional)',
              filled: true,
              fillColor: Colors.grey.shade50,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton(
              onPressed: _saving ? null : _save,
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
                  : const Text('Save Topic',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}
