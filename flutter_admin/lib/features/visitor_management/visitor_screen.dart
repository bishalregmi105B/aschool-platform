import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Visitor Management — log visitors, check in/out, visitor badges
class VisitorScreen extends ConsumerStatefulWidget {
  const VisitorScreen({super.key});

  @override
  ConsumerState<VisitorScreen> createState() => _VisitorScreenState();
}

class _VisitorScreenState extends ConsumerState<VisitorScreen> {
  List<Map<String, dynamic>> _visitors = [];
  bool _loading = true;

  // Form state for check-in bottom sheet
  final _nameCtrl = TextEditingController();
  final _purposeCtrl = TextEditingController();
  final _meetingCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _purposeCtrl.dispose();
    _meetingCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance
          .get('/visitors?per_page=30&date=today');
      setState(() {
        _visitors =
            List<Map<String, dynamic>>.from(res.data['data'] ?? []);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _checkIn() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    try {
      await ApiClient.instance.post('/visitors/check-in', data: {
        'name': _nameCtrl.text.trim(),
        'purpose': _purposeCtrl.text.trim(),
        'meeting_person': _meetingCtrl.text.trim(),
      });
      _nameCtrl.clear();
      _purposeCtrl.clear();
      _meetingCtrl.clear();
      await _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final insideCount =
        _visitors.where((v) => v['checked_out_at'] == null).length;

    return PluginGate(
      pluginSlug: 'visitor_management',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Visitor Management'),
          actions: [
            IconButton(
              icon: const Icon(Icons.qr_code_scanner_rounded),
              tooltip: 'Scan Badge',
              onPressed: () {/* TODO: QR scanner */},
            ),
          ],
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: () => _showCheckInSheet(),
          tooltip: 'Check In Visitor',
          child: const Icon(Icons.person_add_rounded),
        ),
        body: _loading
            ? const LoadingShimmer()
            : _visitors.isEmpty
                ? const NoDataContainer(
                    title: 'No visitors today',
                    subtitle: 'Tap + to check in a new visitor',
                    icon: Icons.badge_rounded,
                  )
                : Column(
                    children: [
                      // Summary banner
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        color: ASchoolTheme.primary.withAlpha(8),
                        child: Row(
                          children: [
                            ESchoolInfoPill(
                              icon: Icons.people_rounded,
                              label: "Today: ${_visitors.length}",
                              color: ASchoolTheme.primary,
                            ),
                            const SizedBox(width: 8),
                            ESchoolInfoPill(
                              icon: Icons.location_on_rounded,
                              label: 'Inside: $insideCount',
                              color: ASchoolTheme.success,
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: PullToRefresh(
                          onRefresh: _load,
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _visitors.length,
                            itemBuilder: (_, i) {
                              final v = _visitors[i];
                              final isInside = v['checked_out_at'] == null;

                              return ESchoolAnimatedEntry(
                                index: i,
                                child: ESchoolCard(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  child: ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    leading: CircleAvatar(
                                      backgroundColor: (isInside
                                              ? ASchoolTheme.success
                                              : ASchoolTheme.mutedText)
                                          .withAlpha(20),
                                      child: Icon(
                                        Icons.person_rounded,
                                        color: isInside
                                            ? ASchoolTheme.success
                                            : ASchoolTheme.mutedText,
                                      ),
                                    ),
                                    title: Text(
                                      v['name'] as String? ?? '',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600),
                                    ),
                                    subtitle: Text(
                                      '${v['purpose'] ?? ''} → ${v['meeting_person'] ?? ''}',
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: ASchoolTheme.mutedText),
                                    ),
                                    trailing: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          v['checked_in_at'] as String? ?? '',
                                          style: const TextStyle(
                                              fontSize: 11,
                                              color: ASchoolTheme.mutedText),
                                        ),
                                        const SizedBox(height: 2),
                                        ESchoolInfoPill(
                                          icon: Icons.circle,
                                          label:
                                              isInside ? 'Inside' : 'Left',
                                          color: isInside
                                              ? ASchoolTheme.success
                                              : ASchoolTheme.mutedText,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }

  // ── Check-In Bottom Sheet ─────────────────────────────────────────────────

  void _showCheckInSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          top: 20,
          left: 16,
          right: 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Check In Visitor',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Visitor Name *'),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _purposeCtrl,
              decoration:
                  const InputDecoration(labelText: 'Purpose of Visit'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _meetingCtrl,
              decoration: const InputDecoration(labelText: 'Meeting Person'),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  _checkIn();
                },
                child: const Text('Check In'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
