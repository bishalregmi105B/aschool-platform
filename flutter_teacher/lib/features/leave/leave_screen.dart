import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class LeaveScreen extends ConsumerStatefulWidget {
  const LeaveScreen({super.key});

  @override
  ConsumerState<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends ConsumerState<LeaveScreen> {
  List<Map<String, dynamic>> _leaves = [];
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
      final res = await ApiClient.instance.get(
        '/hr/leave',
        queryParameters: {'per_page': 100},
      );
      final data = (res.data is Map<String, dynamic>) ? res.data['data'] : null;
      _leaves = data is List
          ? data
              .whereType<Map>()
              .map((row) => Map<String, dynamic>.from(row))
              .toList()
          : [];
    } catch (e, st) {
      debugPrint('LeaveScreen load failed: $e\n$st');
      _leaves = [];
      _error = 'Could not load leave applications.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        body: Column(
          children: [
            const TabBar(
              tabs: [
                Tab(text: 'Apply Leave'),
                Tab(text: 'Leave Report'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _applyLeaveTab(context),
                  _leaveReportTab(context),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _applyLeaveTab(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const ESchoolCard(
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading:
                Icon(Icons.event_busy_outlined, color: ASchoolTheme.primary),
            title: Text(
              'Apply for Leave',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text('Submit leave applications to administration.'),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _showApplyDialog,
          icon: const Icon(Icons.add),
          label: const Text('Apply Leave'),
        ),
      ],
    );
  }

  Widget _leaveReportTab(BuildContext context) {
    if (_loading) return const LoadingShimmer();
    if (_error != null) {
      return ErrorContainer(errorMessage: _error!, onRetry: _load);
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: _leaves.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                NoDataContainer(
                  title: 'No leave applications submitted',
                  subtitle: 'Your leave history will appear here.',
                  icon: Icons.event_note_outlined,
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _leaves.length,
              itemBuilder: (context, index) {
                final leave = _leaves[index];
                return ESchoolAnimatedEntry(
                  index: index,
                  child: ESchoolCard(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.event_busy_outlined),
                      title: Text(leave['leave_type']?.toString() ?? 'Leave'),
                      subtitle: Text(
                        NepaliFormatter.preferredDateRange(
                          startBs: leave['start_date_bs']?.toString(),
                          endBs: leave['end_date_bs']?.toString(),
                          startAd: leave['start_date']?.toString(),
                          endAd: leave['end_date']?.toString(),
                        ),
                      ),
                      trailing: Chip(
                        label: Text(leave['status']?.toString() ?? 'pending'),
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }

  Future<void> _showApplyDialog() async {
    final typeCtrl = TextEditingController(text: 'casual');
    final startCtrl = TextEditingController();
    final endCtrl = TextEditingController();
    final daysCtrl = TextEditingController(text: '1');
    final reasonCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => ESchoolDialog(
        icon: Icons.event_busy_outlined,
        title: 'Apply Leave',
        subtitle: 'Submit dates and reason for approval.',
        actions: [
          ESchoolSecondaryButton(
            label: 'Cancel',
            onPressed: () => Navigator.pop(dialogContext),
          ),
          ESchoolPrimaryButton(
            label: 'Submit',
            icon: Icons.send_rounded,
            onPressed: () async {
              if (startCtrl.text.trim().isEmpty ||
                  endCtrl.text.trim().isEmpty) {
                return;
              }
              await ApiClient.instance.post('/hr/leave', data: {
                'leave_type': typeCtrl.text.trim(),
                'start_date': startCtrl.text.trim(),
                'end_date': endCtrl.text.trim(),
                'days': int.tryParse(daysCtrl.text.trim()) ?? 1,
                'reason': reasonCtrl.text.trim(),
              });
              if (!dialogContext.mounted) return;
              Navigator.pop(dialogContext);
              await _load();
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Leave application submitted')),
              );
            },
          ),
        ],
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ESchoolTextEditor(
                controller: typeCtrl,
                label: 'Leave Type',
                hintText: 'casual, sick, emergency',
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 10),
              ESchoolTextEditor(
                controller: startCtrl,
                label: 'Start Date',
                hintText: 'YYYY-MM-DD',
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 10),
              ESchoolTextEditor(
                controller: endCtrl,
                label: 'End Date',
                hintText: 'YYYY-MM-DD',
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 10),
              ESchoolTextEditor(
                controller: daysCtrl,
                label: 'Days',
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 10),
              ESchoolTextEditor(
                controller: reasonCtrl,
                label: 'Reason',
                maxLines: 3,
              ),
            ],
          ),
        ),
      ),
    );
    typeCtrl.dispose();
    startCtrl.dispose();
    endCtrl.dispose();
    daysCtrl.dispose();
    reasonCtrl.dispose();
  }
}
