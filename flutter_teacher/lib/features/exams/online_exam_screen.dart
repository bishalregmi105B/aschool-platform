import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class OnlineExamScreen extends ConsumerStatefulWidget {
  const OnlineExamScreen({super.key});

  @override
  ConsumerState<OnlineExamScreen> createState() => _OnlineExamScreenState();
}

class _OnlineExamScreenState extends ConsumerState<OnlineExamScreen> {
  List<Map<String, dynamic>> _exams = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/exams/online');
      final data = (res.data is Map<String, dynamic>) ? res.data['data'] : null;
      _exams = data is List
          ? data
              .whereType<Map>()
              .map((row) => Map<String, dynamic>.from(row))
              .toList()
          : [];
    } catch (_) {
      _exams = [];
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
              child: _exams.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        NoDataContainer(
                          title: 'No online exams configured',
                          subtitle:
                              'Create an online exam to start assigning tests.',
                          icon: Icons.computer_outlined,
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _exams.length,
                      itemBuilder: (context, index) {
                        final exam = _exams[index];
                        return ESchoolAnimatedEntry(
                          index: index,
                          child: ESchoolCard(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.computer_outlined),
                              title: Text(exam['title']?.toString() ??
                                  exam['name']?.toString() ??
                                  'Online Exam'),
                              subtitle: Text(
                                  '${exam['total_questions'] ?? 0} questions • ${exam['duration_minutes'] ?? exam['duration'] ?? '-'} minutes'),
                              trailing: Chip(
                                label: Text(
                                    exam['status']?.toString() ?? 'upcoming'),
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
        label: const Text('Create Exam'),
      ),
    );
  }

  Future<void> _showCreateDialog() async {
    final titleCtrl = TextEditingController();
    final durationCtrl = TextEditingController(text: '30');
    final marksCtrl = TextEditingController(text: '0');
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => ESchoolDialog(
        icon: Icons.computer_outlined,
        title: 'Create Online Exam',
        subtitle: 'Set title, duration, and marks for the exam.',
        actions: [
          ESchoolSecondaryButton(
            label: 'Cancel',
            onPressed: () => Navigator.pop(dialogContext),
          ),
          ESchoolPrimaryButton(
            label: 'Create',
            icon: Icons.add_task_rounded,
            onPressed: () async {
              final title = titleCtrl.text.trim();
              if (title.isEmpty) return;
              await ApiClient.instance.post('/exams/online', data: {
                'title': title,
                'duration_minutes':
                    int.tryParse(durationCtrl.text.trim()) ?? 30,
                'total_marks': int.tryParse(marksCtrl.text.trim()) ?? 0,
                'questions': [],
                'status': 'upcoming',
              });
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
              hintText: 'Unit Test 1',
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 10),
            ESchoolTextEditor(
              controller: durationCtrl,
              label: 'Duration (Minutes)',
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 10),
            ESchoolTextEditor(
              controller: marksCtrl,
              label: 'Total Marks',
              keyboardType: TextInputType.number,
            ),
          ],
        ),
      ),
    );
    titleCtrl.dispose();
    durationCtrl.dispose();
    marksCtrl.dispose();
  }
}
