import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

/// Emergency Alert Management — trigger alerts, view history, manage evacuations
class EmergencyScreen extends StatefulWidget {
  const EmergencyScreen({super.key});

  @override
  State<EmergencyScreen> createState() => _EmergencyScreenState();
}

class _EmergencyScreenState extends State<EmergencyScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _alerts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
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
      final res = await ApiClient.instance.get('/emergency/alerts?per_page=30');
      if (!mounted) return;
      setState(() {
        _alerts = List<Map<String, dynamic>>.from(
          res.data['data'] ?? [],
        );
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _triggerAlert() async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => const _TriggerAlertDialog(),
    );
    if (result == null) return;
    try {
      await ApiClient.instance.post('/emergency/alerts', data: result);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('🚨 Emergency alert broadcast to all users'),
          backgroundColor: Colors.red,
        ),
      );
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'emergency',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Emergency Management'),
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Alerts'),
              Tab(text: 'Evacuation Plans'),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _load,
            ),
          ],
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _triggerAlert,
          label: const Text('Trigger Alert'),
          icon: const Icon(Icons.warning_amber_rounded),
          backgroundColor: Colors.red,
        ),
        body: TabBarView(
          controller: _tabCtrl,
          children: [
            _AlertsTab(alerts: _alerts, loading: _loading, onRefresh: _load),
            const _EvacuationTab(),
          ],
        ),
      ),
    );
  }
}

class _AlertsTab extends StatelessWidget {
  final List<Map<String, dynamic>> alerts;
  final bool loading;
  final VoidCallback onRefresh;

  const _AlertsTab({
    required this.alerts,
    required this.loading,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return const LoadingShimmer();
    if (alerts.isEmpty) {
      return const NoDataContainer(
        title: 'No Alerts',
        subtitle: 'No emergency alerts have been issued.',
        icon: Icons.check_circle_outline,
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: alerts.length,
        itemBuilder: (context, i) => _AlertCard(alert: alerts[i]),
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  final Map<String, dynamic> alert;

  const _AlertCard({required this.alert});

  @override
  Widget build(BuildContext context) {
    final alertType = (alert['alert_type'] ?? 'general').toString();
    final status = (alert['status'] ?? 'active').toString();
    final title = (alert['title'] ?? 'Emergency Alert').toString();
    final description = (alert['description'] ?? '').toString();
    final createdAt = alert['created_at']?.toString() ?? '';

    final typeColors = {
      'fire': Colors.deepOrange,
      'earthquake': Colors.brown,
      'flood': Colors.blue,
      'lockdown': Colors.red,
      'medical': Colors.pink,
      'drill': Colors.amber,
      'general': Colors.orange,
    };
    final color = typeColors[alertType] ?? Colors.orange;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withOpacity(0.4), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: color, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: status == 'active'
                        ? Colors.red.shade100
                        : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: status == 'active'
                          ? Colors.red.shade800
                          : Colors.grey.shade600,
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
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    alertType.toUpperCase(),
                    style: TextStyle(
                        fontSize: 11,
                        color: color,
                        fontWeight: FontWeight.w600),
                  ),
                ),
                const Spacer(),
                if (createdAt.isNotEmpty)
                  Text(
                    _formatDate(createdAt),
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
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

class _EvacuationTab extends StatefulWidget {
  const _EvacuationTab();

  @override
  State<_EvacuationTab> createState() => _EvacuationTabState();
}

class _EvacuationTabState extends State<_EvacuationTab> {
  List<Map<String, dynamic>> _plans = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiClient.instance.get('/emergency/evacuation-plans');
      if (!mounted) return;
      setState(() {
        _plans = List<Map<String, dynamic>>.from(res.data['data'] ?? []);
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();
    if (_plans.isEmpty) {
      return const NoDataContainer(
        title: 'No Evacuation Plans',
        subtitle: 'Add evacuation plans and assembly points.',
        icon: Icons.exit_to_app,
      );
    }

    return RefreshIndicator(
      onRefresh: () async => _load(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _plans.length,
        itemBuilder: (context, i) {
          final plan = _plans[i];
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading: const Icon(Icons.map_outlined, color: Colors.teal),
              title: Text(plan['name'] ?? 'Plan'),
              subtitle: Text(plan['description'] ?? ''),
              trailing: Chip(
                label: Text(plan['scenario_type'] ?? 'general'),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _TriggerAlertDialog extends StatefulWidget {
  const _TriggerAlertDialog();

  @override
  State<_TriggerAlertDialog> createState() => _TriggerAlertDialogState();
}

class _TriggerAlertDialogState extends State<_TriggerAlertDialog> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _alertType = 'general';

  final _types = [
    'general',
    'fire',
    'earthquake',
    'flood',
    'lockdown',
    'medical',
    'drill',
  ];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: Colors.red),
          SizedBox(width: 8),
          Text('Trigger Emergency Alert'),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'This will broadcast an emergency alert to ALL users immediately.',
              style: TextStyle(color: Colors.red, fontSize: 13),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _alertType,
              decoration: const InputDecoration(labelText: 'Alert Type'),
              items: _types
                  .map((t) =>
                      DropdownMenuItem(value: t, child: Text(t.toUpperCase())))
                  .toList(),
              onChanged: (v) => setState(() => _alertType = v!),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Title *'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              decoration: const InputDecoration(labelText: 'Description'),
              maxLines: 3,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
          onPressed: () {
            if (_titleCtrl.text.trim().isEmpty) return;
            Navigator.pop(context, {
              'alert_type': _alertType,
              'title': _titleCtrl.text.trim(),
              'description': _descCtrl.text.trim(),
            });
          },
          child: const Text('BROADCAST'),
        ),
      ],
    );
  }
}
