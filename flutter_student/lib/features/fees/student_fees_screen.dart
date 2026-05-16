import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Student Fees — View fee structure, payments, and dues
class StudentFeesScreen extends ConsumerStatefulWidget {
  const StudentFeesScreen({super.key});

  @override
  ConsumerState<StudentFeesScreen> createState() =>
      _StudentFeesScreenState();
}

class _StudentFeesScreenState extends ConsumerState<StudentFeesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<String, dynamic>? _overview;
  List<dynamic> _invoices = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/student/fees');
      final payload = res.data;
      setState(() {
        _overview = (payload?['overview'] as Map?)?.cast<String, dynamic>();
        _invoices = (payload?['invoices'] as List?) ?? [];
      });
    } catch (_) {}
    setState(() => _loading = false);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return PluginGate(
      pluginSlug: 'fees',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'My Fees'),
        body: _loading
            ? const LoadingShimmer()
            : Column(
                children: [
                  // Fee summary banner
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    color: theme.colorScheme.primary.withAlpha(10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _FeeCard(
                          label: 'Total',
                          amount:
                              'Rs. ${_overview?['total_fees'] ?? 0}',
                          color: Colors.blue,
                        ),
                        _FeeCard(
                          label: 'Paid',
                          amount:
                              'Rs. ${_overview?['paid'] ?? 0}',
                          color: Colors.green,
                        ),
                        _FeeCard(
                          label: 'Due',
                          amount:
                              'Rs. ${_overview?['due'] ?? 0}',
                          color: (_overview?['due'] ?? 0) > 0
                              ? Colors.red
                              : Colors.grey,
                        ),
                      ],
                    ),
                  ),
                  if ((_overview?['due'] ?? 0) > 0)
                    Container(
                      color: Colors.red.shade50,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      child: Row(
                        children: [
                          Icon(Icons.warning_rounded,
                              color: Colors.red[700], size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'You have outstanding dues. Please pay by the due date.',
                              style: TextStyle(
                                  color: Colors.red[800], fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                  TabBar(
                    controller: _tabController,
                    tabs: const [
                      Tab(text: 'Invoices'),
                      Tab(text: 'History'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _InvoicesList(
                            invoices: _invoices.where((i) => i['status'] != 'paid').toList()),
                        _InvoicesList(
                            invoices: _invoices.where((i) => i['status'] == 'paid').toList(),
                            paidView: true),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _FeeCard extends StatelessWidget {
  final String label;
  final String amount;
  final Color color;

  const _FeeCard({
    required this.label,
    required this.amount,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          amount,
          style: TextStyle(
              fontWeight: FontWeight.bold, fontSize: 16, color: color),
        ),
        const SizedBox(height: 2),
        Text(label,
            style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      ],
    );
  }
}

class _InvoicesList extends StatelessWidget {
  final List<dynamic> invoices;
  final bool paidView;

  const _InvoicesList({required this.invoices, this.paidView = false});

  @override
  Widget build(BuildContext context) {
    if (invoices.isEmpty) {
      return NoDataContainer(
        title: paidView ? 'No payment history' : 'No pending invoices',
        subtitle: paidView
            ? 'Your payment history will appear here'
            : 'All fees are paid up to date!',
        icon: paidView ? Icons.receipt_long_rounded : Icons.check_circle_rounded,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: invoices.length,
      itemBuilder: (context, index) {
        final inv = invoices[index];
        final status = (inv['status'] as String?) ?? 'pending';
        final isPaid = status == 'paid';
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor:
                  (isPaid ? Colors.green : Colors.orange).withAlpha(25),
              child: Icon(
                isPaid
                    ? Icons.check_circle_rounded
                    : Icons.pending_rounded,
                color: isPaid ? Colors.green : Colors.orange,
              ),
            ),
            title: Text(inv['fee_type'] ?? inv['title'] ?? 'Invoice',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (inv['due_date'] != null)
                  Text('Due: ${inv['due_date']}',
                      style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600])),
              ],
            ),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'Rs. ${inv['amount'] ?? 0}',
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: isPaid ? Colors.green : Colors.orange),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: (isPaid ? Colors.green : Colors.orange)
                        .withAlpha(20),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      color: isPaid ? Colors.green[700] : Colors.orange[700],
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
