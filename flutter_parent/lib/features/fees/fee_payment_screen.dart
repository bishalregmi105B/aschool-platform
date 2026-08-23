import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

class FeePaymentScreen extends ConsumerStatefulWidget {
  const FeePaymentScreen({super.key});

  @override
  ConsumerState<FeePaymentScreen> createState() => _FeePaymentScreenState();
}

class _FeePaymentScreenState extends ConsumerState<FeePaymentScreen> {
  final Set<String> _selected = {};
  bool _paying = false;
  bool _loadingMethods = true;
  List<Map<String, dynamic>> _onlineMethods = const [];

  @override
  void initState() {
    super.initState();
    _loadPaymentMethods();
  }

  Future<void> _loadPaymentMethods() async {
    try {
      final resp = await ApiClient.instance.get('/fees/payment-methods');
      final methods = List<Map<String, dynamic>>.from(
        resp.data['data']?['methods'] ?? const <Map<String, dynamic>>[],
      );

      final online = methods
          .where((method) {
            final enabled = method['enabled'] == true;
            final mode = (method['mode'] ?? '').toString().toLowerCase();
            return enabled && mode == 'online';
          })
          .map((method) {
            final key = (method['key'] ?? '').toString();
            final label = (method['label'] ?? key).toString();
            return {'key': key, 'label': label};
          })
          .where((method) => (method['key'] ?? '').toString().isNotEmpty)
          .toList();

      if (mounted) {
        setState(() {
          _onlineMethods = online;
          _loadingMethods = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loadingMethods = false);
      }
    }
  }

  double _selectedTotal(List<Map<String, dynamic>> fees) => fees
      .where((f) => _selected.contains(f['id']?.toString()))
      .fold(0.0, (sum, f) => sum + ((f['amount'] as num?)?.toDouble() ?? 0));

  Future<void> _payWith(
    String gateway,
    List<Map<String, dynamic>> fees,
    String? selectedChildId,
  ) async {
    final feeIds = fees
        .map((fee) => fee['id']?.toString() ?? '')
        .where((id) => id.isNotEmpty && _selected.contains(id))
        .toList();
    if (feeIds.isEmpty) return;
    setState(() => _paying = true);
    try {
      final resp =
          await ApiClient.instance.post('/fees/initiate-payment', data: {
        'fee_ids': feeIds,
        'gateway': gateway,
      });
      final data = resp.data['data'] ?? {};
      final checkoutHtml = data['checkout_html'] as String?;
      final paymentUrl = data['payment_url'] as String?;

      if (checkoutHtml != null && mounted) {
        // eSewa requires a browser POST — load the auto-submitting form
        // document in a WebView instead of launchUrl().
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => _GatewayWebViewScreen(
              title: gateway.toUpperCase(),
              html: checkoutHtml,
            ),
          ),
        );
      } else if (paymentUrl != null) {
        final uri = Uri.parse(paymentUrl);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else {
          throw Exception('No browser available for $paymentUrl');
        }
      } else {
        throw Exception('No payment URL returned');
      }

      ref.invalidate(parentFeesProvider(selectedChildId));
      setState(() => _selected.clear());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Payment initiation failed'),
          backgroundColor: ASchoolTheme.danger,
        ));
      }
    } finally {
      setState(() => _paying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedChildId = ref.watch(selectedChildIdForApiProvider);
    final state = ref.watch(parentFeesProvider(selectedChildId));

    return state.when(
      loading: () => const LoadingShimmer(),
      error: (err, _) => ErrorContainer(
        errorMessage: err.toString(),
        onRetry: () => ref.invalidate(parentFeesProvider(selectedChildId)),
      ),
      data: (fees) {
        if (fees.isEmpty) {
          return const NoDataContainer(
            title: 'No outstanding fees',
            subtitle: 'All assigned fees are already paid.',
            icon: Icons.check_circle_rounded,
          );
        }

        final hasSelectedFees = fees.any(
          (fee) => _selected.contains(fee['id']?.toString() ?? ''),
        );

        return Column(
          children: [
            Expanded(
              child: RefreshIndicator(
                onRefresh: () =>
                    ref.refresh(parentFeesProvider(selectedChildId).future),
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: fees.length,
                  itemBuilder: (_, i) {
                    final f = fees[i];
                    final feeId = f['id']?.toString() ?? '';
                    final checked = _selected.contains(feeId);
                    final studentName = f['student_name']?.toString();
                    return ESchoolCard(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: EdgeInsets.zero,
                      child: CheckboxListTile(
                        value: checked,
                        activeColor: ASchoolTheme.primary,
                        onChanged: (v) => setState(() {
                          if (v == true) {
                            _selected.clear();
                            _selected.add(feeId);
                          } else {
                            _selected.remove(feeId);
                          }
                        }),
                        title: Text(f['fee_type'] ?? ''),
                        subtitle: Text(
                          studentName != null && studentName.isNotEmpty
                              ? '${f['month'] ?? ''} • $studentName'
                              : (f['month'] ?? ''),
                        ),
                        secondary: Text(
                          'Rs ${f['amount']}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(18)),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withAlpha(10),
                      blurRadius: 10,
                      offset: const Offset(0, -4)),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Selected',
                          style: TextStyle(fontSize: 15)),
                      Text('Rs ${_selectedTotal(fees).toStringAsFixed(0)}',
                          style: const TextStyle(
                              fontSize: 20, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_loadingMethods)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: LinearProgressIndicator(minHeight: 2),
                    )
                  else if (_onlineMethods.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'No online payment methods are enabled by your school.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.black54,
                        ),
                      ),
                    )
                  else
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: _onlineMethods.map((method) {
                        final key = (method['key'] ?? '').toString();
                        final label = (method['label'] ?? key).toString();
                        return SizedBox(
                          width: (_onlineMethods.length > 1)
                              ? (MediaQuery.of(context).size.width - 56) / 2
                              : double.infinity,
                          child: _paymentButton(
                            label,
                            _gatewayColor(key),
                            hasSelectedFees,
                            () => _payWith(key, fees, selectedChildId),
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Color _gatewayColor(String gateway) {
    switch (gateway) {
      case 'esewa':
        return const Color(0xFF60BB46);
      case 'khalti':
        return const Color(0xFF5C2D91);
      case 'fonepay':
        return const Color(0xFF1D8FDE);
      default:
        return ASchoolTheme.primary;
    }
  }

  Widget _paymentButton(
    String label,
    Color color,
    bool hasSelectedFees,
    VoidCallback onTap,
  ) {
    return FilledButton(
      onPressed: _paying || !hasSelectedFees ? null : onTap,
      style: FilledButton.styleFrom(
        backgroundColor: color,
        minimumSize: const Size(0, 48),
      ),
      child: _paying
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: Colors.white))
          : Text(label,
              style:
                  const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
    );
  }
}

/// Loads a gateway's auto-submitting checkout form (eSewa) in-app.
class _GatewayWebViewScreen extends StatelessWidget {
  const _GatewayWebViewScreen({required this.title, required this.html});

  final String title;
  final String html;

  @override
  Widget build(BuildContext context) {
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..loadHtmlString(html, baseUrl: null);
    return Scaffold(
      appBar: AppBar(title: Text('Pay with $title')),
      body: WebViewWidget(controller: controller),
    );
  }
}
