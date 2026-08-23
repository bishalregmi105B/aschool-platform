import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../widgets/loading_shimmer.dart';
import '../widgets/no_data_container.dart';
import '../widgets/plugin_gate.dart';

/// Shared emergency alerts viewer used by teacher, parent and student apps.
///
/// Fetches `/emergency/alerts` and renders alert cards with status chips,
/// instructions boxes, an optional active-emergency banner (student) and an
/// optional headcount action (teacher). The admin management variant
/// (trigger alerts + evacuation plans tabs) remains app-local.
class EmergencyAlertsScreen extends StatefulWidget {
  final String title;
  final int perPage;
  final String emptyTitle;
  final String emptySubtitle;
  final bool usePluginGate;
  final bool allowHeadcount;
  final bool showActiveBanner;

  const EmergencyAlertsScreen({
    super.key,
    this.title = 'Emergency Alerts',
    this.perPage = 20,
    this.emptyTitle = 'No Alerts',
    this.emptySubtitle = 'No emergency alerts at this time.',
    this.usePluginGate = false,
    this.allowHeadcount = false,
    this.showActiveBanner = false,
  });

  @override
  State<EmergencyAlertsScreen> createState() => _EmergencyAlertsScreenState();
}

class _EmergencyAlertsScreenState extends State<EmergencyAlertsScreen> {
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
      final res = await ApiClient.instance
          .get('/emergency/alerts?per_page=${widget.perPage}');
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
    final screen = Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _buildBody(),
    );

    if (!widget.usePluginGate) return screen;
    return PluginGate(pluginSlug: 'emergency', child: screen);
  }

  Widget _buildBody() {
    final activeAlerts =
        _alerts.where((a) => a['status'] == 'active').toList();

    if (_loading) return const LoadingShimmer();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.showActiveBanner && activeAlerts.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.red.shade300, width: 2),
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
            NoDataContainer(
              title: widget.emptyTitle,
              subtitle: widget.emptySubtitle,
              icon: Icons.check_circle_outline,
            )
          else
            ..._alerts.map((a) => _AlertCard(
                  alert: a,
                  onHeadcount:
                      widget.allowHeadcount ? _submitHeadcount : null,
                )),
        ],
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  final Map<String, dynamic> alert;
  final void Function(String alertId)? onHeadcount;

  const _AlertCard({required this.alert, this.onHeadcount});

  @override
  Widget build(BuildContext context) {
    final alertType = (alert['alert_type'] ?? 'general').toString();
    final title = (alert['title'] ?? 'Emergency Alert').toString();
    final description = (alert['description'] ?? '').toString();
    final instructions = (alert['instructions'] ?? '').toString();
    final status = (alert['status'] ?? 'active').toString();
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
            Row(
              children: [
                Chip(
                  label: Text(alertType.toUpperCase()),
                  backgroundColor: Colors.orange.shade100,
                  labelStyle: const TextStyle(fontSize: 11),
                  visualDensity: VisualDensity.compact,
                ),
                const Spacer(),
                if (onHeadcount != null && isActive)
                  OutlinedButton.icon(
                    onPressed: () => onHeadcount!(alert['id']?.toString() ?? ''),
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

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}
