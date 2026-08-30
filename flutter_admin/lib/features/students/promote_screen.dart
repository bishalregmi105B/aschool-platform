import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class PromoteScreen extends StatefulWidget {
  const PromoteScreen({super.key});

  @override
  State<PromoteScreen> createState() => _PromoteScreenState();
}

class _PromoteScreenState extends State<PromoteScreen> {
  List<Map<String, dynamic>> _students = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await ApiClient.instance.get('/students',
          queryParameters: {'status': 'active', 'per_page': 100});
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _students = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (e, st) {
      debugPrint('PromoteScreen load failed: $e\n$st');
      _students = [];
      _error = 'Could not load students.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingShimmer());
    if (_error != null) {
      return Scaffold(
        body: ErrorContainer(errorMessage: _error!, onRetry: _load),
      );
    }

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: _students.length,
          itemBuilder: (_, i) {
            final s = _students[i];
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                leading: const Icon(Icons.trending_up_outlined),
                title: Text(s['full_name']?.toString() ??
                    '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim()),
                subtitle: Text(
                    'Class: ${s['class_name'] ?? '-'}  Roll: ${s['roll_number'] ?? '-'}'),
                trailing: const Icon(Icons.chevron_right),
              ),
            );
          },
        ),
      ),
    );
  }
}
