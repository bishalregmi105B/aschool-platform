import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

class IncidentScreen extends StatefulWidget {
  const IncidentScreen({super.key});

  @override
  State<IncidentScreen> createState() => _IncidentScreenState();
}

class _IncidentScreenState extends State<IncidentScreen> {
  List<Map<String, dynamic>> _incidents = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final response = await ApiClient.instance.get('/incidents');
      if (!mounted) return;
      setState(() {
        _incidents = List<Map<String, dynamic>>.from(
          response.data['data'] ?? [],
        );
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();

    final counts = <String, int>{};
    for (final incident in _incidents) {
      final status = (incident['status'] ?? 'reported').toString();
      counts[status] = (counts[status] ?? 0) + 1;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Incident Reports')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _incidents.isEmpty
            ? ListView(
                children: const [
                  SizedBox(height: 160),
                  Center(child: Text('No incidents recorded yet')),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      _StatCard(
                        'Reported',
                        '${counts['reported'] ?? 0}',
                        Colors.red,
                      ),
                      const SizedBox(width: 8),
                      _StatCard(
                        'Investigating',
                        '${counts['investigating'] ?? 0}',
                        Colors.orange,
                      ),
                      const SizedBox(width: 8),
                      _StatCard(
                        'Resolved',
                        '${counts['resolved'] ?? 0}',
                        Colors.green,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  ..._incidents.map(_buildIncidentCard),
                ],
              ),
      ),
    );
  }

  Widget _buildIncidentCard(Map<String, dynamic> incident) {
    final status = (incident['status'] ?? 'reported').toString();
    final severity = (incident['severity'] ?? 'medium').toString();
    final type = (incident['incident_type'] ?? 'other').toString();
    final createdAt = incident['created_at']?.toString();
    final colors = {
      'reported': Colors.red,
      'investigating': Colors.orange,
      'resolved': Colors.green,
      'closed': Colors.blueGrey,
    };
    final color = colors[status] ?? Colors.grey;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.all(12),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: color.withAlpha(31),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(Icons.report_problem, color: color),
        ),
        title: Text(incident['title']?.toString() ?? type.replaceAll('_', ' ')),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            [
              type.replaceAll('_', ' '),
              severity,
              if (createdAt != null && createdAt.isNotEmpty)
                createdAt.split(' ').first,
            ].join(' • '),
          ),
        ),
        trailing: Chip(
          label: Text(
            status.replaceAll('_', ' '),
            style: TextStyle(fontSize: 11, color: color),
          ),
          backgroundColor: color.withAlpha(31),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatCard(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        color: color.withAlpha(15),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(fontSize: 12, color: color)),
            ],
          ),
        ),
      ),
    );
  }
}
