import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

/// Student view of emergency alerts — read-only with instructions
class StudentEmergencyScreen extends StatefulWidget {
  const StudentEmergencyScreen({super.key});

  @override
  State<StudentEmergencyScreen> createState() => _StudentEmergencyScreenState();
}

class _StudentEmergencyScreenState extends State<StudentEmergencyScreen> {
  List<Map<String, dynamic>> _alerts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/emergency/alerts?per_page=10');
      if (!mounted) return;
      setState(() {
        _alerts = List<Map<String, dynamic>>.from(res.data['data'] ?? []);
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final activeAlerts = _alerts.where((a) => a['status'] == 'active').toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Alerts'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const LoadingShimmer()
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (activeAlerts.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border:
                            Border.all(color: Colors.red.shade300, width: 2),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded,
                              color: Colors.red, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'ACTIVE EMERGENCY',
                                  style: TextStyle(
                                    color: Colors.red,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                  ),
                                ),
                                Text(
                                  '${activeAlerts.length} alert${activeAlerts.length > 1 ? 's' : ''} active. Follow school instructions.',
                                  style: TextStyle(
                                      color: Colors.red.shade700, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (_alerts.isEmpty)
                    const NoDataContainer(
                      title: 'No Alerts',
                      subtitle: 'No emergency alerts at this time.',
                      icon: Icons.check_circle_outline,
                    )
                  else
                    ..._alerts.map((a) => _StudentAlertCard(alert: a)),
                ],
              ),
            ),
    );
  }
}

class _StudentAlertCard extends StatelessWidget {
  final Map<String, dynamic> alert;

  const _StudentAlertCard({required this.alert});

  @override
  Widget build(BuildContext context) {
    final title = (alert['title'] ?? 'Alert').toString();
    final alertType = (alert['alert_type'] ?? 'general').toString();
    final description = (alert['description'] ?? '').toString();
    final instructions = (alert['instructions'] ?? '').toString();
    final status = (alert['status'] ?? '').toString();
    final isActive = status == 'active';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isActive ? Colors.red.shade300 : Colors.grey.shade200,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.warning_amber_rounded,
                    color: isActive ? Colors.red : Colors.grey, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15)),
                ),
              ],
            ),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(description),
            ],
            if (instructions.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade300),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline,
                        size: 16, color: Colors.amber),
                    const SizedBox(width: 6),
                    Expanded(
                        child: Text(instructions,
                            style: const TextStyle(fontSize: 13))),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 8),
            Chip(
              label: Text(alertType.toUpperCase()),
              backgroundColor: Colors.orange.shade100,
              labelStyle: const TextStyle(fontSize: 10),
              visualDensity: VisualDensity.compact,
            ),
          ],
        ),
      ),
    );
  }
}
