import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:table_calendar/table_calendar.dart';
import '../repositories/attendance_repository.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_app_bar.dart';
import '../widgets/error_container.dart';
import '../widgets/shimmer_loading_list.dart';

/// Student attendance view — monthly calendar with color-coded status.
///
/// Audit item: "Student app: No attendance view screen" (Plugin #1, P2)
class StudentAttendanceScreen extends ConsumerStatefulWidget {
  final String studentId;

  const StudentAttendanceScreen({super.key, required this.studentId});

  @override
  ConsumerState<StudentAttendanceScreen> createState() =>
      _StudentAttendanceScreenState();
}

class _StudentAttendanceScreenState
    extends ConsumerState<StudentAttendanceScreen> {
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;
  Map<DateTime, String> _attendanceMap = {};
  bool _isLoading = true;
  String? _error;
  int _totalPresent = 0;
  int _totalAbsent = 0;
  int _totalLate = 0;
  int _totalDays = 0;

  @override
  void initState() {
    super.initState();
    _loadAttendance();
  }

  Future<void> _loadAttendance() async {
    setState(() => _isLoading = true);
    try {
      final repo = AttendanceRepository();
      final response = await repo.getAttendance(
        widget.studentId,
        month: _focusedDay.month.toString(),
        year: _focusedDay.year.toString(),
      );

      final map = <DateTime, String>{};
      int present = 0, absent = 0, late = 0;

      for (final record in response) {
        final date = DateTime.parse(record.date);
        final status = record.status;
        map[DateTime.utc(date.year, date.month, date.day)] = status;

        switch (status.toLowerCase()) {
          case 'present':
            present++;
            break;
          case 'absent':
            absent++;
            break;
          case 'late':
            late++;
            break;
        }
      }

      setState(() {
        _attendanceMap = map;
        _totalPresent = present;
        _totalAbsent = absent;
        _totalLate = late;
        _totalDays = present + absent + late;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('StudentAttendanceScreen load failed: $e');
      setState(() {
        _error = 'Could not load attendance.';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: const CustomAppBar(title: 'My Attendance'),
      body: _isLoading
          ? const ShimmerLoadingList()
          : _error != null
              ? ErrorContainer(
                  errorMessage: _error!,
                  onRetry: _loadAttendance,
                )
              : RefreshIndicator(
              onRefresh: _loadAttendance,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Stats row
                  Row(
                    children: [
                      Expanded(
                        child: _MiniStat(
                          label: 'Present',
                          value: '$_totalPresent',
                          color: Colors.green,
                          percentage: _totalDays > 0
                              ? (_totalPresent / _totalDays * 100)
                              : 0,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _MiniStat(
                          label: 'Absent',
                          value: '$_totalAbsent',
                          color: Colors.red,
                          percentage: _totalDays > 0
                              ? (_totalAbsent / _totalDays * 100)
                              : 0,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _MiniStat(
                          label: 'Late',
                          value: '$_totalLate',
                          color: Colors.orange,
                          percentage: _totalDays > 0
                              ? (_totalLate / _totalDays * 100)
                              : 0,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Overall attendance percentage
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          ASchoolTheme.primary,
                          ASchoolTheme.primary.withAlpha(180),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.pie_chart_outline,
                            color: Colors.white, size: 28),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Attendance Rate',
                              style: TextStyle(
                                  color: Colors.white70, fontSize: 12),
                            ),
                            Text(
                              _totalDays > 0
                                  ? '${(_totalPresent / _totalDays * 100).toStringAsFixed(1)}%'
                                  : 'N/A',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const Spacer(),
                        Text(
                          '$_totalPresent / $_totalDays days',
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Calendar
                  Container(
                    decoration: BoxDecoration(
                      color: theme.cardColor,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withAlpha(10),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: TableCalendar(
                      firstDay: DateTime(2020),
                      lastDay: DateTime(2030),
                      focusedDay: _focusedDay,
                      selectedDayPredicate: (day) =>
                          isSameDay(_selectedDay, day),
                      onDaySelected: (selected, focused) {
                        setState(() {
                          _selectedDay = selected;
                          _focusedDay = focused;
                        });
                      },
                      onPageChanged: (focused) {
                        _focusedDay = focused;
                        _loadAttendance();
                      },
                      calendarBuilders: CalendarBuilders(
                        defaultBuilder: (context, day, focusedDay) {
                          final key =
                              DateTime.utc(day.year, day.month, day.day);
                          final status = _attendanceMap[key];
                          return _CalendarDay(
                            day: day,
                            status: status,
                            isToday: false,
                          );
                        },
                        todayBuilder: (context, day, focusedDay) {
                          final key =
                              DateTime.utc(day.year, day.month, day.day);
                          final status = _attendanceMap[key];
                          return _CalendarDay(
                            day: day,
                            status: status,
                            isToday: true,
                          );
                        },
                      ),
                      headerStyle: const HeaderStyle(
                        formatButtonVisible: false,
                        titleCentered: true,
                      ),
                      calendarStyle: const CalendarStyle(
                        outsideDaysVisible: false,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Legend
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _LegendDot(color: Colors.green, label: 'Present'),
                      const SizedBox(width: 16),
                      _LegendDot(color: Colors.red, label: 'Absent'),
                      const SizedBox(width: 16),
                      _LegendDot(color: Colors.orange, label: 'Late'),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final double percentage;

  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
    required this.percentage,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(50)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(fontSize: 11, color: color.withAlpha(180)),
          ),
          Text(
            '${percentage.toStringAsFixed(0)}%',
            style: TextStyle(fontSize: 10, color: color.withAlpha(140)),
          ),
        ],
      ),
    );
  }
}

class _CalendarDay extends StatelessWidget {
  final DateTime day;
  final String? status;
  final bool isToday;

  const _CalendarDay({
    required this.day,
    this.status,
    this.isToday = false,
  });

  @override
  Widget build(BuildContext context) {
    Color? bgColor;
    Color textColor = Theme.of(context).textTheme.bodyMedium?.color ?? Colors.black;

    switch (status?.toLowerCase()) {
      case 'present':
        bgColor = Colors.green.withAlpha(40);
        textColor = Colors.green.shade800;
        break;
      case 'absent':
        bgColor = Colors.red.withAlpha(40);
        textColor = Colors.red.shade800;
        break;
      case 'late':
        bgColor = Colors.orange.withAlpha(40);
        textColor = Colors.orange.shade800;
        break;
    }

    return Container(
      margin: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
        border: isToday
            ? Border.all(color: ASchoolTheme.primary, width: 2)
            : null,
      ),
      alignment: Alignment.center,
      child: Text(
        '${day.day}',
        style: TextStyle(
          color: textColor,
          fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
          fontSize: 13,
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}
