import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class PayrollSlipsScreen extends ConsumerStatefulWidget {
  const PayrollSlipsScreen({super.key});

  @override
  ConsumerState<PayrollSlipsScreen> createState() => _PayrollSlipsScreenState();
}

class _PayrollSlipsScreenState extends ConsumerState<PayrollSlipsScreen> {
  List<Map<String, dynamic>> _slips = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await ApiClient.instance
          .get('/hr/payroll/slips', queryParameters: {'per_page': 50});
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _slips = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (_) {
      _slips = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _loading
          ? const LoadingShimmer()
          : RefreshIndicator(
              onRefresh: _load,
              child: _slips.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        NoDataContainer(
                          title: 'No payroll slips found',
                          subtitle: 'Monthly salary slips will appear here.',
                          icon: Icons.receipt_long_outlined,
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _slips.length,
                      itemBuilder: (_, i) {
                        final slip = _slips[i];
                        return ESchoolAnimatedEntry(
                          index: i,
                          child: ESchoolCard(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.receipt_long_outlined),
                              title: Text(
                                  slip['month']?.toString() ?? 'Payroll Slip'),
                              subtitle: Text(
                                  'Net Pay: ${slip['net_pay'] ?? '-'} • Status: ${slip['status'] ?? 'processed'}'),
                              trailing: IconButton(
                                onPressed: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content: Text('Download started.')),
                                  );
                                },
                                icon: const Icon(Icons.download_rounded),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
