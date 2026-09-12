import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import 'runner/online_exam_gate_sheet.dart';

class StudentExamsScreen extends ConsumerStatefulWidget {
  const StudentExamsScreen({super.key});

  @override
  ConsumerState<StudentExamsScreen> createState() => _StudentExamsScreenState();
}

class _StudentExamsScreenState extends ConsumerState<StudentExamsScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(examsProvider);

    return PluginGate(
      pluginSlug: 'exams',
      child: Scaffold(
        appBar: const CustomAppBar(
          title: 'Exams',
        ),
        body: Column(
          children: [
            AnimatedToggle(
              values: const ['Offline', 'Online'],
              selectedIndex: _selectedIndex,
              onToggleCallback: (index) {
                setState(() {
                  _selectedIndex = index;
                });
              },
            ),
            Expanded(
              child: PullToRefresh(
                onRefresh: () => ref.read(examsProvider.notifier).refresh(),
                child: state.when(
                  loading: () => const ShimmerLoadingList(),
                  error: (error, stack) => ErrorContainer(
                    errorMessage: error.toString(),
                    onRetry: () => ref.read(examsProvider.notifier).refresh(),
                  ),
                  data: (data) {
                    final isOffline = _selectedIndex == 0;
                    final exams =
                        isOffline ? data.offlineExams : data.onlineExams;

                    if (exams.isEmpty) {
                      return const NoDataContainer(
                        title: 'No upcoming exams 🎉',
                        subtitle:
                            'You have no scheduled exams at the moment.',
                        icon: Icons.quiz_outlined,
                      );
                    }

                    return ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: exams.length,
                      itemBuilder: (context, index) {
                        final exam = exams[index];
                        if (isOffline) {
                          return _OfflineExamCard(exam: exam as Exam);
                        } else {
                          return _OnlineExamCard(exam: exam as OnlineExam);
                        }
                      },
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OfflineExamCard extends StatelessWidget {
  final Exam exam;

  const _OfflineExamCard({required this.exam});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? ASchoolTheme.darkBorder
              : Colors.grey.shade200,
        ),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withAlpha(5),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: ASchoolTheme.secondary.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    exam.term,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: ASchoolTheme.secondary,
                    ),
                  ),
                ),
                const Spacer(),
                const Icon(Icons.date_range_rounded,
                    size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  '${exam.startDate} - ${exam.endDate}',
                  style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w500),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              exam.name,
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            const Text(
              'Subjects Schedule',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? ASchoolTheme.darkBorder
              : Colors.grey.shade200,
        ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: exam.subjects.length,
                separatorBuilder: (_, __) =>
                    Divider(height: 1, color: Colors.grey.shade200),
                itemBuilder: (context, index) {
                  final sub = exam.subjects[index];
                  return Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: Text(
                            sub['subject'] ?? '',
                            style: const TextStyle(
                                fontWeight: FontWeight.w500, fontSize: 13),
                          ),
                        ),
                        Expanded(
                          flex: 3,
                          child: Text(
                            '${sub['date'] ?? ''} • ${sub['time'] ?? ''}',
                            style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'FM: ${sub['full_marks'] ?? ''}',
                            style: TextStyle(
                                fontSize: 11,
                                color: Theme.of(context).colorScheme.onSurface,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnlineExamCard extends StatelessWidget {
  final OnlineExam exam;

  const _OnlineExamCard({required this.exam});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLive = exam.status == 'live' || exam.status == 'ongoing';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isLive ? Colors.green.withAlpha(50) : Colors.grey.shade200),
        boxShadow: isLive
            ? [
                BoxShadow(
                    color: Colors.green.withAlpha(20),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ]
            : [],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(
            color:
                isLive ? Colors.green.withAlpha(20) : Colors.blue.withAlpha(20),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            Icons.computer_rounded,
            color: isLive ? Colors.green : Colors.blue,
            size: 24,
          ),
        ),
        title: Text(
          exam.title,
          style: theme.textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              exam.subject,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.access_time_rounded,
                    size: 14, color: Theme.of(context).colorScheme.onSurfaceVariant),
                const SizedBox(width: 4),
                Text('${exam.durationMinutes} mins',
                    style:
                        TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                const SizedBox(width: 12),
                Icon(Icons.rule_rounded, size: 14, color: Theme.of(context).colorScheme.onSurfaceVariant),
                const SizedBox(width: 4),
                Text('FM: ${exam.totalMarks}',
                    style:
                        TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
              ],
            ),
          ],
        ),
        trailing: isLive
            ? FilledButton(
                onPressed: () => OnlineExamGateSheet.show(context, exam),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.green,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                ),
                child: const Text('Start'),
              )
            : Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  exam.status.toUpperCase(),
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
              ),
      ),
    );
  }
}

