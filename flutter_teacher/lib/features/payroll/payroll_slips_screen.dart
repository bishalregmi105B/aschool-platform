import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class PayrollSlipsScreen extends ConsumerStatefulWidget {
  const PayrollSlipsScreen({super.key});

  @override
  ConsumerState<PayrollSlipsScreen> createState() => _PayrollSlipsScreenState();
}

class _PayrollSlipsScreenState extends ConsumerState<PayrollSlipsScreen> {
  final HrRepository _repo = HrRepository();
  List<PayrollSlip> _slips = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Backend: GET /hr/payroll (`api/v1/hr_payroll.py`, prefix `/hr`).
  /// The endpoint is role-restricted to superadmin/school_admin/accountant,
  /// so teachers receive a 403 which is surfaced here.
  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _slips = await _repo.getPayslips();
    } on ApiException catch (e) {
      _slips = [];
      _error = e.statusCode == 403
          ? 'Payroll slips are only visible to admin and accountant roles.'
          : e.message;
    } catch (e, st) {
      debugPrint('PayrollSlipsScreen load failed: $e\n$st');
      _slips = [];
      _error = 'Could not load payroll slips.';
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
                      children: [
                        const SizedBox(height: 120),
                        NoDataContainer(
                          title: _error ?? 'No payroll slips found',
                          subtitle: _error ??
                              'Monthly salary slips will appear here.',
                          icon: _error != null
                              ? Icons.lock_outline
                              : Icons.receipt_long_outlined,
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
                                  slip.month ?? slip.staffName ?? 'Payroll Slip'),
                              subtitle: Text(
                                  'Staff: ${slip.staffName ?? '-'} • '
                                  'Net Pay: ${slip.netSalary.toStringAsFixed(2)} • '
                                  'Status: ${slip.status ?? 'processed'}'),
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
