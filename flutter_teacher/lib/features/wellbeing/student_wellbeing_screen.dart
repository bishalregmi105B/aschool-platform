import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Teacher Wellbeing Monitor — View and respond to student wellbeing check-ins
class StudentWellbeingScreen extends ConsumerStatefulWidget {
  const StudentWellbeingScreen({super.key});

  @override
  ConsumerState<StudentWellbeingScreen> createState() =>
      _StudentWellbeingScreenState();
}

class _StudentWellbeingScreenState extends ConsumerState<StudentWellbeingScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _checkins = [];
  List<dynamic> _alerts = [];
  Map<String, dynamic>? _summary;
  bool _loading = true;
  String? _error;

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
      final res = await ApiClient.instance.get('/teacher/wellbeing');
      final payload = res.data;
      setState(() {
        _checkins = safeList(payload?['checkins']);
        _alerts = safeList(payload?['alerts']);
        _summary = safeMapOrNull(payload?['summary']);
      });
    } catch (e, st) {
      debugPrint('StudentWellbeingScreen load failed: $e\n$st');
      _error = 'Could not load wellbeing check-ins.';
    }
    setState(() => _loading = false);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  IconData _moodIcon(String mood) {
    switch (mood.toLowerCase()) {
      case 'happy':
        return Icons.sentiment_very_satisfied_rounded;
      case 'sad':
        return Icons.sentiment_very_dissatisfied_rounded;
      case 'anxious':
      case 'stressed':
        return Icons.sentiment_dissatisfied_rounded;
      case 'neutral':
        return Icons.sentiment_neutral_rounded;
      default:
        return Icons.sentiment_neutral_rounded;
    }
  }

  Color _moodColor(String mood) {
    switch (mood.toLowerCase()) {
      case 'happy':
        return Colors.green;
      case 'sad':
        return Colors.blue;
      case 'anxious':
      case 'stressed':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return PluginGate(
      pluginSlug: 'wellbeing',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Student Wellbeing'),
        body: _loading
            ? const LoadingShimmer()
            : _error != null
                ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                : Column(
                children: [
                  // Summary
                  if (_summary != null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      color: theme.colorScheme.primary.withAlpha(10),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          _WellbeingStat(
                              icon: Icons.sentiment_very_satisfied_rounded,
                              label: 'Happy',
                              value: '${_summary?['happy'] ?? 0}',
                              color: Colors.green),
                          _WellbeingStat(
                              icon: Icons.sentiment_neutral_rounded,
                              label: 'Neutral',
                              value: '${_summary?['neutral'] ?? 0}',
                              color: Colors.grey),
                          _WellbeingStat(
                              icon: Icons.sentiment_dissatisfied_rounded,
                              label: 'At Risk',
                              value: '${_summary?['at_risk'] ?? 0}',
                              color: Colors.red),
                          _WellbeingStat(
                              icon: Icons.warning_rounded,
                              label: 'Alerts',
                              value: '${_alerts.length}',
                              color: Colors.orange),
                        ],
                      ),
                    ),
                  TabBar(
                    controller: _tabController,
                    tabs: const [
                      Tab(text: 'Check-ins'),
                      Tab(text: 'Alerts'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        // Check-ins
                        _checkins.isEmpty
                            ? const NoDataContainer(
                                title: 'No check-ins',
                                subtitle:
                                    'Student wellbeing check-ins will appear here',
                                icon: Icons.favorite_rounded,
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(12),
                                itemCount: _checkins.length,
                                itemBuilder: (context, index) {
                                  final c = _checkins[index];
                                  final mood =
                                      safeStringOrNull(c['mood']) ?? 'neutral';
                                  return ListTile(
                                    leading: CircleAvatar(
                                      backgroundColor:
                                          _moodColor(mood).withAlpha(25),
                                      child: Icon(_moodIcon(mood),
                                          color: _moodColor(mood)),
                                    ),
                                    title: Text(
                                        c['student_name'] ?? c['name'] ?? '—',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w500)),
                                    subtitle: c['note'] != null
                                        ? Text(c['note'],
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey[600]))
                                        : null,
                                    trailing: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(mood,
                                            style: TextStyle(
                                                color: _moodColor(mood),
                                                fontWeight: FontWeight.w600,
                                                fontSize: 12)),
                                        Text(c['date'] ?? '—',
                                            style: TextStyle(
                                                fontSize: 11,
                                                color: Colors.grey[500])),
                                      ],
                                    ),
                                  );
                                },
                              ),
                        // Alerts
                        _alerts.isEmpty
                            ? const NoDataContainer(
                                title: 'No active alerts',
                                subtitle: 'All students are doing well!',
                                icon: Icons.check_circle_rounded,
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.all(12),
                                itemCount: _alerts.length,
                                itemBuilder: (context, index) {
                                  final a = _alerts[index];
                                  return Card(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    color: Colors.red.shade50,
                                    child: ListTile(
                                      leading: const CircleAvatar(
                                        backgroundColor: Color(0x1AFF0000),
                                        child: Icon(Icons.warning_rounded,
                                            color: Colors.red),
                                      ),
                                      title: Text(
                                          a['student_name'] ?? a['name'] ?? '—',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w600)),
                                      subtitle: Text(
                                          a['reason'] ?? a['alert_type'] ?? '—',
                                          style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.red[700])),
                                      trailing: Text(a['date'] ?? '—',
                                          style: const TextStyle(fontSize: 11)),
                                    ),
                                  );
                                },
                              ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _WellbeingStat extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _WellbeingStat({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(height: 4),
        Text(value,
            style: TextStyle(
                fontWeight: FontWeight.bold, fontSize: 16, color: color)),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
      ],
    );
  }
}
