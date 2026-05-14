import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Fee collection dashboard: summary, outstanding, recent payments
class FeesManagement extends ConsumerStatefulWidget {
  const FeesManagement({super.key});

  @override
  ConsumerState<FeesManagement> createState() => _FeesManagementState();
}

class _FeesManagementState extends ConsumerState<FeesManagement>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  Map<String, dynamic>? _summary;
  List<Map<String, dynamic>> _recent = [];
  List<Map<String, dynamic>> _outstanding = [];
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
        ApiClient.instance.get('/fees/summary'),
        ApiClient.instance.get('/fees/recent'),
        ApiClient.instance.get('/fees/outstanding'),
      ]);
      setState(() {
        _summary = results[0].data['data'];
        _recent = List<Map<String, dynamic>>.from(
            results[1].data['data'] ?? []);
        _outstanding = List<Map<String, dynamic>>.from(
            results[2].data['data'] ?? []);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_loading)
          const Expanded(child: LoadingShimmer())
        else ...[
          _buildSummaryHeader(),
          TabBar(controller: _tabCtrl, tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Recent'),
            Tab(text: 'Outstanding'),
          ]),
          Expanded(
            child: TabBarView(controller: _tabCtrl, children: [
              _buildOverview(),
              _buildRecentList(),
              _buildOutstandingList(),
            ]),
          ),
        ],
      ],
    );
  }

  Widget _buildSummaryHeader() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [ASchoolTheme.primary, Color(0xFF1E40AF)],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _headerStat('Collected',
              'Rs ${_formatAmount(_summary?['total_collected'] ?? 0)}'),
          Container(width: 1, height: 40, color: Colors.white24),
          _headerStat('Pending',
              'Rs ${_formatAmount(_summary?['total_outstanding'] ?? 0)}'),
          Container(width: 1, height: 40, color: Colors.white24),
          _headerStat('This Month',
              'Rs ${_formatAmount(_summary?['this_month_collected'] ?? 0)}'),
        ],
      ),
    );
  }

  Widget _headerStat(String label, String value) {
    return Column(
      children: [
        Text(value,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
      ],
    );
  }

  String _formatAmount(dynamic v) {
    final n = (v is int) ? v : (v as num).toInt();
    if (n >= 100000) return '${(n / 100000).toStringAsFixed(1)}L';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }

  Widget _buildOverview() {
    final classes = List<Map<String, dynamic>>.from(
        _summary?['by_class'] ?? []);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: classes.length,
        itemBuilder: (_, i) {
          final c = classes[i];
          final collected = (c['collected'] ?? 0).toDouble();
          final total = (c['expected'] ?? 1).toDouble();
          return Card(
            child: ListTile(
              title: Text(c['class_name'] ?? ''),
              subtitle: LinearProgressIndicator(
                value: collected / total,
                color: ASchoolTheme.success,
                backgroundColor: ASchoolTheme.success.withAlpha(30),
              ),
              trailing: Text(
                '${(collected / total * 100).toStringAsFixed(0)}%',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildRecentList() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _recent.length,
        itemBuilder: (_, i) {
          final p = _recent[i];
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: ASchoolTheme.success.withAlpha(30),
                child: const Icon(Icons.check, color: ASchoolTheme.success),
              ),
              title: Text(p['student_name'] ?? ''),
              subtitle: Text(p['fee_type'] ?? ''),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('Rs ${p['amount']}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(p['paid_at'] ?? '',
                      style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildOutstandingList() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _outstanding.length,
        itemBuilder: (_, i) {
          final o = _outstanding[i];
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: ASchoolTheme.danger.withAlpha(30),
                child: const Icon(Icons.warning_rounded,
                    color: ASchoolTheme.danger),
              ),
              title: Text(o['student_name'] ?? ''),
              subtitle: Text('${o['class_name']} • ${o['fee_type']}'),
              trailing: Text('Rs ${o['amount']}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: ASchoolTheme.danger)),
            ),
          );
        },
      ),
    );
  }
}
