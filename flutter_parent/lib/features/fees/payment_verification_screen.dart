import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';
import 'receipt_launcher.dart';

/// Shown right after the payment gateway webview returns. Re-fetches the
/// collection status and walks through three states:
///   checking (spinner) → success (receipt download)
///   → still-pending guidance ("we will notify you").
class PaymentVerificationScreen extends ConsumerStatefulWidget {
  final String collectionId;
  final String? studentId;

  const PaymentVerificationScreen({
    super.key,
    required this.collectionId,
    this.studentId,
  });

  @override
  ConsumerState<PaymentVerificationScreen> createState() =>
      _PaymentVerificationScreenState();
}

enum _Phase { checking, success, pending, error }

class _PaymentVerificationScreenState
    extends ConsumerState<PaymentVerificationScreen> {
  static const _autoCheckAttempts = 3;
  static const _autoCheckDelay = Duration(seconds: 3);

  _Phase _phase = _Phase.checking;
  FeePayment? _payment;
  String? _error;
  bool _rechecking = false;
  bool _downloadingReceipt = false;

  @override
  void initState() {
    super.initState();
    _autoVerify();
  }

  String get _studentId =>
      widget.studentId ?? ref.read(selectedChildIdForApiProvider) ?? '';

  /// Checks a few times over several seconds — the gateway webhook may land
  /// a moment after the browser/webview returns.
  Future<void> _autoVerify() async {
    for (var attempt = 0; attempt < _autoCheckAttempts; attempt++) {
      final confirmed = await _check();
      if (!mounted) return;
      if (confirmed) return;
      if (attempt < _autoCheckAttempts - 1) {
        await Future<void>.delayed(_autoCheckDelay);
        if (!mounted) return;
      }
    }
    setState(() => _phase = _Phase.pending);
  }

  /// Re-fetches /fees/collections and looks for the paid collection.
  /// Returns true when the payment is confirmed.
  Future<bool> _check() async {
    try {
      final payments =
          await ref.read(feeRepositoryProvider).getTransactions(_studentId);
      FeePayment? match;
      for (final payment in payments) {
        if (payment.id == widget.collectionId) {
          match = payment;
          break;
        }
      }
      if (!mounted) return false;
      setState(() {
        _payment = match;
        _error = null;
      });
      final status = match?.status;
      final confirmed = match != null &&
          (status == 'paid' || status == 'partial' || status == 'waived');
      if (confirmed) setState(() => _phase = _Phase.success);
      return confirmed;
    } on ApiException catch (e) {
      if (!mounted) return false;
      setState(() {
        _error = e.message;
        _phase = _Phase.error;
      });
      return false;
    } catch (e) {
      debugPrint('PaymentVerificationScreen check failed: $e');
      if (!mounted) return false;
      // Network blip during auto-check: keep waiting instead of failing hard.
      if (_phase == _Phase.checking) return false;
      setState(() {
        _error = 'Could not verify right now. Please check your connection.';
        _phase = _Phase.error;
      });
      return false;
    }
  }

  Future<void> _recheck() async {
    setState(() {
      _rechecking = true;
      _phase = _Phase.checking;
    });
    final confirmed = await _check();
    if (!mounted) return;
    if (!confirmed) {
      setState(() {
        _phase = _Phase.pending;
        _rechecking = false;
      });
    } else {
      setState(() => _rechecking = false);
    }
  }

  Future<void> _downloadReceipt() async {
    final url = _payment?.receiptUrl;
    if (url == null || url.isEmpty) return;
    setState(() => _downloadingReceipt = true);
    final ok = await openReceiptPdf(url);
    if (!mounted) return;
    setState(() => _downloadingReceipt = false);
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Could not open the receipt. Please try again.'),
        backgroundColor: ASchoolTheme.danger,
      ));
    }
  }

  void _backToFees() => context.go('/fees');

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'fees',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Payment status'),
        body: switch (_phase) {
          _Phase.checking => _checkingView(),
          _Phase.success => _successView(),
          _Phase.pending => _pendingView(),
          _Phase.error => ErrorContainer(
              errorMessage: _error ?? 'Verification failed.',
              onRetry: _recheck,
            ),
        },
      ),
    );
  }

  Widget _checkingView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: ASchoolTheme.primary),
          const SizedBox(height: 20),
          const Text(
            'Verifying your payment…',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            'This only takes a few seconds.',
            style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }

  Widget _successView() {
    final hasReceipt = (_payment?.receiptUrl ?? '').isNotEmpty;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: ASchoolTheme.success.withAlpha(26),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded,
                  size: 56, color: ASchoolTheme.success),
            ),
            const SizedBox(height: 20),
            const Text(
              'Payment confirmed!',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            Text(
              'Thank you — your payment has been received and recorded.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 14, color: Colors.grey.shade700, height: 1.5),
            ),
            const SizedBox(height: 24),
            if (hasReceipt)
              FilledButton.icon(
                onPressed:
                    _downloadingReceipt ? null : _downloadReceipt,
                icon: _downloadingReceipt
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.picture_as_pdf_rounded, size: 18),
                label: const Text('Download receipt'),
              ),
            if (hasReceipt) const SizedBox(height: 8),
            FilledButton.tonal(
              onPressed: _backToFees,
              child: const Text('Back to fees'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pendingView() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: ASchoolTheme.warning.withAlpha(26),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.schedule_rounded,
                  size: 56, color: ASchoolTheme.warning),
            ),
            const SizedBox(height: 20),
            const Text(
              'Payment not confirmed yet',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            Text(
              'Your payment is still being processed by the gateway. '
              'We will notify you when the payment is confirmed — '
              'please do not pay again in the meantime.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 14, color: Colors.grey.shade700, height: 1.5),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _rechecking ? null : _recheck,
              icon: _rechecking
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Check again'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _backToFees,
              child: const Text('Back to fees'),
            ),
          ],
        ),
      ),
    );
  }
}
