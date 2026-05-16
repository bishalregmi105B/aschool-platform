import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Student Attendance — View personal attendance record and statistics
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
  String _selectedMonth = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/student/attendance',
          queryParameters: _selectedMonth.isNotEmpty
              ? {'month': _selectedMonth}
              : null);
      final payload = res.data;
      setState(() {
        _stats = (payload?['stats'] as Map?)?.cast<String, dynamic>();
        _records = (payload?['records'] as List?) ?? [];
      });
    } catch (_) {}
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
                          value:
                              '${_stats?['attendance_rate'] ?? 0}%',
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
                                    (r['status'] as String?) ?? 'unknown';
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
                                  subtitle:
                                      r['subject'] != null
                                          ? Text(r['subject'])
                                          : null,
                                  trailing: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color:
                                          _statusColor(status).withAlpha(25),
                                      borderRadius:
                                          BorderRadius.circular(12),
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
                      // Calendar tab placeholder
                      const Center(
                        child: NoDataContainer(
                          title: 'Calendar View',
                          subtitle:
                              'Monthly calendar view coming soon',
                          icon: Icons.calendar_month_rounded,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
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
