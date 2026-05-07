import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

// --- State Management ---

final topicClassSubjectProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final academicRepo = ref.read(academicRepositoryProvider);
  final classes = await academicRepo.getClasses();
  return {
    'classes': classes,
  };
});

final topicClassSubjectsProvider = FutureProvider.autoDispose
    .family<List<Subject>, String>((ref, classId) async {
  final academicRepo = ref.read(academicRepositoryProvider);
  return await academicRepo.getSubjects(classId: classId);
});

final topicLessonsProvider = FutureProvider.autoDispose
    .family<List<Lesson>, ({String classId, String subjectId})>(
        (ref, args) async {
  final lessonRepo = ref.read(lessonRepositoryProvider);
  return await lessonRepo.getLessons(args.subjectId, args.classId, '');
});

final topicsListProvider = FutureProvider.autoDispose
    .family<List<Topic>, String>((ref, lessonId) async {
  final lessonRepo = ref.read(lessonRepositoryProvider);
  return await lessonRepo.getTopics(lessonId);
});

// --- UI ---

class CreateTopicScreen extends ConsumerStatefulWidget {
  const CreateTopicScreen({super.key});

  @override
  ConsumerState<CreateTopicScreen> createState() => _CreateTopicScreenState();
}

class _CreateTopicScreenState extends ConsumerState<CreateTopicScreen> {
  String? _selectedClassId;
  String? _selectedSubjectId;
  String? _selectedLessonId;

  void _onClassChanged(String? classId) {
    setState(() {
      _selectedClassId = classId;
      _selectedSubjectId = null;
      _selectedLessonId = null;
    });
  }

  void _onSubjectChanged(String? subjectId) {
    setState(() {
      _selectedSubjectId = subjectId;
      _selectedLessonId = null;
    });
  }

  void _showAddTopicSheet() {
    if (_selectedLessonId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Please select a lesson first.'),
            backgroundColor: Colors.orange),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withAlpha(22),
      builder: (context) => _AddTopicSheet(
        lessonId: _selectedLessonId!,
        onSuccess: () {
          ref.invalidate(topicsListProvider(_selectedLessonId!));
          Navigator.pop(context);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          _buildSelectors(),
          const Divider(height: 1),
          Expanded(child: _buildTopicsList()),
        ],
      ),
      floatingActionButton: _selectedLessonId != null
          ? FloatingActionButton.extended(
              onPressed: _showAddTopicSheet,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add Topic',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              backgroundColor: ASchoolTheme.primary,
              foregroundColor: Colors.white,
            )
          : null,
    );
  }

  Widget _buildSelectors() {
    final state = ref.watch(topicClassSubjectProvider);

    return state.when(
      loading: () => const Padding(
          padding: EdgeInsets.all(16), child: ShimmerLoadingList()),
      error: (err, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: ErrorContainer(
            errorMessage: err.toString(),
            onRetry: () => ref.refresh(topicClassSubjectProvider.future)),
      ),
      data: (data) {
        final classes = data['classes'] as List<ClassModel>;

        return Container(
          color: Colors.white,
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _buildDropdown<String>(
                      label: 'Class Section',
                      value: _selectedClassId,
                      items: classes
                          .map((c) => DropdownMenuItem(
                              value: c.id, child: Text(c.name)))
                          .toList(),
                      onChanged: _onClassChanged,
                      icon: Icons.class_rounded,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _selectedClassId == null
                        ? _buildDropdown<String>(
                            label: 'Subject',
                            value: null,
                            items: [],
                            onChanged: (_) {},
                            icon: Icons.book_rounded,
                          )
                        : _buildSubjectSelector(),
                  ),
                ],
              ),
              if (_selectedClassId != null && _selectedSubjectId != null) ...[
                const SizedBox(height: 16),
                _buildLessonSelector(),
              ]
            ],
          ),
        );
      },
    );
  }

  Widget _buildSubjectSelector() {
    final subjectsState =
        ref.watch(topicClassSubjectsProvider(_selectedClassId!));

    return subjectsState.when(
      loading: () => const Center(
          child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2))),
      error: (_, __) =>
          const Text('Error', style: TextStyle(color: Colors.red)),
      data: (subjects) {
        return _buildDropdown<String>(
          label: 'Subject',
          value: _selectedSubjectId,
          items: subjects
              .map((s) => DropdownMenuItem(value: s.id, child: Text(s.name)))
              .toList(),
          onChanged: _onSubjectChanged,
          icon: Icons.book_rounded,
        );
      },
    );
  }

  Widget _buildLessonSelector() {
    final lessonsState = ref.watch(topicLessonsProvider(
        (classId: _selectedClassId!, subjectId: _selectedSubjectId!)));

    return lessonsState.when(
      loading: () => const Center(
          child: Padding(
              padding: EdgeInsets.all(8.0),
              child: CircularProgressIndicator())),
      error: (_, __) => const Text('Error loading lessons',
          style: TextStyle(color: Colors.red)),
      data: (lessons) {
        if (lessons.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 8.0),
            child: Text('No lessons found for this subject.',
                style: TextStyle(color: Colors.grey)),
          );
        }
        return _buildDropdown<String>(
          label: 'Lesson',
          value: _selectedLessonId,
          items: lessons
              .map((l) => DropdownMenuItem(value: l.id, child: Text(l.name)))
              .toList(),
          onChanged: (v) => setState(() => _selectedLessonId = v),
          icon: Icons.bookmark_rounded,
        );
      },
    );
  }

  Widget _buildDropdown<T>({
    required String label,
    required T? value,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
    required IconData icon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(icon, size: 18, color: ASchoolTheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<T>(
                    value: value,
                    isExpanded: true,
                    hint: Text('Select $label',
                        style: TextStyle(
                            fontSize: 13, color: Colors.grey.shade400)),
                    items: items,
                    onChanged: onChanged,
                    dropdownColor: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTopicsList() {
    if (_selectedLessonId == null) {
      return const Center(
        child: NoDataContainer(
          title: 'Select a Lesson',
          subtitle:
              'Please select a class, subject, and lesson to view or create topics.',
          icon: Icons.topic_rounded,
        ),
      );
    }

    final topicsState = ref.watch(topicsListProvider(_selectedLessonId!));

    return PullToRefresh(
      onRefresh: () =>
          ref.refresh(topicsListProvider(_selectedLessonId!).future),
      child: topicsState.when(
        loading: () => const ShimmerLoadingList(),
        error: (err, stack) => ErrorContainer(
          errorMessage: err.toString(),
          onRetry: () =>
              ref.refresh(topicsListProvider(_selectedLessonId!).future),
        ),
        data: (topics) {
          if (topics.isEmpty) {
            return const NoDataContainer(
              title: 'No Topics Found',
              subtitle:
                  'Tap the button below to add your first topic to this lesson.',
              icon: Icons.create_new_folder_rounded,
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16).copyWith(bottom: 100),
            itemCount: topics.length,
            itemBuilder: (context, index) {
              final topic = topics[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                elevation: 0,
                color: Colors.white,
                child: Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade200),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(16),
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.orange.withAlpha(20),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child:
                          const Icon(Icons.topic_rounded, color: Colors.orange),
                    ),
                    title: Text(topic.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 16)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (topic.description?.isNotEmpty == true) ...[
                          const SizedBox(height: 4),
                          Text(topic.description!,
                              style: TextStyle(
                                  color: Colors.grey.shade600, fontSize: 13),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis),
                        ],
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.attach_file_rounded,
                                size: 14, color: Colors.grey),
                            const SizedBox(width: 4),
                            Text(
                                '${topic.studyMaterials.length} Study Materials',
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey,
                                    fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ],
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded,
                        color: Colors.grey),
                    onTap: () {
                      // Navigate to Study Materials
                    },
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

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

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);

    try {
      await ApiClient.instance.post('/lms/topics', data: {
        'name': _nameCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'lesson_id': widget.lessonId,
      });
      widget.onSuccess();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Failed to save topic'),
            backgroundColor: Colors.red));
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return CustomBottomSheet(
      title: 'Create New Topic',
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: 'Topic Name',
                labelStyle: const TextStyle(fontSize: 14),
                filled: true,
                fillColor: Colors.grey.shade50,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                prefixIcon: const Icon(Icons.title_rounded, size: 20),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _descCtrl,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: 'Description (Optional)',
                labelStyle: const TextStyle(fontSize: 14),
                filled: true,
                fillColor: Colors.grey.shade50,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                alignLabelWithHint: true,
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
                    : const Text('Save Topic',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
