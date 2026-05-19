import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Student Wellbeing — mood check-ins, counselor sessions, early intervention
class WellbeingScreen extends ConsumerStatefulWidget {
  const WellbeingScreen({super.key});

  @override
  ConsumerState<WellbeingScreen> createState() => _WellbeingScreenState();
}

class _WellbeingScreenState extends ConsumerState<WellbeingScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _classSummaries = [];
  List<Map<String, dynamic>> _alerts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/wellbeing/dashboard'),
        ApiClient.instance.get('/wellbeing/alerts?status=active'),
      ]);
      setState(() {
        _classSummaries = List<Map<String, dynamic>>.from(
          results[0].data['data']?['class_summaries'] ?? [],
        );
        _alerts = List<Map<String, dynamic>>.from(
          results[1].data['data'] ?? [],
        );
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'wellbeing',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Student Wellbeing'),
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Dashboard'),
              Tab(text: 'Alerts'),
              Tab(text: 'Surveys'),
            ],
          ),
        ),
        body: _loading
            ? const LoadingShimmer()
            : TabBarView(
                controller: _tabCtrl,
                children: [
                  _buildDashboard(),
                  _buildAlerts(),
                  _buildSurveys(),
                ],
              ),
      ),
    );
  }

  // ── Dashboard Tab ─────────────────────────────────────────────────────────

  Widget _buildDashboard() {
    if (_classSummaries.isEmpty) {
      return const NoDataContainer(
        title: 'No wellbeing data yet',
        subtitle: 'Students submit daily mood check-ins from their app',
        icon: Icons.sentiment_satisfied_alt_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _classSummaries.length,
        itemBuilder: (context, i) {
          final c = _classSummaries[i];
          final avg = (c['avg_mood'] as num?)?.toDouble() ?? 0.0;
          final atRisk = (c['at_risk_count'] as int?) ?? 0;

          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          c['class_name'] as String? ?? '',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      Text(_moodEmoji(avg),
                          style: const TextStyle(fontSize: 22)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _inlineStat(context, '${c['student_count'] ?? 0}',
                          'Students', ASchoolTheme.primary),
                      const SizedBox(width: 24),
                      _inlineStat(context, avg.toStringAsFixed(1), 'Avg Mood',
                          ASchoolTheme.accent),
                      const SizedBox(width: 24),
                      _inlineStat(
                        context,
                        '$atRisk',
                        'At-Risk',
                        atRisk > 0 ? ASchoolTheme.danger : ASchoolTheme.success,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Alerts Tab ────────────────────────────────────────────────────────────

  Widget _buildAlerts() {
    if (_alerts.isEmpty) {
      return const NoDataContainer(
        title: 'No active alerts',
        subtitle: 'AI monitors mood trends and flags students needing support',
        icon: Icons.notifications_none_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _alerts.length,
        itemBuilder: (context, i) {
          final a = _alerts[i];
          final severity = a['severity'] as String? ?? 'low';
          final severityColor = _severityColor(severity);

          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: severityColor.withAlpha(30),
                  child: Icon(
                    Icons.warning_amber_rounded,
                    color: severityColor,
                    size: 20,
                  ),
                ),
                title: Text(a['student_name'] as String? ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(a['message'] as String? ?? ''),
                trailing: ESchoolInfoPill(
                  icon: Icons.circle,
                  label: severity.toUpperCase(),
                  color: severityColor,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Surveys Tab ───────────────────────────────────────────────────────────

  Widget _buildSurveys() {
    return FutureBuilder(
      future: ApiClient.instance.get('/wellbeing/surveys?per_page=20'),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingShimmer();
        }
        final surveys = List<Map<String, dynamic>>.from(
          snapshot.data?.data?['data'] ?? [],
        );
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Wellbeing Surveys',
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  FilledButton.icon(
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Survey creation coming soon')),
                    ),
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('New Survey'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: surveys.isEmpty
                  ? const NoDataContainer(
                      title: 'No surveys yet',
                      subtitle:
                          'Create wellbeing surveys to check in on students',
                      icon: Icons.poll_rounded,
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      itemCount: surveys.length,
                      itemBuilder: (context, i) {
                        final s = surveys[i];
                        final responseCount =
                            (s['response_count'] as num?)?.toInt() ?? 0;
                        final targetCount =
                            (s['target_count'] as num?)?.toInt() ?? 1;
                        final completion = responseCount / targetCount;
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        s['title'] ?? 'Untitled Survey',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: s['is_active'] == true
                                            ? Colors.green.withAlpha(30)
                                            : Colors.grey.withAlpha(30),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        s['is_active'] == true
                                            ? 'Active'
                                            : 'Closed',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: s['is_active'] == true
                                              ? Colors.green
                                              : Colors.grey,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                if (s['description'] != null) ...[
                                  const SizedBox(height: 4),
                                  Text(s['description'],
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: ASchoolTheme.mutedText)),
                                ],
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '$responseCount / $targetCount responses',
                                            style: const TextStyle(
                                                fontSize: 12,
                                                color: ASchoolTheme.mutedText),
                                          ),
                                          const SizedBox(height: 4),
                                          LinearProgressIndicator(
                                            value: completion.clamp(0.0, 1.0),
                                            backgroundColor:
                                                Colors.grey.withAlpha(50),
                                            color: ASchoolTheme.primary,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  String _moodEmoji(double avg) {
    if (avg >= 4) return '😊';
    if (avg >= 3) return '😐';
    if (avg >= 2) return '😟';
    return '😢';
  }

  Color _severityColor(String severity) {
    switch (severity) {
      case 'high':
        return ASchoolTheme.danger;
      case 'medium':
        return ASchoolTheme.warning;
      default:
        return ASchoolTheme.success;
    }
  }

  Widget _inlineStat(
      BuildContext context, String value, String label, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: color,
              ),
        ),
        Text(
          label,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: ASchoolTheme.mutedText),
        ),
      ],
    );
  }
}
