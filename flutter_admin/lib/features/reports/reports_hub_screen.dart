import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ReportsHubScreen extends StatefulWidget {
  const ReportsHubScreen({super.key});

  @override
  State<ReportsHubScreen> createState() => _ReportsHubScreenState();
}

class _ReportsHubScreenState extends State<ReportsHubScreen> {
  Map<String, dynamic> _data = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await ApiClient.instance.get('/reports/dashboard');
      final raw = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _data = raw is Map<String, dynamic> ? raw : {};
    } catch (_) {
      _data = {};
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingShimmer());

    final entries = _data.entries.toList();
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: entries.length,
          itemBuilder: (_, i) {
            final e = entries[i];
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                leading: const Icon(Icons.analytics_outlined),
                title: Text(e.key),
                subtitle: Text(e.value.toString()),
              ),
            );
          },
        ),
      ),
    );
  }
}
