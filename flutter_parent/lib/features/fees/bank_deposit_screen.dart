import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart' show ImageSource;
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

/// "Pay via bank deposit" — the parent pays by bank transfer or cheque out
/// of band, uploads the slip and submits it for office approval. Money is
/// only applied once the school office approves (S-A1 offline submissions).
class BankDepositScreen extends ConsumerStatefulWidget {
  const BankDepositScreen({super.key});

  @override
  ConsumerState<BankDepositScreen> createState() => _BankDepositScreenState();
}

class _BankDepositScreenState extends ConsumerState<BankDepositScreen> {
  final Set<String> _selectedBills = {};
  final _amountController = TextEditingController();
  final _bankNameController = TextEditingController();
  final _referenceController = TextEditingController();

  String _method = 'bank';
  String? _paidOnBs;
  UploadedFile? _slip;
  bool _uploading = false;
  double _uploadProgress = 0;
  bool _submitting = false;
  OfflineSubmission? _result;

  @override
  void dispose() {
    _amountController.dispose();
    _bankNameController.dispose();
    _referenceController.dispose();
    super.dispose();
  }

  String? get _studentId => ref.read(selectedChildIdForApiProvider);

  double get _selectedTotal {
    final fees = ref.read(parentFeesProvider(_studentId)).valueOrNull ??
        const <Map<String, dynamic>>[];
    return fees
        .where((f) => _selectedBills.contains(f['id']?.toString()))
        .fold(0.0, (sum, f) => sum + (safeDoubleOrNull(f['amount']) ?? 0));
  }

  void _toggleBill(String billId) {
    setState(() {
      if (_selectedBills.contains(billId)) {
        _selectedBills.remove(billId);
      } else {
        _selectedBills.add(billId);
      }
      // Auto-sum; still editable by hand afterwards.
      _amountController.text = _selectedTotal == 0
          ? ''
          : _selectedTotal.toStringAsFixed(_selectedTotal.truncateToDouble() == _selectedTotal ? 0 : 2);
    });
  }

  Future<void> _pickSlip(ImageSource source) async {
    setState(() {
      _uploading = true;
      _uploadProgress = 0;
    });
    final uploaded = await FileUploadService.instance.pickAndUploadImage(
      module: UploadModule.other,
      source: source,
      onProgress: (p) => _uploadProgress = p,
    );
    if (!mounted) return;
    setState(() {
      _uploading = false;
      if (uploaded != null) _slip = uploaded;
    });
    if (uploaded == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Could not upload the slip. Please try again.'),
        backgroundColor: ASchoolTheme.danger,
      ));
    }
  }

  Future<void> _submit(String studentId) async {
    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    if (_selectedBills.isEmpty) {
      _toast('Select at least one bill to settle.');
      return;
    }
    if (amount <= 0) {
      _toast('Enter the deposited amount.');
      return;
    }
    setState(() => _submitting = true);
    try {
      final submission = await ref.read(feeRepositoryProvider).createOfflineSubmission(
            studentId: studentId,
            amount: amount,
            method: _method,
            bankName: _bankNameController.text.trim(),
            referenceNo: _referenceController.text.trim(),
            paidOnBs: _paidOnBs,
            slipFileId: _slip?.id,
            collectionIds: _selectedBills.toList(),
          );
      ref.invalidate(parentFeesProvider(studentId));
      if (mounted) setState(() => _result = submission);
    } on ApiException catch (e) {
      _toast(e.message);
    } catch (e) {
      debugPrint('BankDepositScreen submit failed: $e');
      _toast('Could not submit the deposit. Please check your connection.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: ASchoolTheme.danger,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'fees',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Bank / Cheque Deposit'),
        body: _result != null
            ? _SuccessView(
                submission: _result!,
                onViewSubmissions: () =>
                    context.pushReplacement('/fees/submissions'),
                onBack: () => context.pop(),
              )
            : _buildForm(),
      ),
    );
  }

  Widget _buildForm() {
    final studentId = ref.watch(selectedChildIdForApiProvider);
    final state = ref.watch(parentFeesProvider(studentId));

    return state.when(
      loading: () => const LoadingShimmer(),
      error: (err, _) => ErrorContainer(
        errorMessage: err.toString(),
        onRetry: () => ref.invalidate(parentFeesProvider(studentId)),
      ),
      data: (fees) {
        if (fees.isEmpty) {
          return const NoDataContainer(
            title: 'No outstanding fees',
            subtitle: 'Nothing to settle by bank deposit right now.',
            icon: Icons.check_circle_rounded,
          );
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ESchoolCard(
              color: ASchoolTheme.primary.withAlpha(14),
              child: Row(
                children: [
                  const Icon(Icons.info_outline_rounded,
                      size: 20, color: ASchoolTheme.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Pay by bank transfer or cheque, then submit the slip '
                      'here. The school office will verify your deposit and '
                      'issue a receipt.',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: Colors.grey.shade700,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SectionHeader(title: '1. Select bills to settle'),
            ...fees.map((f) {
              final billId = f['id']?.toString() ?? '';
              final studentName = f['student_name']?.toString();
              final subtitle = studentName != null && studentName.isNotEmpty
                  ? '${f['month'] ?? ''} • $studentName'
                  : (f['month'] ?? 'Due');
              return ESchoolCard(
                margin: const EdgeInsets.only(bottom: 8),
                padding: EdgeInsets.zero,
                child: CheckboxListTile(
                  value: _selectedBills.contains(billId),
                  activeColor: ASchoolTheme.primary,
                  onChanged: (_) => _toggleBill(billId),
                  title: Text(f['fee_type']?.toString() ?? 'Fee'),
                  subtitle: Text(subtitle),
                  secondary: Text(
                    'Rs ${f['amount'] ?? 0}',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ),
              );
            }),
            const SectionHeader(title: '2. Payment details'),
            ASchoolFormField(
              label: 'Amount deposited (Rs)',
              ne: 'जम्मा गरिएको रकम (Rs)',
              child: TextFormField(
                controller: _amountController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  hintText: '0',
                  prefixIcon: Icon(Icons.payments_rounded, size: 20),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'bank',
                  icon: Icon(Icons.account_balance_rounded, size: 18),
                  label: Text('Bank transfer'),
                ),
                ButtonSegment(
                  value: 'cheque',
                  icon: Icon(Icons.receipt_rounded, size: 18),
                  label: Text('Cheque'),
                ),
              ],
              selected: {_method},
              onSelectionChanged: (selection) =>
                  setState(() => _method = selection.first),
            ),
            const SizedBox(height: 12),
            ASchoolFormField(
              label: 'Bank name',
              ne: 'बैंकको नाम',
              child: TextFormField(
                controller: _bankNameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  hintText: 'e.g. Nabil Bank',
                  prefixIcon: Icon(Icons.account_balance_rounded, size: 20),
                ),
              ),
            ),
            const SizedBox(height: 12),
            ASchoolFormField(
              label: 'Reference / cheque no.',
              ne: 'रेफरेन्स / चेक नम्बर',
              child: TextFormField(
                controller: _referenceController,
                decoration: const InputDecoration(
                  hintText: 'Voucher or cheque number',
                  prefixIcon: Icon(Icons.tag_rounded, size: 20),
                ),
              ),
            ),
            const SizedBox(height: 12),
            BsDateField(
              label: 'Paid on (BS date)',
              hint: 'YYYY-MM-DD',
              emitBs: true,
              onChanged: (value) => _paidOnBs = value,
            ),
            const SizedBox(height: 12),
            const SectionHeader(title: '3. Deposit slip photo'),
            _SlipUploadCard(
              slip: _slip,
              uploading: _uploading,
              progress: _uploadProgress,
              onPick: _pickSlip,
              onRemove: () => setState(() => _slip = null),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _submitting || _uploading
                  ? null
                  : () => _submit(studentId ?? ''),
              style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
              child: _submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Submit for approval',
                      style:
                          TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            ),
            const SizedBox(height: 24),
          ],
        );
      },
    );
  }
}

class _SlipUploadCard extends StatelessWidget {
  final UploadedFile? slip;
  final bool uploading;
  final double progress;
  final ValueChanged<ImageSource> onPick;
  final VoidCallback onRemove;

  const _SlipUploadCard({
    required this.slip,
    required this.uploading,
    required this.progress,
    required this.onPick,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return ESchoolCard(
      child: uploading
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Uploading slip…'),
                const SizedBox(height: 8),
                LinearProgressIndicator(value: progress > 0 ? progress : null),
              ],
            )
          : slip != null
              ? Row(
                  children: [
                    const Icon(Icons.image_rounded,
                        color: ASchoolTheme.success),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        slip!.originalName,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: onRemove,
                    ),
                  ],
                )
              : Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => onPick(ImageSource.camera),
                        icon: const Icon(Icons.photo_camera_rounded, size: 18),
                        label: const Text('Camera'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => onPick(ImageSource.gallery),
                        icon: const Icon(Icons.photo_library_rounded, size: 18),
                        label: const Text('Gallery'),
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _SuccessView extends StatelessWidget {
  final OfflineSubmission submission;
  final VoidCallback onViewSubmissions;
  final VoidCallback onBack;

  const _SuccessView({
    required this.submission,
    required this.onViewSubmissions,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
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
              child: const Icon(Icons.mark_email_read_rounded,
                  size: 56, color: ASchoolTheme.success),
            ),
            const SizedBox(height: 20),
            const Text(
              'Deposit submitted!',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            Text(
              'Your ${submission.method == 'cheque' ? 'cheque' : 'bank deposit'} '
              'of Rs ${submission.amount.toStringAsFixed(0)} is waiting for '
              'office approval. We will notify you once it is confirmed — '
              'usually within 1–2 school days.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade700,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onViewSubmissions,
              icon: const Icon(Icons.fact_check_outlined, size: 18),
              label: const Text('View my submissions'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: onBack,
              child: const Text('Back to fees'),
            ),
          ],
        ),
      ),
    );
  }
}
