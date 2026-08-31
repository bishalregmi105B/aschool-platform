import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import '../theme/app_theme.dart';

class CalendarWidget extends StatefulWidget {
  final DateTime initialDate;
  final Function(DateTime selectedDate) onDateSelected;
  final Map<DateTime, List<dynamic>>? events;

  const CalendarWidget({
    super.key,
    required this.initialDate,
    required this.onDateSelected,
    this.events,
  });

  @override
  State<CalendarWidget> createState() => _CalendarWidgetState();
}

class _CalendarWidgetState extends State<CalendarWidget> {
  late DateTime _focusedDay;
  late DateTime _selectedDay;

  @override
  void initState() {
    super.initState();
    _focusedDay = widget.initialDate;
    _selectedDay = widget.initialDate;
  }

  List<dynamic> _getEventsForDay(DateTime day) {
    return widget.events?[DateTime(day.year, day.month, day.day)] ?? [];
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
        border: isDark
            ? Border.all(color: ASchoolTheme.darkBorder)
            : null,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(isDark ? 60 : 10),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TableCalendar(
        firstDay: DateTime.utc(2020, 1, 1),
        lastDay: DateTime.utc(2030, 12, 31),
        focusedDay: _focusedDay,
        selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
        onDaySelected: (selectedDay, focusedDay) {
          setState(() {
            _selectedDay = selectedDay;
            _focusedDay = focusedDay;
          });
          widget.onDateSelected(selectedDay);
        },
        eventLoader: _getEventsForDay,
        calendarStyle: CalendarStyle(
          defaultTextStyle: TextStyle(color: theme.colorScheme.onSurface),
          weekendTextStyle:
              TextStyle(color: theme.colorScheme.onSurfaceVariant),
          outsideTextStyle: TextStyle(
              color: theme.colorScheme.onSurfaceVariant.withAlpha(120)),
          selectedTextStyle: TextStyle(
              color: theme.colorScheme.onPrimary,
              fontWeight: FontWeight.bold),
          todayTextStyle: TextStyle(
              color: theme.colorScheme.onPrimary,
              fontWeight: FontWeight.bold),
          rowDecoration: const BoxDecoration(),
          selectedDecoration: BoxDecoration(
            color: theme.colorScheme.primary,
            shape: BoxShape.circle,
          ),
          todayDecoration: BoxDecoration(
            color: theme.colorScheme.primary.withAlpha(isDark ? 150 : 100),
            shape: BoxShape.circle,
          ),
          markerDecoration: BoxDecoration(
            color: theme.colorScheme.tertiary,
            shape: BoxShape.circle,
          ),
        ),
        daysOfWeekStyle: DaysOfWeekStyle(
          weekdayStyle: TextStyle(color: theme.colorScheme.onSurfaceVariant),
          weekendStyle: TextStyle(color: theme.colorScheme.onSurfaceVariant),
        ),
        headerStyle: HeaderStyle(
          formatButtonVisible: false,
          titleCentered: true,
          titleTextStyle:
              TextStyle(color: theme.colorScheme.onSurface, fontSize: 16),
          leftChevronIcon:
              Icon(Icons.chevron_left, color: theme.colorScheme.onSurface),
          rightChevronIcon:
              Icon(Icons.chevron_right, color: theme.colorScheme.onSurface),
        ),
      ),
    );
  }
}
