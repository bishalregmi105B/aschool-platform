import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// School-wide attendance overview — heatmap by class, stats, drill-down
class AttendanceOverview extends ConsumerStatefulWidget {
  const AttendanceOverview({super.key});

  @override
  ConsumerState<AttendanceOverview> createState() => _AttendanceOverviewState();
}

class _AttendanceOverviewState extends ConsumerState<AttendanceOverview> {
  Map<String, dynamic>? _stats;
  List<Map<String, dynamic>> _classWise = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp =
          await ApiClient.instance.get('/attendance/school-overview');
      setState(() {
        _stats = resp.data['data']?['summary'];
        _classWise = List<Map<String, dynamic>>.from(
            resp.data['data']?['class_wise'] ?? []);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildSummaryCards(),
          const SizedBox(height: 16),
          Text('Class-wise Attendance',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ..._classWise.map(_buildClassTile),
        ],
      ),
    );
  }

  Widget _buildSummaryCards() {
    return Row(
      children: [
        _StatCard(
          label: 'Today',
          value: '${_stats?['today_pct'] ?? 0}%',
          color: ASchoolTheme.success,
        ),
        const SizedBox(width: 12),
        _StatCard(
          label: 'This Week',
          value: '${_stats?['week_pct'] ?? 0}%',
          color: ASchoolTheme.primary,
        ),
        const SizedBox(width: 12),
        _StatCard(
          label: 'This Month',
          value: '${_stats?['month_pct'] ?? 0}%',
          color: ASchoolTheme.secondary,
        ),
      ],
    );
  }

  Widget _buildClassTile(Map<String, dynamic> c) {
    final pct = (c['present_pct'] ?? 0).toDouble();
    final color = pct >= 90
        ? ASchoolTheme.success
        : pct >= 75
            ? ASchoolTheme.warning
            : ASchoolTheme.danger;

    return Card(
      child: ListTile(
        title: Text('${c['class_name']} ${c['section_name'] ?? ''}'),
        subtitle: LinearProgressIndicator(
          value: pct / 100,
          color: color,
          backgroundColor: color.withAlpha(30),
        ),
        trailing: Text('${pct.toStringAsFixed(0)}%',
            style: TextStyle(
                fontWeight: FontWeight.bold, color: color, fontSize: 16)),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatCard(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Text(value,
                  style: TextStyle(
                      fontSize: 24, fontWeight: FontWeight.bold, color: color)),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}
