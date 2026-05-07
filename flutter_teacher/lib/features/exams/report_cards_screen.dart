import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

final teacherReportExamOptionsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.instance.get('/exams');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? const []);
});

final teacherReportClassOptionsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.instance.get('/teacher/my-classes');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? const []);
});

final teacherReportCardsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, ({String examId, String classId})>(
  (ref, args) async {
    final resp = await ApiClient.instance
        .get('/exams/${args.examId}/report-cards?class_id=${args.classId}');
    return List<Map<String, dynamic>>.from(resp.data['data'] ?? const []);
  },
);

class TeacherReportCardsScreen extends ConsumerStatefulWidget {
  const TeacherReportCardsScreen({super.key});

  @override
  ConsumerState<TeacherReportCardsScreen> createState() =>
      _TeacherReportCardsScreenState();
}

class _TeacherReportCardsScreenState
    extends ConsumerState<TeacherReportCardsScreen> {
  String? _examId;
  String? _classId;

  @override
  Widget build(BuildContext context) {
    final examsState = ref.watch(teacherReportExamOptionsProvider);
    final classesState = ref.watch(teacherReportClassOptionsProvider);

    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
          child: Row(
            children: [
              Expanded(
                child: examsState.when(
                  loading: () => const _DropdownSkeleton(),
                  error: (_, __) => const _DropdownError(label: 'Exam'),
                  data: (exams) => _SimpleDropdown(
                    label: 'Exam',
                    value: _examId,
                    icon: Icons.quiz_rounded,
                    items: exams
                        .map(
                          (exam) => DropdownMenuItem<String>(
                            value: exam['id']?.toString(),
                            child: Text(exam['name']?.toString() ?? 'Exam'),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      setState(() {
                        _examId = value;
                      });
                    },
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: classesState.when(
                  loading: () => const _DropdownSkeleton(),
                  error: (_, __) => const _DropdownError(label: 'Class'),
                  data: (classes) => _SimpleDropdown(
                    label: 'Class',
                    value: _classId,
                    icon: Icons.class_rounded,
                    items: classes
                        .map(
                          (klass) => DropdownMenuItem<String>(
                            value: klass['id']?.toString(),
                            child: Text(klass['name']?.toString() ?? 'Class'),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      setState(() {
                        _classId = value;
                      });
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: _buildBody(),
        ),
      ],
    );
  }

  Widget _buildBody() {
    if (_examId == null || _classId == null) {
      return const Center(
        child: NoDataContainer(
          title: 'Select Exam And Class',
          subtitle: 'Choose both fields above to view generated report cards.',
          icon: Icons.assignment_rounded,
        ),
      );
    }

    final state = ref.watch(
        teacherReportCardsProvider((examId: _examId!, classId: _classId!)));

    return PullToRefresh(
      onRefresh: () => ref.refresh(
          teacherReportCardsProvider((examId: _examId!, classId: _classId!))
              .future),
      child: state.when(
        loading: () => const ShimmerLoadingList(itemCount: 8),
        error: (err, _) => ErrorContainer(
          errorMessage: err.toString(),
          onRetry: () => ref.refresh(
              teacherReportCardsProvider((examId: _examId!, classId: _classId!))
                  .future),
        ),
        data: (cards) {
          if (cards.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 120),
                NoDataContainer(
                  title: 'No report cards found',
                  subtitle:
                      'Generate and publish report cards to see them here.',
                  icon: Icons.receipt_long_outlined,
                ),
              ],
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: cards.length,
            itemBuilder: (_, index) {
              final card = cards[index];
              final pct = (card['percentage'] as num?)?.toDouble() ??
                  (card['total_percentage'] as num?)?.toDouble() ??
                  0;
              final grade = card['grade']?.toString() ??
                  card['overall_grade']?.toString() ??
                  '-';
              final rank = card['rank']?.toString() ??
                  card['rank_in_class']?.toString() ??
                  '-';
              final gpa = (card['overall_gpa'] as num?)?.toDouble();

              return ESchoolAnimatedEntry(
                index: index,
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
                          '${pct.toStringAsFixed(0)}%',
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
                              card['student_name']?.toString() ?? 'Student',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Roll ${card['roll_number'] ?? '-'}  •  Rank $rank',
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
                            grade,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                              color: ASchoolTheme.primary,
                            ),
                          ),
                          Text(
                            'GPA ${gpa?.toStringAsFixed(2) ?? '-'}',
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
  final String? value;
  final IconData icon;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?> onChanged;

  const _SimpleDropdown({
    required this.label,
    required this.value,
    required this.icon,
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
          height: 44,
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
  const _DropdownSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 60,
          height: 12,
          color: Colors.grey.shade200,
        ),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          height: 44,
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
