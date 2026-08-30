import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// AI-powered school analytics dashboard (PluginGate: basic_reports)
class AnalyticsScreen extends ConsumerStatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  ConsumerState<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends ConsumerState<AnalyticsScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await ApiClient.instance.get('/analytics/overview');
      setState(() {
        _data = resp.data['data'];
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('AnalyticsScreen load failed: $e\n$st');
      setState(() {
        _error = 'Could not load analytics.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'basic_reports',
      child: _loading
          ? const LoadingShimmer()
          : _error != null
              ? ErrorContainer(errorMessage: _error!, onRetry: _load)
              : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildKpiRow(),
                  const SizedBox(height: 20),
                  _buildAttendanceTrend(),
                  const SizedBox(height: 20),
                  _buildFeeCollection(),
                  const SizedBox(height: 20),
                  _buildAiInsights(),
                ],
              ),
            ),
    );
  }

  Widget _buildKpiRow() {
    final kpis = safeMapOrNull(_data?['kpis']) ?? const {};
    return Row(children: [
      _kpi('Students', '${kpis['total_students'] ?? 0}', Icons.people,
          ASchoolTheme.primary),
      const SizedBox(width: 12),
      _kpi('Teachers', '${kpis['total_teachers'] ?? 0}', Icons.school,
          ASchoolTheme.secondary),
      const SizedBox(width: 12),
      _kpi('Avg Attendance', '${kpis['avg_attendance'] ?? 0}%',
          Icons.check_circle, ASchoolTheme.success),
    ]);
  }

  Widget _kpi(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(value,
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Text(label,
                style: TextStyle(fontSize: 11, color: Colors.grey[600])),
          ]),
        ),
      ),
    );
  }

  Widget _buildAttendanceTrend() {
    final points = List<Map<String, dynamic>>.from(
        _data?['attendance_trend'] ?? []);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Attendance Trend (30 days)',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: points.isEmpty
                  ? const Center(child: Text('No data'))
                  : LineChart(LineChartData(
                      gridData: const FlGridData(show: false),
                      titlesData: const FlTitlesData(show: false),
                      borderData: FlBorderData(show: false),
                      lineBarsData: [
                        LineChartBarData(
                          spots: points
                              .asMap()
                              .entries
                              .map((e) => FlSpot(e.key.toDouble(),
                                  (e.value['pct'] ?? 0).toDouble()))
                              .toList(),
                          isCurved: true,
                          color: ASchoolTheme.primary,
                          barWidth: 3,
                          dotData: const FlDotData(show: false),
                          belowBarData: BarAreaData(
                            show: true,
                            color: ASchoolTheme.primary.withAlpha(30),
                          ),
                        ),
                      ],
                    )),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeeCollection() {
    final months = List<Map<String, dynamic>>.from(
        _data?['fee_trend'] ?? []);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Fee Collection Trend',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: months.isEmpty
                  ? const Center(child: Text('No data'))
                  : BarChart(BarChartData(
                      gridData: const FlGridData(show: false),
                      titlesData: FlTitlesData(
                        leftTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                        topTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                        rightTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false)),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            getTitlesWidget: (v, _) {
                              final idx = v.toInt();
                              if (idx < 0 || idx >= months.length) {
                                return const SizedBox.shrink();
                              }
                              return Text(
                                  months[idx]['month']?.toString() ?? '',
                                  style: const TextStyle(fontSize: 10));
                            },
                          ),
                        ),
                      ),
                      borderData: FlBorderData(show: false),
                      barGroups: months
                          .asMap()
                          .entries
                          .map((e) => BarChartGroupData(x: e.key, barRods: [
                                BarChartRodData(
                                  toY:
                                      (e.value['amount'] ?? 0).toDouble(),
                                  color: ASchoolTheme.primary,
                                  width: 16,
                                  borderRadius: const BorderRadius.vertical(
                                      top: Radius.circular(4)),
                                ),
                              ]))
                          .toList(),
                    )),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAiInsights() {
    final insights = List<String>.from(_data?['ai_insights'] ?? []);
    if (insights.isEmpty) return const SizedBox.shrink();
    return Card(
      color: const Color(0xFFFFFBEB),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.auto_awesome, color: ASchoolTheme.warning),
              const SizedBox(width: 8),
              Text('AI Insights',
                  style: Theme.of(context).textTheme.titleMedium),
            ]),
            const SizedBox(height: 12),
            ...insights.map((i) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('• ', style: TextStyle(fontSize: 16)),
                      Expanded(child: Text(i)),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }
}
