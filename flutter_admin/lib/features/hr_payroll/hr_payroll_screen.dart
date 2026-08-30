import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

class HrPayrollScreen extends StatefulWidget {
  const HrPayrollScreen({super.key});

  @override
  State<HrPayrollScreen> createState() => _HrPayrollScreenState();
}

class _HrPayrollScreenState extends State<HrPayrollScreen> {
  List<Map<String, dynamic>> _staff = [];
  List<Map<String, dynamic>> _payroll = [];
  List<Map<String, dynamic>> _leaveRequests = [];
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
      final responses = await Future.wait([
        ApiClient.instance.get('/users', queryParameters: {'role': 'teacher'}),
        ApiClient.instance.get('/users', queryParameters: {'role': 'staff'}),
        ApiClient.instance.get(
          '/users',
          queryParameters: {'role': 'accountant'},
        ),
        ApiClient.instance.get('/hr/payroll'),
        ApiClient.instance.get('/hr/leave'),
      ]);

      final staff = <Map<String, dynamic>>[];
      for (final response in responses.take(3)) {
        staff.addAll(
          List<Map<String, dynamic>>.from(response.data['data'] ?? []),
        );
      }

      if (!mounted) return;
      setState(() {
        _staff = staff;
        _payroll = List<Map<String, dynamic>>.from(
          responses[3].data['data'] ?? [],
        );
        _leaveRequests = List<Map<String, dynamic>>.from(
          responses[4].data['data'] ?? [],
        );
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('HrPayrollScreen load failed: $e\n$st');
      if (!mounted) return;
      setState(() {
        _error = 'Could not load HR & payroll data.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();
    if (_error != null) {
      return ErrorContainer(errorMessage: _error!, onRetry: _load);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('HR & Payroll')),
      body: DefaultTabController(
        length: 3,
        child: Column(
          children: [
            const TabBar(
              tabs: [
                Tab(text: 'Staff'),
                Tab(text: 'Payroll'),
                Tab(text: 'Leave'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _StaffList(items: _staff, onRefresh: _load),
                  _PayrollList(items: _payroll, onRefresh: _load),
                  _LeaveRequests(items: _leaveRequests, onRefresh: _load),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StaffList extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final Future<void> Function() onRefresh;

  const _StaffList({required this.items, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: items.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 160),
                Center(child: Text('No staff records found')),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final staff = items[index];
                final initials = (staff['full_name']?.toString() ?? 'S')
                    .split(' ')
                    .where((part) => part.isNotEmpty)
                    .take(2)
                    .map((part) => part[0].toUpperCase())
                    .join();
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      child: Text(initials.isEmpty ? 'S' : initials),
                    ),
                    title: Text(
                      staff['full_name']?.toString() ?? 'Staff member',
                    ),
                    subtitle: Text(staff['role']?.toString() ?? 'staff'),
                    trailing: Chip(
                      label: Text(
                        (staff['is_active'] == true) ? 'Active' : 'Inactive',
                      ),
                      backgroundColor: (staff['is_active'] == true)
                          ? Colors.green.shade50
                          : Colors.grey.shade200,
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class _PayrollList extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final Future<void> Function() onRefresh;

  const _PayrollList({required this.items, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: items.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 160),
                Center(child: Text('No payroll generated yet')),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final payroll = items[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const Icon(Icons.payments, color: Colors.green),
                    title: Text(
                      payroll['staff_name']?.toString() ?? 'Payroll entry',
                    ),
                    subtitle: Text(
                      [
                        payroll['month']?.toString() ?? '',
                        'Net: Rs. ${(payroll['net_salary'] ?? 0).toString()}',
                      ].where((item) => item.isNotEmpty).join(' • '),
                    ),
                    trailing: Chip(
                      label: Text(payroll['status']?.toString() ?? 'draft'),
                      backgroundColor: (payroll['status'] == 'paid')
                          ? Colors.green.shade50
                          : Colors.orange.shade50,
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class _LeaveRequests extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final Future<void> Function() onRefresh;

  const _LeaveRequests({required this.items, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: items.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 160),
                Center(child: Text('No leave requests yet')),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final leave = items[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const Icon(Icons.event_busy, color: Colors.orange),
                    title: Text(
                      leave['staff_name']?.toString() ?? 'Leave request',
                    ),
                    subtitle: Text(
                      [
                        leave['leave_type']?.toString() ?? '',
                        if (leave['start_date'] != null)
                          leave['start_date'].toString().split(' ').first,
                        if (leave['end_date'] != null)
                          leave['end_date'].toString().split(' ').first,
                      ].where((item) => item.isNotEmpty).join(' • '),
                    ),
                    trailing: Chip(
                      label: Text(leave['status']?.toString() ?? 'pending'),
                      backgroundColor: leave['status'] == 'approved'
                          ? Colors.green.shade50
                          : Colors.orange.shade50,
                    ),
                  ),
                );
              },
            ),
    );
  }
}
