import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class CertificatesScreen extends StatefulWidget {
  const CertificatesScreen({super.key});

  @override
  State<CertificatesScreen> createState() => _CertificatesScreenState();
}

class _CertificatesScreenState extends State<CertificatesScreen> {
  List<Map<String, dynamic>> _templates = [];
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
      final r = await ApiClient.instance.get('/design-studio/templates');
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _templates = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (e, st) {
      debugPrint('CertificatesScreen load failed: $e\n$st');
      _templates = [];
      _error = 'Could not load certificate templates.';
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
          itemCount: _templates.length,
          itemBuilder: (_, i) {
            final t = _templates[i];
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                leading: const Icon(Icons.card_membership_outlined),
                title: Text(t['name']?.toString() ??
                    t['title']?.toString() ??
                    'Template'),
                subtitle: Text(t['template_type']?.toString() ?? ''),
                trailing: Text((t['updated_at'] ?? '').toString().isNotEmpty ? adToBsString(DateTime.tryParse(t['updated_at'].toString()) ?? DateTime.now()) : ''),
              ),
            );
          },
        ),
      ),
    );
  }
}
