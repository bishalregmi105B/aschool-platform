import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';
import 'receipt_launcher.dart';

/// Invoices for the selected child — bill documents grouped by the school
/// (`GET /fees/invoices?student_id=`), each opening a line-level detail.
class InvoicesScreen extends ConsumerStatefulWidget {
  const InvoicesScreen({super.key});

  @override
  ConsumerState<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends ConsumerState<InvoicesScreen> {
  List<FeeInvoice>? _invoices;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final studentId = ref.read(selectedChildIdForApiProvider);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await ref
          .read(feeRepositoryProvider)
          .listInvoices(studentId: studentId);
      if (mounted) setState(() => _invoices = rows);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      debugPrint('InvoicesScreen load failed: $e');
      if (mounted) setState(() => _error = 'Could not load invoices.');
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'fees',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Invoices'),
        body: _loading
            ? const LoadingShimmer()
            : _error != null
                ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                : RefreshIndicator(
                    onRefresh: _load,
                    child: (_invoices ?? const []).isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 120),
                              NoDataContainer(
                                title: 'No invoices yet',
                                subtitle:
                                    'Fee invoices issued by the school will appear here.',
                                icon: Icons.receipt_long_rounded,
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _invoices!.length,
                            itemBuilder: (_, i) {
                              final invoice = _invoices![i];
                              return _InvoiceCard(
                                invoice: invoice,
                                onTap: () => context
                                    .push('/fees/invoices/${invoice.id}'),
                              );
                            },
                          ),
                  ),
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  final FeeInvoice invoice;
  final VoidCallback onTap;

  const _InvoiceCard({required this.invoice, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  invoice.title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 15),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              _StatusChip(status: invoice.status ?? 'pending'),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right_rounded, size: 20),
            ],
          ),
          if ((invoice.dueDateBs ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                children: [
                  Icon(Icons.event_rounded,
                      size: 14, color: Colors.grey.shade500),
                  const SizedBox(width: 6),
                  Text('Due ${invoice.dueDateBs} (BS)',
                      style: TextStyle(
                          fontSize: 12, color: Colors.grey.shade600)),
                ],
              ),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                  child: _amount('Total', invoice.totalAmount,
                      ASchoolTheme.primary)),
              Expanded(
                  child: _amount(
                      'Paid', invoice.paidAmount, ASchoolTheme.success)),
              Expanded(
                  child: _amount('Due', invoice.dueAmount, ASchoolTheme.danger)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _amount(String label, double value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
        Text('Rs ${value.toStringAsFixed(0)}',
            style: TextStyle(
                fontSize: 14, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      'paid' => (ASchoolTheme.success, 'PAID'),
      'waived' => (ASchoolTheme.success, 'WAIVED'),
      'partial' => (ASchoolTheme.warning, 'PARTIAL'),
      _ => (ASchoolTheme.warning, 'PENDING'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(22),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

/// Single invoice with its bill lines and per-line receipt downloads.
class InvoiceDetailScreen extends ConsumerStatefulWidget {
  final String invoiceId;

  const InvoiceDetailScreen({super.key, required this.invoiceId});

  @override
  ConsumerState<InvoiceDetailScreen> createState() =>
      _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends ConsumerState<InvoiceDetailScreen> {
  FeeInvoice? _invoice;
  String? _error;
  bool _loading = true;
  String? _downloadingLineId;

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
      final invoice =
          await ref.read(feeRepositoryProvider).getInvoice(widget.invoiceId);
      if (mounted) setState(() => _invoice = invoice);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      debugPrint('InvoiceDetailScreen load failed: $e');
      if (mounted) setState(() => _error = 'Could not load the invoice.');
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _downloadReceipt(FeeInvoiceLine line) async {
    final url = line.receiptUrl;
    if (url == null || url.isEmpty) return;
    setState(() => _downloadingLineId = line.id);
    final ok = await openReceiptPdf(url);
    if (!mounted) return;
    setState(() => _downloadingLineId = null);
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Could not open the receipt. Please try again.'),
        backgroundColor: ASchoolTheme.danger,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'fees',
      child: Scaffold(
        appBar: CustomAppBar(title: _invoice?.title ?? 'Invoice'),
        body: _loading
            ? const LoadingShimmer()
            : _error != null
                ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                : _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    final invoice = _invoice;
    if (invoice == null) {
      return const NoDataContainer(
          title: 'Invoice not found', icon: Icons.receipt_long_rounded);
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ESchoolCard(
          color: ASchoolTheme.primary.withAlpha(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(invoice.title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 16)),
                  ),
                  _StatusChip(status: invoice.status ?? 'pending'),
                ],
              ),
              if ((invoice.studentName ?? '').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(invoice.studentName!,
                      style: TextStyle(
                          fontSize: 12.5, color: Colors.grey.shade700)),
                ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _summary('Total',
                        'Rs ${invoice.totalAmount.toStringAsFixed(0)}'),
                  ),
                  Expanded(
                    child: _summary('Paid',
                        'Rs ${invoice.paidAmount.toStringAsFixed(0)}',
                        color: ASchoolTheme.success),
                  ),
                  Expanded(
                    child: _summary('Due',
                        'Rs ${invoice.dueAmount.toStringAsFixed(0)}',
                        color: ASchoolTheme.danger),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SectionHeader(title: 'Bill lines'),
        if (invoice.lines.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Text(
              'No bill lines on this invoice.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
          )
        else
          ...invoice.lines.map((line) => _lineCard(line)),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _summary(String label, String value, {Color? color}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
        Text(value,
            style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: color ?? ASchoolTheme.primary)),
      ],
    );
  }

  Widget _lineCard(FeeInvoiceLine line) {
    final isPaid = (line.dueAmount <= 0) || line.status == 'paid';
    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(line.feeType ?? 'Fee',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
              Text('Rs ${line.netAmount.toStringAsFixed(0)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15)),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              _miniChip(line.status ?? 'pending',
                  isPaid ? ASchoolTheme.success : ASchoolTheme.warning),
              const SizedBox(width: 8),
              if ((line.dueDate ?? '').isNotEmpty)
                Text('Due ${line.dueDate}',
                    style:
                        TextStyle(fontSize: 11.5, color: Colors.grey.shade600)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Paid Rs ${line.paidAmount.toStringAsFixed(0)} • '
            'Due Rs ${line.dueAmount.toStringAsFixed(0)}',
            style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700),
          ),
          if (line.hasReceipt) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _downloadingLineId == line.id
                  ? null
                  : () => _downloadReceipt(line),
              icon: _downloadingLineId == line.id
                  ? const SizedBox(
                      height: 14,
                      width: 14,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.picture_as_pdf_rounded,
                      size: 16, color: Colors.red),
              label: Text(
                (line.receiptNumber ?? '').isNotEmpty
                    ? 'Receipt ${line.receiptNumber}'
                    : 'Download receipt',
                style: const TextStyle(fontSize: 12.5),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _miniChip(String status, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(22),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
            fontSize: 10, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}
