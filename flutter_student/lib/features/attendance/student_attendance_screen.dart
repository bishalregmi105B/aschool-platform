import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Student Attendance — View personal attendance record and statistics
///
/// Uses the real backend routes:
/// - GET /attendance/student/{studentId} (records, optional ?month=MM&year=YYYY)
/// - GET /attendance/student/{studentId}/summary (present/absent/late counts)
/// The student id comes from the shared currentStudentProvider (resolved from
/// /students?user_id=...); there is no /student/attendance endpoint.
class StudentAttendanceScreen extends ConsumerStatefulWidget {
  const StudentAttendanceScreen({super.key});

  @override
  ConsumerState<StudentAttendanceScreen> createState() =>
      _StudentAttendanceScreenState();
}

class _StudentAttendanceScreenState
    extends ConsumerState<StudentAttendanceScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<String, dynamic>? _stats;
  List<dynamic> _records = [];
  bool _loading = true;
  String? _error;
  String _selectedMonth = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Resolve the student profile first — attendance routes are keyed by
      // student id, not by the logged-in user id.
      final student = await ref.read(currentStudentProvider.future);
      final studentId = student?.id;
      if (studentId == null || studentId.isEmpty) {
        setState(() => _error = 'Could not find your student profile.');
        setState(() => _loading = false);
        return;
      }
      final month = _selectedMonth.isNotEmpty ? _selectedMonth : null;
      final recordsRes = await ApiClient.instance.get(
          '/attendance/student/$studentId',
          queryParameters: month != null ? {'month': month} : null);
      final summaryRes =
          await ApiClient.instance.get('/attendance/student/$studentId/summary');
      final summary = safeMap(envelopeData(summaryRes.data));
      setState(() {
        _records = safeList(envelopeData(recordsRes.data));        _stats = {
          'present': summary['present_days'] ?? 0,
          'absent': summary['absent_days'] ?? 0,
          'late': summary['late_days'] ?? 0,
          'attendance_rate': summary['percentage'] ?? 0,
        };
      });
    } catch (e) {
      debugPrint('StudentAttendanceScreen load failed: $e');
      setState(() => _error = 'Could not load your attendance.');
    }
    setState(() => _loading = false);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'present':
        return Colors.green;
      case 'absent':
        return Colors.red;
      case 'late':
        return Colors.orange;
      case 'holiday':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: const CustomAppBar(title: 'My Attendance'),
      body: _loading
          ? const LoadingShimmer()
          : _error != null
              ? ErrorContainer(
                  errorMessage: _error!,
                  onRetry: _load,
                )
              : Column(
              children: [
                // Stats banner
                if (_stats != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 20),
                    color: theme.colorScheme.primary.withAlpha(15),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _StatChip(
                          label: 'Present',
                          value: '${_stats?['present'] ?? 0}',
                          color: Colors.green,
                        ),
                        _StatChip(
                          label: 'Absent',
                          value: '${_stats?['absent'] ?? 0}',
                          color: Colors.red,
                        ),
                        _StatChip(
                          label: 'Late',
                          value: '${_stats?['late'] ?? 0}',
                          color: Colors.orange,
                        ),
                        _StatChip(
                          label: 'Rate',
                          value: '${_stats?['attendance_rate'] ?? 0}%',
                          color: theme.colorScheme.primary,
                        ),
                      ],
                    ),
                  ),
                TabBar(
                  controller: _tabController,
                  tabs: const [
                    Tab(text: 'Records'),
                    Tab(text: 'Calendar'),
                  ],
                ),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      // Records tab
                      _records.isEmpty
                          ? const NoDataContainer(
                              title: 'No attendance records',
                              subtitle: 'Records will appear here',
                              icon: Icons.event_available_rounded,
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _records.length,
                              itemBuilder: (context, index) {
                                final r = _records[index];
                                final status =
                                    safeStringOrNull(r['status']) ?? 'unknown';
                                return ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor:
                                        _statusColor(status).withAlpha(30),
                                    child: Icon(
                                      status == 'present'
                                          ? Icons.check_circle_rounded
                                          : status == 'absent'
                                              ? Icons.cancel_rounded
                                              : Icons.access_time_rounded,
                                      color: _statusColor(status),
                                      size: 20,
                                    ),
                                  ),
                                  title: Text(r['date'] ?? '—',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w500)),
                                  subtitle: r['subject'] != null
                                      ? Text(r['subject'])
                                      : null,
                                  trailing: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: _statusColor(status).withAlpha(25),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      status.toUpperCase(),
                                      style: TextStyle(
                                        color: _statusColor(status),
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                      // Calendar tab — monthly attendance heatmap
                      _buildMonthlyCalendar(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildMonthlyCalendar() {
    final now = DateTime.now();
    final firstDay = DateTime(now.year, now.month, 1);
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
    final startWeekday = firstDay.weekday % 7; // 0=Sun

    // Build attendance map: date string → status
    final Map<String, String> dateStatus = {};
    for (final r in _records) {
      final date = safeStringOrNull(r['date']);
      final status = safeStringOrNull(r['status']);
      if (date != null && status != null) {
        dateStatus[date] = status;
      }
    }

    Color _dayColor(int day) {
      final dateStr =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
      final status = dateStatus[dateStr];
      switch (status?.toLowerCase()) {
        case 'present':
          return Colors.green;
        case 'absent':
          return Colors.red;
        case 'late':
          return Colors.orange;
        case 'holiday':
          return Colors.blue;
        default:
          return Colors.grey.shade200;
      }
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${_monthName(now.month)} ${now.year}',
                style:
                    const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              // Legend
              Row(
                children: [
                  _Legend(color: Colors.green, label: 'P'),
                  const SizedBox(width: 6),
                  _Legend(color: Colors.red, label: 'A'),
                  const SizedBox(width: 6),
                  _Legend(color: Colors.orange, label: 'L'),
                  const SizedBox(width: 6),
                  _Legend(color: Colors.blue, label: 'H'),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Day headers
          Row(
            children: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                .map((d) => Expanded(
                      child: Center(
                        child: Text(d,
                            style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey)),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 8),
          // Calendar grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 1,
              crossAxisSpacing: 4,
              mainAxisSpacing: 4,
            ),
            itemCount: startWeekday + daysInMonth,
            itemBuilder: (context, index) {
              if (index < startWeekday) return const SizedBox.shrink();
              final day = index - startWeekday + 1;
              final color = _dayColor(day);
              final isToday = day == now.day;
              return Container(
                decoration: BoxDecoration(
                  color:
                      color.withAlpha(color == Colors.grey.shade200 ? 255 : 50),
                  borderRadius: BorderRadius.circular(6),
                  border:
                      isToday ? Border.all(color: Colors.blue, width: 2) : null,
                ),
                child: Center(
                  child: Text(
                    '$day',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
                      color: color == Colors.grey.shade200
                          ? Colors.black54
                          : color,
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 20),
          // Summary
          if (_stats != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Monthly Summary',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _SummaryItem(
                            label: 'Total Days', value: '${_records.length}'),
                        _SummaryItem(
                          label: 'Present',
                          value:
                              '${_records.where((r) => r['status'] == 'present').length}',
                          color: Colors.green,
                        ),
                        _SummaryItem(
                          label: 'Absent',
                          value:
                              '${_records.where((r) => r['status'] == 'absent').length}',
                          color: Colors.red,
                        ),
                        _SummaryItem(
                          label: 'Rate',
                          value: '${_stats?['attendance_rate'] ?? 0}%',
                          color: Colors.blue,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _monthName(int month) {
    const names = [
      '',
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return names[month];
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  const _Legend({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
                color: color, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 2),
        Text(label, style: const TextStyle(fontSize: 10)),
      ],
    );
  }
}

class _SummaryItem extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  const _SummaryItem({required this.label, required this.value, this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: TextStyle(
                fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatChip({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }
}
