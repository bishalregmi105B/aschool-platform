import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

// --- State Management ---

final lessonClassSubjectProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final academicRepo = ref.read(academicRepositoryProvider);
  final classes = await academicRepo.getClasses();
  return {
    'classes': classes,
  };
});

final classSubjectsProvider = FutureProvider.autoDispose
    .family<List<Subject>, String>((ref, classId) async {
  final academicRepo = ref.read(academicRepositoryProvider);
  return await academicRepo.getSubjects(classId: classId);
});

final lessonsListProvider = FutureProvider.autoDispose
    .family<List<Lesson>, ({String classId, String subjectId})>(
        (ref, args) async {
  final lessonRepo = ref.read(lessonRepositoryProvider);
  return await lessonRepo.getLessons(args.subjectId, args.classId, '');
});

// --- UI ---

class CreateLessonScreen extends ConsumerStatefulWidget {
  const CreateLessonScreen({super.key});

  @override
  ConsumerState<CreateLessonScreen> createState() => _CreateLessonScreenState();
}

class _CreateLessonScreenState extends ConsumerState<CreateLessonScreen> {
  String? _selectedClassId;
  String? _selectedSubjectId;

  void _onClassChanged(String? classId) {
    setState(() {
      _selectedClassId = classId;
      _selectedSubjectId = null;
    });
  }

  void _showAddLessonSheet() {
    if (_selectedClassId == null || _selectedSubjectId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Please select a class and subject first.'),
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
      builder: (context) => _AddLessonSheet(
        classId: _selectedClassId!,
        subjectId: _selectedSubjectId!,
        onSuccess: () {
          ref.invalidate(lessonsListProvider(
              (classId: _selectedClassId!, subjectId: _selectedSubjectId!)));
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
          Expanded(child: _buildLessonsList()),
        ],
      ),
      floatingActionButton: _selectedSubjectId != null
          ? FloatingActionButton.extended(
              onPressed: _showAddLessonSheet,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add Lesson',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              backgroundColor: ASchoolTheme.primary,
              foregroundColor: Colors.white,
            )
          : null,
    );
  }

  Widget _buildSelectors() {
    final state = ref.watch(lessonClassSubjectProvider);

    return state.when(
      loading: () => const Padding(
          padding: EdgeInsets.all(16), child: ShimmerLoadingList()),
      error: (err, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: ErrorContainer(
            errorMessage: err.toString(),
            onRetry: () => ref.refresh(lessonClassSubjectProvider.future)),
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
            ],
          ),
        );
      },
    );
  }

  Widget _buildSubjectSelector() {
    final subjectsState = ref.watch(classSubjectsProvider(_selectedClassId!));

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
          onChanged: (v) => setState(() => _selectedSubjectId = v),
          icon: Icons.book_rounded,
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

  Widget _buildLessonsList() {
    if (_selectedClassId == null || _selectedSubjectId == null) {
      return const Center(
        child: NoDataContainer(
          title: 'Select Class & Subject',
          subtitle:
              'Please select a class and subject to view or create lessons.',
          icon: Icons.menu_book_rounded,
        ),
      );
    }

    final lessonsState = ref.watch(lessonsListProvider(
        (classId: _selectedClassId!, subjectId: _selectedSubjectId!)));

    return PullToRefresh(
      onRefresh: () => ref.refresh(lessonsListProvider(
          (classId: _selectedClassId!, subjectId: _selectedSubjectId!)).future),
      child: lessonsState.when(
        loading: () => const ShimmerLoadingList(),
        error: (err, stack) => ErrorContainer(
          errorMessage: err.toString(),
          onRetry: () => ref.refresh(lessonsListProvider(
                  (classId: _selectedClassId!, subjectId: _selectedSubjectId!))
              .future),
        ),
        data: (lessons) {
          if (lessons.isEmpty) {
            return const NoDataContainer(
              title: 'No Lessons Found',
              subtitle:
                  'Tap the button below to add your first lesson for this subject.',
              icon: Icons.chrome_reader_mode_rounded,
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16).copyWith(bottom: 100),
            itemCount: lessons.length,
            itemBuilder: (context, index) {
              final lesson = lessons[index];
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
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: ASchoolTheme.primary.withAlpha(20),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${index + 1}',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: ASchoolTheme.primary,
                            fontSize: 16),
                      ),
                    ),
                    title: Text(lesson.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 16)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (lesson.description?.isNotEmpty == true) ...[
                          const SizedBox(height: 4),
                          Text(lesson.description!,
                              style: TextStyle(
                                  color: Colors.grey.shade600, fontSize: 13),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis),
                        ],
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.topic_rounded,
                                size: 14, color: Colors.grey),
                            const SizedBox(width: 4),
                            Text('${lesson.topics.length} Topics',
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey,
                                    fontWeight: FontWeight.w600)),
                            const SizedBox(width: 12),
                            const Icon(Icons.attach_file_rounded,
                                size: 14, color: Colors.grey),
                            const SizedBox(width: 4),
                            Text('${lesson.studyMaterials.length} Materials',
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
                      // Navigate to Topics screen or pass state
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

class _AddLessonSheet extends StatefulWidget {
  final String classId;
  final String subjectId;
  final VoidCallback onSuccess;

  const _AddLessonSheet(
      {required this.classId,
      required this.subjectId,
      required this.onSuccess});

  @override
  State<_AddLessonSheet> createState() => _AddLessonSheetState();
}

class _AddLessonSheetState extends State<_AddLessonSheet> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  bool _saving = false;

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);

    try {
      await ApiClient.instance.post('/lms/lessons', data: {
        'name': _nameCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'class_id': widget.classId,
        'subject_id': widget.subjectId,
      });
      widget.onSuccess();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Failed to save lesson'),
            backgroundColor: Colors.red));
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return CustomBottomSheet(
      title: 'Create New Lesson',
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: 'Lesson Name',
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
                    : const Text('Save Lesson',
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
