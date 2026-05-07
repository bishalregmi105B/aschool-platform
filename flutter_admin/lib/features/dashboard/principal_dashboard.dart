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

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() => _loading = true);
    try {
      final responses = await Future.wait([
        ApiClient.instance.get('/schools/dashboard-stats'),
        ApiClient.instance.get('/ai-tools/daily-brief'),
        ApiClient.instance.get('/schools/recent-activity'),
      ]);

      setState(() {
        _stats = responses[0].data['data'];
        _brief = responses[1].data['data'];
        _recentActivity =
            List<Map<String, dynamic>>.from(responses[2].data['data'] ?? []);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: LoadingShimmer());

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
    final briefText = _brief?['summary'] ?? 'Loading daily brief...';
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
    final attendance = _stats?['today_attendance_pct'] ?? 0;
    final feeCollected = _stats?['today_fee_collected'] ?? 0;
    final messages = _stats?['unanswered_messages'] ?? 0;
    final riskStudents = _stats?['risk_students'] ?? 0;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.5,
      children: [
        _KpiCard(
          title: 'Attendance',
          value: '$attendance%',
          icon: Icons.people,
          color: ASchoolTheme.success,
        ),
        _KpiCard(
          title: 'Fee Collected',
          value: 'Rs. $feeCollected',
          icon: Icons.payments,
          color: ASchoolTheme.primary,
        ),
        _KpiCard(
          title: 'Messages',
          value: '$messages',
          icon: Icons.message,
          color: ASchoolTheme.warning,
        ),
        _KpiCard(
          title: 'Risk Students',
          value: '$riskStudents',
          icon: Icons.warning_amber,
          color: riskStudents > 0 ? ASchoolTheme.danger : ASchoolTheme.success,
        ),
      ],
    );
  }

  Widget _buildRevenueChart() {
    final feeData = List<Map<String, dynamic>>.from(_stats?['fee_chart'] ?? []);

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
                    child: Icon(_activityIcon(activity['type']),
                        size: 18, color: ASchoolTheme.primary),
                  ),
                  title: Text(activity['message'] ?? '',
                      style: const TextStyle(fontSize: 14)),
                  subtitle: Text(activity['time_ago'] ?? '',
                      style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                )),
          ],
        ),
      ),
    );
  }

  IconData _activityIcon(String? type) {
    switch (type) {
      case 'fee':
        return Icons.payments;
      case 'attendance':
        return Icons.fact_check;
      case 'admission':
        return Icons.person_add;
      case 'bus':
        return Icons.directions_bus;
      default:
        return Icons.info_outline;
    }
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
