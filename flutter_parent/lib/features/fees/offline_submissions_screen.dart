import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// "My submissions" — the parent's offline bank/cheque deposit slips and
/// their review status (pending / approved / rejected with notes).
class OfflineSubmissionsScreen extends ConsumerStatefulWidget {
  const OfflineSubmissionsScreen({super.key});

  @override
  ConsumerState<OfflineSubmissionsScreen> createState() =>
      _OfflineSubmissionsScreenState();
}

class _OfflineSubmissionsScreenState
    extends ConsumerState<OfflineSubmissionsScreen> {
  List<OfflineSubmission>? _submissions;
  String? _error;
  bool _loading = true;

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
      final rows = await ref.read(feeRepositoryProvider).listOfflineSubmissions();
      if (mounted) setState(() => _submissions = rows);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      debugPrint('OfflineSubmissionsScreen load failed: $e');
      if (mounted) setState(() => _error = 'Could not load your submissions.');
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'fees',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'My Submissions'),
        body: _loading
            ? const LoadingShimmer()
            : _error != null
                ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                : RefreshIndicator(
                    onRefresh: _load,
                    child: (_submissions ?? const []).isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 120),
                              NoDataContainer(
                                title: 'No submissions yet',
                                subtitle:
                                    'Bank or cheque deposits you submit for review will appear here.',
                                icon: Icons.receipt_long_rounded,
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _submissions!.length,
                            itemBuilder: (_, i) =>
                                _SubmissionCard(submission: _submissions![i]),
                          ),
                  ),
      ),
    );
  }
}

class _SubmissionCard extends StatelessWidget {
  final OfflineSubmission submission;

  const _SubmissionCard({required this.submission});

  @override
  Widget build(BuildContext context) {
    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                submission.isApproved
                    ? Icons.check_circle_rounded
                    : submission.isRejected
                        ? Icons.cancel_rounded
                        : Icons.hourglass_top_rounded,
                size: 20,
                color: submission.isApproved
                    ? ASchoolTheme.success
                    : submission.isRejected
                        ? ASchoolTheme.danger
                        : ASchoolTheme.warning,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _methodLabel,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 15),
                ),
              ),
              _StatusChip(status: submission.status),
            ],
          ),
          const SizedBox(height: 8),
          Text('Rs ${submission.amount.toStringAsFixed(0)}',
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          _detailRow(Icons.badge_rounded,
              'Ref: ${submission.referenceNo ?? submission.id}'),
          if (submission.bankName != null && submission.bankName!.isNotEmpty)
            _detailRow(Icons.account_balance_rounded, submission.bankName!),
          if (submission.paidOnBs != null && submission.paidOnBs!.isNotEmpty)
            _detailRow(Icons.calendar_month_rounded,
                'Paid on ${submission.paidOnBs} (BS)'),
          if (submission.studentName != null &&
              submission.studentName!.isNotEmpty)
            _detailRow(Icons.person_rounded, submission.studentName!),
          if (submission.isRejected &&
              (submission.reviewNotes ?? '').isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: ASchoolTheme.danger.withAlpha(20),
                borderRadius: BorderRadius.circular(ASchoolTheme.radiusSm),
              ),
              child: Text(
                'Office note: ${submission.reviewNotes}',
                style: TextStyle(
                  fontSize: 12.5,
                  color: Colors.red.shade800,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String get _methodLabel =>
      submission.method == 'cheque' ? 'Cheque deposit' : 'Bank deposit';

  Widget _detailRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 15, color: Colors.grey.shade500),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      'approved' => (ASchoolTheme.success, 'Approved'),
      'rejected' => (ASchoolTheme.danger, 'Rejected'),
      _ => (ASchoolTheme.warning, 'Pending'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha(22),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
