import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

/// Parent view of emergency alerts for their child's school
class ParentEmergencyScreen extends StatefulWidget {
  const ParentEmergencyScreen({super.key});

  @override
  State<ParentEmergencyScreen> createState() => _ParentEmergencyScreenState();
}

class _ParentEmergencyScreenState extends State<ParentEmergencyScreen> {
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
      final res = await ApiClient.instance.get('/emergency/alerts?per_page=20');
      if (!mounted) return;
      setState(() {
        _alerts = List<Map<String, dynamic>>.from(res.data['data'] ?? []);
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
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
              child: _alerts.isEmpty
                  ? const NoDataContainer(
                      title: 'No Alerts',
                      subtitle:
                          'No emergency alerts from your child\'s school.',
                      icon: Icons.check_circle_outline,
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _alerts.length,
                      itemBuilder: (context, i) =>
                          _ParentAlertCard(alert: _alerts[i]),
                    ),
            ),
    );
  }
}

class _ParentAlertCard extends StatelessWidget {
  final Map<String, dynamic> alert;

  const _ParentAlertCard({required this.alert});

  @override
  Widget build(BuildContext context) {
    final alertType = (alert['alert_type'] ?? 'general').toString();
    final title = (alert['title'] ?? 'Emergency Alert').toString();
    final description = (alert['description'] ?? '').toString();
    final status = (alert['status'] ?? 'active').toString();
    final instructions = (alert['instructions'] ?? '').toString();
    final createdAt = alert['created_at']?.toString() ?? '';
    final isActive = status == 'active';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: isActive ? Colors.red.shade50 : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isActive ? Colors.red.shade300 : Colors.grey.shade200,
          width: isActive ? 2 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isActive ? Icons.warning_amber_rounded : Icons.info_outline,
                  color: isActive ? Colors.red : Colors.grey,
                  size: 22,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                          color: isActive ? Colors.red.shade800 : null,
                        ),
                      ),
                      if (createdAt.isNotEmpty)
                        Text(
                          _formatDate(createdAt),
                          style: TextStyle(
                              fontSize: 11, color: Colors.grey.shade500),
                        ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color:
                        isActive ? Colors.red.shade100 : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color:
                          isActive ? Colors.red.shade700 : Colors.grey.shade600,
                    ),
                  ),
                ),
              ],
            ),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(description, style: TextStyle(color: Colors.grey.shade700)),
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
                      child: Text(
                        instructions,
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 8),
            Chip(
              label: Text(alertType.toUpperCase()),
              backgroundColor: Colors.orange.shade100,
              labelStyle: const TextStyle(fontSize: 11),
              visualDensity: VisualDensity.compact,
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}
