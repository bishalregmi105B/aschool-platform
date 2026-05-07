import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class StudentTimetable extends ConsumerStatefulWidget {
  const StudentTimetable({super.key});

  @override
  ConsumerState<StudentTimetable> createState() => _StudentTimetableState();
}

class _StudentTimetableState extends ConsumerState<StudentTimetable> {
  static const _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  static const _fullDays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday'
  ];
  int _selectedDay =
      DateTime.now().weekday % 7; // 0=Sun in Nepal (weekday 7=Sun)

  @override
  void initState() {
    super.initState();
    // Adjust for Nepal school week (Sun=0 to Fri=5)
    final now = DateTime.now();
    _selectedDay = now.weekday == 7 ? 0 : now.weekday;
    if (_selectedDay > 5) _selectedDay = 0; // Saturday → show Sunday
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(timetableProvider);

    return Scaffold(
      appBar: const CustomAppBar(
        title: 'Timetable',
        showBackButton: false,
      ),
      body: Column(
        children: [
          FilterChipRow(
            filters: _days,
            selectedFilter: _days[_selectedDay],
            onFilterChanged: (filter) {
              setState(() {
                _selectedDay = _days.indexOf(filter);
              });
            },
          ),
          Expanded(
            child: PullToRefresh(
              onRefresh: () => ref.read(timetableProvider.notifier).refresh(),
              child: state.when(
                loading: () => const ShimmerLoadingList(itemHeight: 90),
                error: (err, stack) => ErrorContainer(
                  errorMessage: err.toString(),
                  onRetry: () => ref.read(timetableProvider.notifier).refresh(),
                ),
                data: (data) {
                  final selectedDay = _fullDays[_selectedDay];
                  final periods = data.where((slot) {
                    final day = slot.dayOfWeek.trim().toLowerCase();
                    if (day.isEmpty) return true;
                    if (day == selectedDay.toLowerCase()) return true;
                    return day
                        .startsWith(selectedDay.substring(0, 3).toLowerCase());
                  }).toList()
                    ..sort((a, b) {
                      final pA = a.periodNumber ?? 0;
                      final pB = b.periodNumber ?? 0;
                      if (pA != pB) return pA.compareTo(pB);
                      return a.startTime.compareTo(b.startTime);
                    });

                  if (periods.isEmpty) {
                    return const NoDataContainer(
                      title: 'No classes found',
                      subtitle: 'No periods scheduled for this day',
                      icon: Icons.event_busy_outlined,
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: periods.length,
                    itemBuilder: (context, index) {
                      final period = periods[index];
                      return _TimetableSlotCard(
                        slot: period,
                        index: index,
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimetableSlotCard extends StatelessWidget {
  final TimetableSlot slot;
  final int index;

  const _TimetableSlotCard({required this.slot, required this.index});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final subject = slot.subjectLabel;
    final lower = subject.toLowerCase();
    final isBreak = slot.isBreak || lower == 'break' || lower == 'lunch';

    if (isBreak) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Expanded(child: Divider(color: Colors.grey.shade300)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              margin: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: Colors.orange.withAlpha(20),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.orange.withAlpha(50)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.restaurant_menu_rounded,
                      size: 16, color: Colors.orange),
                  const SizedBox(width: 8),
                  Text(
                    subject,
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.orange),
                  ),
                ],
              ),
            ),
            Expanded(child: Divider(color: Colors.grey.shade300)),
          ],
        ),
      );
    }

    final isCurrent = slot.isCurrent;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCurrent ? ASchoolTheme.primary : Colors.grey.shade200,
          width: isCurrent ? 2 : 1,
        ),
        boxShadow: isCurrent
            ? [
                BoxShadow(
                    color: ASchoolTheme.primary.withAlpha(20),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ]
            : [],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: isCurrent ? ASchoolTheme.primary : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  '${slot.periodNumber ?? index + 1}',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: isCurrent ? Colors.white : Colors.black87,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    subject,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: isCurrent ? ASchoolTheme.primary : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.person_outline,
                          size: 14, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Text(
                        slot.teacherLabel,
                        style: TextStyle(
                            color: Colors.grey.shade600, fontSize: 13),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  slot.startTime,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: isCurrent ? ASchoolTheme.primary : Colors.black87,
                  ),
                ),
                Text(
                  slot.endTime,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
                  ),
                ),
                if (isCurrent) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.green.withAlpha(20),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('NOW',
                        style: TextStyle(
                            color: Colors.green,
                            fontSize: 10,
                            fontWeight: FontWeight.bold)),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
