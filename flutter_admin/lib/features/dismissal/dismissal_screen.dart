import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

/// Admin Dismissal Management — QR scan dismissal, real-time headcount
class DismissalScreen extends StatefulWidget {
  const DismissalScreen({super.key});

  @override
  State<DismissalScreen> createState() => _DismissalScreenState();
}

class _DismissalScreenState extends State<DismissalScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  Map<String, dynamic> _summary = {};
  List<Map<String, dynamic>> _recentDismissals = [];
  bool _loading = true;
  String? _error;

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
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/dismissal/summary'),
        ApiClient.instance.get('/dismissal/records?per_page=30'),
      ]);
      if (!mounted) return;
      setState(() {
        _summary = safeMap(envelopeData(results[0].data));
        _recentDismissals = safeMapList(envelopeData(results[1].data));
      });
    } catch (e, st) {
      debugPrint('DismissalScreen load failed: $e\n$st');
      _error = 'Could not load dismissal data.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'dismissal',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Dismissal Management'),
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Overview'),
              Tab(text: 'Records'),
              Tab(text: 'Scan QR'),
            ],
          ),
          actions: [
            IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
          ],
        ),
        body: _loading
            ? const LoadingShimmer()
            : _error != null
                ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                : TabBarView(
                controller: _tabCtrl,
                children: [
                  _OverviewTab(summary: _summary),
                  _RecordsTab(records: _recentDismissals, onRefresh: _load),
                  const _QrScanTab(),
                ],
              ),
      ),
    );
  }
}

class _OverviewTab extends StatelessWidget {
  final Map<String, dynamic> summary;

  const _OverviewTab({required this.summary});

  @override
  Widget build(BuildContext context) {
    final total = summary['total_enrolled'] ?? 0;
    final dismissed = summary['dismissed_today'] ?? 0;
    final pending = summary['pending'] ?? (total - dismissed);
    final percentDismissed =
        total > 0 ? (dismissed / total * 100).toStringAsFixed(1) : '0';
    final classBreakdown = safeMapList(summary['class_breakdown']);

    return RefreshIndicator(
      onRefresh: () async {},
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Summary cards
          Row(
            children: [
              Expanded(
                  child: _StatCard(
                      label: 'Total Enrolled',
                      value: '$total',
                      color: Colors.blue)),
              const SizedBox(width: 8),
              Expanded(
                  child: _StatCard(
                      label: 'Dismissed',
                      value: '$dismissed',
                      color: Colors.green)),
              const SizedBox(width: 8),
              Expanded(
                  child: _StatCard(
                      label: 'Pending',
                      value: '$pending',
                      color: Colors.orange)),
            ],
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Dismissal Progress: $percentDismissed%',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: total > 0 ? dismissed / total : 0,
                    minHeight: 12,
                    borderRadius: BorderRadius.circular(6),
                    backgroundColor: Colors.grey.shade200,
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(Colors.green),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Class-wise breakdown
          if (classBreakdown.isNotEmpty) ...[
            const Text('By Class',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            ...classBreakdown.map((c) => _ClassBreakdownRow(classData: c)),
          ],
        ],
      ),
    );
  }
}

class _ClassBreakdownRow extends StatelessWidget {
  final Map<String, dynamic> classData;

  const _ClassBreakdownRow({required this.classData});

  @override
  Widget build(BuildContext context) {
    final total = classData['total'] ?? 0;
    final dismissed = classData['dismissed'] ?? 0;
    final progress = total > 0 ? dismissed / total : 0.0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(classData['class_name'] ?? ''),
          ),
          Expanded(
            child: LinearProgressIndicator(
              value: progress.toDouble(),
              backgroundColor: Colors.grey.shade200,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '$dismissed/$total',
            style: const TextStyle(fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _RecordsTab extends StatelessWidget {
  final List<Map<String, dynamic>> records;
  final VoidCallback onRefresh;

  const _RecordsTab({required this.records, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) {
      return const NoDataContainer(
        title: 'No Dismissal Records',
        subtitle: 'Records will appear here as students are dismissed.',
        icon: Icons.exit_to_app,
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: records.length,
        itemBuilder: (context, i) {
          final r = records[i];
          final studentName = r['student_name'] ?? 'Unknown';
          final dismissedAt = r['dismissed_at']?.toString() ?? '';
          final method = r['dismissal_method'] ?? 'qr_scan';
          final guardian = r['guardian_name'] ?? '';

          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text(studentName,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(guardian.isNotEmpty
                  ? 'Picked up by: $guardian'
                  : method.replaceAll('_', ' ')),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Icon(
                    method == 'qr_scan' ? Icons.qr_code : Icons.done_all,
                    size: 16,
                    color: Colors.green,
                  ),
                  if (dismissedAt.isNotEmpty)
                    Text(
                      _time(dismissedAt),
                      style: const TextStyle(fontSize: 11),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  String _time(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      debugPrint('DismissalScreen _time parse failed: $e');
      return iso;
    }
  }
}

class _QrScanTab extends StatelessWidget {
  const _QrScanTab();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.qr_code_scanner, size: 80, color: Colors.teal),
            const SizedBox(height: 16),
            const Text(
              'QR Code Scanner',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Scan the QR code from the parent\'s app to authorise student dismissal.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text(
                          'QR scanner requires camera permission. Coming soon.')),
                );
              },
              icon: const Icon(Icons.camera_alt),
              label: const Text('Open Scanner'),
              style:
                  ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatCard(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                  fontSize: 24, fontWeight: FontWeight.bold, color: color),
            ),
            const SizedBox(height: 4),
            Text(label,
                style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}
