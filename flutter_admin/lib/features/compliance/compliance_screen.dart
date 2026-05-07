import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

class ComplianceScreen extends StatefulWidget {
  const ComplianceScreen({super.key});

  @override
  State<ComplianceScreen> createState() => _ComplianceScreenState();
}

class _ComplianceScreenState extends State<ComplianceScreen> {
  List<Map<String, dynamic>> _reports = [];
  List<Map<String, dynamic>> _auditLogs = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/compliance/reports'),
        ApiClient.instance.get('/compliance/audit-logs'),
      ]);
      if (!mounted) return;
      setState(() {
        _reports = List<Map<String, dynamic>>.from(
          results[0].data['data'] ?? [],
        );
        _auditLogs = List<Map<String, dynamic>>.from(
          results[1].data['data'] ?? [],
        );
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _generate(String type) async {
    try {
      await ApiClient.instance.post(
        '/compliance/reports/generate',
        data: {
          'report_type': type,
          'academic_year': DateTime.now().year.toString(),
        },
      );
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$type report generated')));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to generate report')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();

    final reportTypes = <Map<String, dynamic>>[
      {
        'type': 'emis',
        'title': 'EMIS Report',
        'description': 'Education data export',
        'icon': Icons.description,
        'color': Colors.blue,
      },
      {
        'type': 'moe_flash_1',
        'title': 'MoE Flash I',
        'description': 'Enrollment and demographics',
        'icon': Icons.assessment,
        'color': Colors.green,
      },
      {
        'type': 'moe_flash_2',
        'title': 'MoE Flash II',
        'description': 'Staff and infrastructure',
        'icon': Icons.summarize,
        'color': Colors.orange,
      },
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Compliance & Reports')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ...reportTypes.map(
              (item) => _ReportCard(
                title: item['title'] as String,
                description: item['description'] as String,
                icon: item['icon'] as IconData,
                color: item['color'] as Color,
                onGenerate: () => _generate(item['type'] as String),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Recent Reports',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            if (_reports.isEmpty)
              const Card(
                child: ListTile(title: Text('No generated reports yet')),
              )
            else
              ..._reports.take(5).map(
                    (report) => Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: const Icon(Icons.article_outlined),
                        title: Text(
                          report['report_type']?.toString() ?? 'Report',
                        ),
                        subtitle: Text(report['status']?.toString() ?? 'draft'),
                        trailing: Text(
                          report['created_at']?.toString().split(' ').first ??
                              '',
                        ),
                      ),
                    ),
                  ),
            const SizedBox(height: 16),
            const Text(
              'Audit Trail',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            if (_auditLogs.isEmpty)
              const Card(child: ListTile(title: Text('No audit activity yet')))
            else
              ..._auditLogs.take(6).map(
                    (log) => Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: Icon(
                          Icons.history,
                          color: Colors.grey.shade600,
                        ),
                        title: Text(log['action']?.toString() ?? 'Activity'),
                        subtitle: Text(
                          [
                            log['user_name']?.toString() ?? 'System',
                            log['created_at']?.toString().split(' ').first ??
                                '',
                          ].where((item) => item.isNotEmpty).join(' • '),
                        ),
                      ),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final Color color;
  final VoidCallback onGenerate;

  const _ReportCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.color,
    required this.onGenerate,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: color.withAlpha(31),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(description),
        ),
        trailing: ElevatedButton(
          onPressed: onGenerate,
          child: const Text('Generate'),
        ),
      ),
    );
  }
}
