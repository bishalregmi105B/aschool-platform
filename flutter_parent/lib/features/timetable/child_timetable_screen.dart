import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

class ChildTimetableScreen extends ConsumerWidget {
  const ChildTimetableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedChildId = ref.watch(selectedChildIdForApiProvider);
    final state = ref.watch(parentTimetableProvider(selectedChildId));

    return state.when(
      loading: () => const LoadingShimmer(),
      error: (err, _) => ErrorContainer(
        errorMessage: err.toString(),
        onRetry: () => ref.invalidate(parentTimetableProvider(selectedChildId)),
      ),
      data: (slots) => RefreshIndicator(
        onRefresh: () =>
            ref.refresh(parentTimetableProvider(selectedChildId).future),
        child: slots.isEmpty
            ? ListView(
                children: const [
                  SizedBox(height: 120),
                  NoDataContainer(
                    title: 'No timetable slots found',
                    subtitle: 'Class schedule will appear here.',
                    icon: Icons.schedule_rounded,
                  ),
                ],
              )
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: slots.length,
                itemBuilder: (_, i) {
                  final slot = slots[i];
                  final subject = slot['is_break'] == true
                      ? 'Break'
                      : (slot['subject']?.toString().isNotEmpty == true
                          ? slot['subject'].toString()
                          : 'Period ${slot['period_number'] ?? '-'}');
                  final day = slot['day_of_week'] ?? '-';
                  final period = slot['period_number'] ?? '-';
                  final timeRange =
                      '${slot['start_time'] ?? '-'} - ${slot['end_time'] ?? '-'}';
                  final teacher = slot['teacher']?.toString();

                  return ESchoolAnimatedEntry(
                    index: i,
                    child: ESchoolCard(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: EdgeInsets.zero,
                      child: ListTile(
                        leading: Icon(
                          slot['is_break'] == true
                              ? Icons.free_breakfast_rounded
                              : Icons.schedule_outlined,
                        ),
                        title: Text(subject),
                        subtitle: Text(
                          '$day • Period $period\n$timeRange${teacher != null && teacher.isNotEmpty ? ' • $teacher' : ''}',
                        ),
                        isThreeLine: true,
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
