import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Principal's Command Center — AI brief, live KPIs, revenue, quick actions
class PrincipalDashboard extends ConsumerStatefulWidget {
  const PrincipalDashboard({super.key});

  @override
  ConsumerState<PrincipalDashboard> createState() => _PrincipalDashboardState();
}

class _PrincipalDashboardState extends ConsumerState<PrincipalDashboard> {
  Map<String, dynamic>? _stats;
  Map<String, dynamic>? _brief;
  List<Map<String, dynamic>> _recentActivity = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final responses = await Future.wait([
        // Backend: GET /analytics/overview (analytics.py:288) — real KPI source
        ApiClient.instance.get('/analytics/overview'),
        // Backend route: /ai-tools/insights/daily-brief (ai_tools.py:173)
        ApiClient.instance.get('/ai-tools/insights/daily-brief'),
        // Recent activity: fee payments feed (verified endpoint)
        ApiClient.instance.get('/fees/recent'),
      ]);

      setState(() {
        _stats = responses[0].data['data'];
        _brief = responses[1].data['data'];
        _recentActivity =
            List<Map<String, dynamic>>.from(responses[2].data['data'] ?? []);
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('PrincipalDashboard load failed: $e\n$st');
      setState(() {
        _error = 'Could not load the dashboard.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: LoadingShimmer());
    if (_error != null) {
      return ErrorContainer(errorMessage: _error!, onRetry: _loadDashboard);
    }

    return RefreshIndicator(
      onRefresh: _loadDashboard,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildMorningBrief(),
          const SizedBox(height: 16),
          _buildKpiCards(),
          const SizedBox(height: 16),
          _buildRevenueChart(),
          const SizedBox(height: 16),
          _buildQuickActions(),
          const SizedBox(height: 16),
          _buildRecentActivity(),
        ],
      ),
    );
  }

  Widget _buildMorningBrief() {
    // Backend /ai-tools/insights/daily-brief returns
    // {date, events: [{title, is_holiday}], total_students} — no `summary`.
    String briefText;
    if (_brief == null) {
      briefText = 'Loading daily brief...';
    } else {
      final events = _brief?['events'];
      final parts = <String>[
        if (events is List && events.isNotEmpty)
          'Today: ${events.whereType<Map>().map((e) => e['title']?.toString() ?? '').where((t) => t.isNotEmpty).join(', ')}'
        else if (events is List)
          'No events scheduled today',
        if (_brief?['total_students'] != null)
          '${_brief?['total_students']} active students',
      ];
      briefText = parts.isEmpty ? 'Brief unavailable' : parts.join(' • ');
    }
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                'AI Morning Brief',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.white, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              const NepaliDateDisplay(
                style: TextStyle(color: Colors.white, fontSize: 12),
                adStyle: TextStyle(color: Colors.white70, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            briefText,
            style: const TextStyle(color: Colors.white, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiCards() {
    // Real keys from GET /analytics/overview (analytics.py _overview_payload)
    final attendance = _stats?['attendance_today_percent'] ?? 0;
    final feeCollected = _stats?['fee_collection_this_month'] ?? 0;
    final pendingFees = _stats?['pending_fee_amount'] ?? 0;
    final totalStudents = _stats?['total_students'] ?? 0;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.5,
      children: [
        _KpiCard(
          title: "Today's Attendance",
          value: '$attendance%',
          icon: Icons.people,
          color: ASchoolTheme.success,
        ),
        _KpiCard(
          title: 'Fees This Month',
          value: 'Rs. $feeCollected',
          icon: Icons.payments,
          color: ASchoolTheme.primary,
        ),
        _KpiCard(
          title: 'Pending Fees',
          value: 'Rs. $pendingFees',
          icon: Icons.message,
          color: ASchoolTheme.warning,
        ),
        _KpiCard(
          title: 'Total Students',
          value: '$totalStudents',
          icon: Icons.school,
          color: ASchoolTheme.success,
        ),
      ],
    );
  }

  Widget _buildRevenueChart() {
    // fee_summary.by_class: [{class_name, collected, expected}] — per-class bars
    final feeSummary = _stats?['fee_summary'];
    final feeData = feeSummary is Map<String, dynamic>
        ? List<Map<String, dynamic>>.from(feeSummary['by_class'] ?? [])
        : <Map<String, dynamic>>[];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Revenue (Last 30 Days)',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: feeData.isEmpty
                  ? const Center(child: Text('No data'))
                  : BarChart(
                      BarChartData(
                        barGroups: feeData.asMap().entries.map((e) {
                          return BarChartGroupData(
                            x: e.key,
                            barRods: [
                              BarChartRodData(
                                toY: (e.value['amount'] ?? 0).toDouble(),
                                color: ASchoolTheme.primary,
                                width: 12,
                                borderRadius: const BorderRadius.vertical(
                                    top: Radius.circular(4)),
                              ),
                            ],
                          );
                        }).toList(),
                        titlesData: const FlTitlesData(show: false),
                        borderData: FlBorderData(show: false),
                        gridData: const FlGridData(show: false),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions() {
    return Consumer(builder: (context, ref, _) {
      final plugins = ref.watch(pluginProvider);
      return LayoutBuilder(
        builder: (context, constraints) {
          final columns = _gridColumns(constraints.maxWidth);
          return GridView.count(
            crossAxisCount: columns,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 0.88,
            children: [
              _QuickAction(
                  icon: Icons.campaign,
                  label: 'Notice',
                  onTap: () => context.go('/notices')),
              _QuickAction(
                  icon: Icons.payments,
                  label: 'Collect Fee',
                  onTap: () => context.go('/fees'),
                  locked: !plugins.isInstalled('fees')),
              _QuickAction(
                  icon: Icons.bar_chart,
                  label: 'Reports',
                  onTap: () => context.go('/reports'),
                  locked: !plugins.isInstalled('basic_reports')),
              _QuickAction(
                  icon: Icons.auto_awesome,
                  label: 'AI Tools',
                  onTap: () => context.go('/ai-tools'),
                  locked: !plugins.isInstalled('ai_insights')),
            ],
          );
        },
      );
    });
  }

  int _gridColumns(double width) {
    if (width >= 520) return 4;
    if (width >= 380) return 3;
    return 2;
  }

  Widget _buildRecentActivity() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Recent Activity',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            if (_recentActivity.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('No recent activity'),
              ),
            ..._recentActivity.take(10).map((activity) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    radius: 18,
                    backgroundColor: Colors.blue.withAlpha(30),
                    child: const Icon(Icons.payments,
                        size: 18, color: ASchoolTheme.primary),
                  ),
                  // GET /fees/recent rows: {student_name, fee_type, amount, paid_at, receipt_number}
                  title: Text(
                      '${activity['student_name'] ?? ''} — ${activity['fee_type'] ?? 'Payment'}'
                          .trim(),
                      style: const TextStyle(fontSize: 14)),
                  subtitle: Text(
                      'Rs. ${activity['amount'] ?? 0} · ${activity['receipt_number'] ?? ''}'
                          .trim(),
                      style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                )),
          ],
        ),
      ),
    );
  }

}

class _KpiCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _KpiCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 24),
            const Spacer(),
            Text(value,
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold)),
            Text(title,
                style: TextStyle(color: Colors.grey[600], fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool locked;

  const _QuickAction(
      {required this.icon,
      required this.label,
      required this.onTap,
      this.locked = false});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        if (locked) {
          Navigator.of(context).push(
            MaterialPageRoute(
                builder: (_) => FeatureLockedScreen(featureName: label)),
          );
        } else {
          onTap();
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: locked
              ? Colors.grey.withAlpha(25)
              : ASchoolTheme.primary.withAlpha(15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Column(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: (locked ? Colors.grey : ASchoolTheme.primary)
                        .withAlpha(16),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(locked ? Icons.lock_outline : icon,
                      color: locked ? Colors.grey : ASchoolTheme.primary),
                ),
                const SizedBox(height: 6),
                Expanded(
                  child: Text(label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 11,
                          height: 1.1,
                          fontWeight: FontWeight.w500,
                          color: locked ? Colors.grey : null)),
                ),
              ],
            ),
            if (locked)
              Positioned(
                top: -10,
                right: -6,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade800,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('PRO',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.bold)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
