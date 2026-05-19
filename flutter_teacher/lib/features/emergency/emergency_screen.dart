import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

/// Teacher view of emergency alerts — receive and acknowledge alerts
class TeacherEmergencyScreen extends StatefulWidget {
  const TeacherEmergencyScreen({super.key});

  @override
  State<TeacherEmergencyScreen> createState() => _TeacherEmergencyScreenState();
}

class _TeacherEmergencyScreenState extends State<TeacherEmergencyScreen> {
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

  Future<void> _submitHeadcount(String alertId) async {
    final countCtrl = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Submit Headcount'),
        content: TextField(
          controller: countCtrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Students Accounted For',
            hintText: 'Enter number',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, countCtrl.text),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    if (result == null || result.isEmpty) return;
    try {
      await ApiClient.instance.post(
        '/emergency/alerts/$alertId/headcount',
        data: {'count': int.tryParse(result) ?? 0, 'status': 'safe'},
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Headcount submitted'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'emergency',
      child: Scaffold(
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
                        title: 'No Active Alerts',
                        subtitle: 'You will be notified of emergency alerts.',
                        icon: Icons.check_circle_outline,
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _alerts.length,
                        itemBuilder: (context, i) => _TeacherAlertCard(
                          alert: _alerts[i],
                          onHeadcount: _submitHeadcount,
                        ),
                      ),
              ),
      ),
    );
  }
}

class _TeacherAlertCard extends StatelessWidget {
  final Map<String, dynamic> alert;
  final void Function(String alertId) onHeadcount;

  const _TeacherAlertCard({required this.alert, required this.onHeadcount});

  @override
  Widget build(BuildContext context) {
    final alertType = (alert['alert_type'] ?? 'general').toString();
    final title = (alert['title'] ?? 'Emergency Alert').toString();
    final description = (alert['description'] ?? '').toString();
    final status = (alert['status'] ?? 'active').toString();
    final isActive = status == 'active';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: isActive ? Colors.red.shade50 : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isActive ? Colors.red.shade300 : Colors.grey.shade300,
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
                  Icons.warning_amber_rounded,
                  color: isActive ? Colors.red : Colors.grey,
                  size: 22,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: isActive ? Colors.red.shade800 : null,
                    ),
                  ),
                ),
              ],
            ),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(description, style: TextStyle(color: Colors.grey.shade700)),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Chip(
                  label: Text(alertType.toUpperCase()),
                  backgroundColor: Colors.orange.shade100,
                  labelStyle:
                      const TextStyle(fontSize: 11, color: Colors.deepOrange),
                  visualDensity: VisualDensity.compact,
                ),
                const Spacer(),
                if (isActive)
                  OutlinedButton.icon(
                    onPressed: () => onHeadcount(alert['id']?.toString() ?? ''),
                    icon: const Icon(Icons.people, size: 16),
                    label: const Text('Headcount'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
