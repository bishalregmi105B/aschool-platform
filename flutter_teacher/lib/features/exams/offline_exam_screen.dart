import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

final teacherOfflineExamsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.instance.get('/exams');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? const []);
});

final teacherOfflineClassesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.instance.get('/teacher/my-classes');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? const []);
});

final teacherOfflineResultsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, ({String examId, String classId})>(
  (ref, args) async {
    final resp = await ApiClient.instance
        .get('/exams/${args.examId}/results?class_id=${args.classId}');
    return List<Map<String, dynamic>>.from(resp.data['data'] ?? const []);
  },
);

class OfflineExamScreen extends ConsumerStatefulWidget {
  const OfflineExamScreen({super.key});

  @override
  ConsumerState<OfflineExamScreen> createState() => _OfflineExamScreenState();
}

class _OfflineExamScreenState extends ConsumerState<OfflineExamScreen> {
  String? _selectedExamId;
  String? _selectedClassId;

  void _showSubjectResults(Map<String, dynamic> row) {
    final subjects = ((row['subject_results'] as List?) ??
            (row['subjects'] as List?) ??
            const [])
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();

    if (subjects.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No subject-wise marks available for this student.'),
        ),
      );
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return FractionallySizedBox(
          heightFactor: 0.72,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row['student_name']?.toString() ?? 'Student',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Rank #${row['rank'] ?? '-'} • ${row['class_name'] ?? ''}',
                  style: const TextStyle(
                    color: ASchoolTheme.mutedText,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 12),
                const Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Text(
                        'SUBJECT',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: ASchoolTheme.mutedText,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        'SCORE',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: ASchoolTheme.mutedText,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        'GRADE',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: ASchoolTheme.mutedText,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView.separated(
                    itemBuilder: (_, index) {
                      final item = subjects[index];
                      final obtained =
                          (item['total_obtained'] as num?)?.toDouble() ??
                              (item['obtained'] as num?)?.toDouble() ??
                              0;
                      final full = (item['total_full'] as num?)?.toDouble() ??
                          (item['full_marks'] as num?)?.toDouble() ??
                          0;
                      final grade = item['grade']?.toString() ?? '-';
                      final failed =
                          (item['status']?.toString().toLowerCase() ==
                                  'fail') ||
                              (grade.toUpperCase() == 'NG');

                      return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 10),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          color: failed
                              ? Colors.red.withAlpha(12)
                              : Colors.grey.shade50,
                          border: Border.all(
                            color: failed
                                ? Colors.red.withAlpha(35)
                                : Colors.grey.shade200,
                          ),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: Text(
                                item['subject_name']?.toString() ??
                                    item['subject']?.toString() ??
                                    'Subject',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: failed
                                      ? Colors.red.shade700
                                      : Colors.black87,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                '${obtained.toStringAsFixed(0)}/${full.toStringAsFixed(0)}',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                grade,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: failed
                                      ? Colors.red.shade700
                                      : ASchoolTheme.primary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemCount: subjects.length,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        body: Column(
          children: [
            const TabBar(
              tabs: [
                Tab(text: 'Timetable'),
                Tab(text: 'Upload Marks'),
                Tab(text: 'Results'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _buildTimetableTab(),
                  _buildUploadTab(context),
                  _buildResultTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimetableTab() {
    final state = ref.watch(teacherOfflineExamsProvider);
    return PullToRefresh(
      onRefresh: () => ref.refresh(teacherOfflineExamsProvider.future),
      child: state.when(
        loading: () => const ShimmerLoadingList(),
        error: (err, _) => ErrorContainer(
          errorMessage: err.toString(),
          onRetry: () => ref.refresh(teacherOfflineExamsProvider.future),
        ),
        data: (exams) {
          if (exams.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 110),
                NoDataContainer(
                  title: 'No offline exams scheduled',
                  subtitle: 'Create exams from admin panel to view them here.',
                  icon: Icons.event_busy_rounded,
                ),
              ],
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: exams.length,
            itemBuilder: (_, index) {
              final exam = exams[index];
              final status = exam['status']?.toString() ?? 'scheduled';
              return ESchoolAnimatedEntry(
                index: index,
                child: ESchoolCard(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.event_note_rounded),
                    title: Text(exam['name']?.toString() ?? 'Offline Exam'),
                    subtitle: Text(
                      '${exam['class_name'] ?? 'Class'} • ${NepaliFormatter.preferredDateRange(
                        startBs: exam['start_date_bs']?.toString(),
                        endBs: exam['end_date_bs']?.toString(),
                        startAd: exam['start_date']?.toString(),
                        endAd: exam['end_date']?.toString(),
                        separator: ' – ',
                      )}',
                    ),
                    trailing: Chip(
                      label: Text(status),
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildUploadTab(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const ESchoolCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Upload Marks',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              SizedBox(height: 6),
              Text(
                'Use the marks module for class-wise and subject-wise entry.',
                style: TextStyle(color: ASchoolTheme.mutedText),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () {
            context.go('/marks');
          },
          icon: const Icon(Icons.upload_file_rounded),
          label: const Text('Open Marks Entry'),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => context.go('/report-cards'),
          icon: const Icon(Icons.bar_chart_rounded),
          label: const Text('Open Report Cards'),
        ),
      ],
    );
  }

  Widget _buildResultTab() {
    final examsState = ref.watch(teacherOfflineExamsProvider);
    final classesState = ref.watch(teacherOfflineClassesProvider);

    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
          child: Row(
            children: [
              Expanded(
                child: _resultsDropdown(
                  label: 'Exam',
                  icon: Icons.quiz_rounded,
                  value: _selectedExamId,
                  state: examsState,
                  nameKey: 'name',
                  onChanged: (value) => setState(() => _selectedExamId = value),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _resultsDropdown(
                  label: 'Class',
                  icon: Icons.class_rounded,
                  value: _selectedClassId,
                  state: classesState,
                  nameKey: 'name',
                  onChanged: (value) =>
                      setState(() => _selectedClassId = value),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: _buildResultList(),
        ),
      ],
    );
  }

  Widget _resultsDropdown({
    required String label,
    required IconData icon,
    required String? value,
    required AsyncValue<List<Map<String, dynamic>>> state,
    required String nameKey,
    required ValueChanged<String?> onChanged,
  }) {
    return state.when(
      loading: () => _DropdownSkeleton(label: label),
      error: (_, __) => _DropdownError(label: label),
      data: (items) {
        return _SimpleDropdown(
          label: label,
          icon: icon,
          value: value,
          onChanged: onChanged,
          items: items
              .map(
                (item) => DropdownMenuItem<String>(
                  value: item['id']?.toString(),
                  child: Text(item[nameKey]?.toString() ?? label),
                ),
              )
              .toList(),
        );
      },
    );
  }

  Widget _buildResultList() {
    if (_selectedExamId == null || _selectedClassId == null) {
      return const Center(
        child: NoDataContainer(
          title: 'Select exam and class',
          subtitle: 'Choose both filters to view class exam results.',
          icon: Icons.filter_alt_outlined,
        ),
      );
    }

    final state = ref.watch(teacherOfflineResultsProvider(
      (examId: _selectedExamId!, classId: _selectedClassId!),
    ));

    return PullToRefresh(
      onRefresh: () => ref.refresh(teacherOfflineResultsProvider(
        (examId: _selectedExamId!, classId: _selectedClassId!),
      ).future),
      child: state.when(
        loading: () => const ShimmerLoadingList(itemCount: 8),
        error: (err, _) => ErrorContainer(
          errorMessage: err.toString(),
          onRetry: () => ref.refresh(teacherOfflineResultsProvider(
            (examId: _selectedExamId!, classId: _selectedClassId!),
          ).future),
        ),
        data: (rows) {
          if (rows.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 120),
                NoDataContainer(
                  title: 'No results for selected exam',
                  subtitle: 'Publish exam results to see class performance.',
                  icon: Icons.assessment_outlined,
                ),
              ],
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            itemBuilder: (_, index) {
              final row = rows[index];
              return ESchoolAnimatedEntry(
                index: index,
                child: GestureDetector(
                  onTap: () => _showSubjectResults(row),
                  child: ESchoolCard(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: ASchoolTheme.primary.withAlpha(18),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '${((row['percentage'] as num?)?.toDouble() ?? 0).toStringAsFixed(0)}%',
                            style: const TextStyle(
                              color: ASchoolTheme.primary,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                row['student_name']?.toString() ?? 'Student',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Rank #${row['rank'] ?? '-'} • ${row['class_name'] ?? ''}',
                                style: const TextStyle(
                                  color: ASchoolTheme.mutedText,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              row['grade']?.toString() ?? '-',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                color: ASchoolTheme.primary,
                              ),
                            ),
                            Text(
                              'GPA ${((row['gpa'] as num?)?.toDouble() ?? 0).toStringAsFixed(2)}',
                              style: const TextStyle(
                                color: ASchoolTheme.mutedText,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
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

class _SimpleDropdown extends StatelessWidget {
  final String label;
  final IconData icon;
  final String? value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?> onChanged;

  const _SimpleDropdown({
    required this.label,
    required this.icon,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: ASchoolTheme.mutedText,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          height: 42,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Icon(icon, size: 18, color: ASchoolTheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: value,
                    isExpanded: true,
                    hint: Text('Select $label'),
                    items: items,
                    onChanged: onChanged,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DropdownSkeleton extends StatelessWidget {
  final String label;

  const _DropdownSkeleton({required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: ASchoolTheme.mutedText,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          height: 42,
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ],
    );
  }
}

class _DropdownError extends StatelessWidget {
  final String label;

  const _DropdownError({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      '$label unavailable',
      style: const TextStyle(color: ASchoolTheme.danger, fontSize: 12),
    );
  }
}
