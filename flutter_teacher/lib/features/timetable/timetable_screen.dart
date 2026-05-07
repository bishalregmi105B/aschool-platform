import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Teacher's weekly timetable view
class TimetableScreen extends ConsumerStatefulWidget {
  const TimetableScreen({super.key});

  @override
  ConsumerState<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends ConsumerState<TimetableScreen> {
  Map<String, List<Map<String, dynamic>>> _schedule = {};
  bool _loading = true;
  int _selectedDay = DateTime.now().weekday - 1; // 0-indexed (Mon=0)

  static const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp = await ApiClient.instance.get('/teacher/timetable');
      final data = resp.data['data'] as Map<String, dynamic>? ?? {};
      setState(() {
        _schedule = data.map(
            (k, v) => MapEntry(k, List<Map<String, dynamic>>.from(v as List)));
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();

    final dayKey = _days[_selectedDay].toLowerCase();
    final periods = _schedule[dayKey] ?? [];

    return Column(
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: ESchoolCard(
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading:
                  Icon(Icons.schedule_rounded, color: ASchoolTheme.primary),
              title: Text(
                'Weekly Timetable',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text('Select a day to view periods and class slots.'),
            ),
          ),
        ),
        // Day selector
        SizedBox(
          height: 56,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            itemCount: _days.length,
            itemBuilder: (_, i) {
              final active = i == _selectedDay;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(_days[i]),
                  selected: active,
                  onSelected: (_) => setState(() => _selectedDay = i),
                ),
              );
            },
          ),
        ),

        // Periods
        Expanded(
          child: periods.isEmpty
              ? ListView(
                  children: [
                    const SizedBox(height: 120),
                    NoDataContainer(
                      title: _selectedDay == 5
                          ? 'Saturday - Holiday'
                          : 'No classes for this day',
                      subtitle: 'Your teaching slots will appear here.',
                      icon: Icons.weekend_rounded,
                    ),
                  ],
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: periods.length,
                    itemBuilder: (_, i) => _periodCard(periods[i], i),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _periodCard(Map<String, dynamic> p, int index) {
    final isBreak = p['is_break'] == true;
    if (isBreak) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          const Expanded(child: Divider()),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(p['label'] ?? 'Break',
                style: TextStyle(color: Colors.grey[500], fontSize: 13)),
          ),
          const Expanded(child: Divider()),
        ]),
      );
    }

    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: ASchoolTheme.primary.withAlpha(20),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text('${index + 1}',
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: ASchoolTheme.primary)),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p['subject'] ?? '',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 15)),
                Text(p['class_name'] ?? '',
                    style: TextStyle(fontSize: 13, color: Colors.grey[600])),
              ],
            ),
          ),
          Text(p['time'] ?? '',
              style: TextStyle(fontSize: 12, color: Colors.grey[500])),
        ],
      ),
    );
  }
}
