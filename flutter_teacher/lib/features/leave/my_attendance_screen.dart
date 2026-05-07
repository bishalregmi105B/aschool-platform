import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class MyAttendanceScreen extends ConsumerStatefulWidget {
  const MyAttendanceScreen({super.key});

  @override
  ConsumerState<MyAttendanceScreen> createState() => _MyAttendanceScreenState();
}

class _MyAttendanceScreenState extends ConsumerState<MyAttendanceScreen> {
  List<Map<String, dynamic>> _records = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await ApiClient.instance
          .get('/attendance/me', queryParameters: {'per_page': 60});
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _records = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (_) {
      _records = [];
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
              child: _records.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        NoDataContainer(
                          title: 'No attendance records found',
                          subtitle:
                              'Your recent attendance logs will appear here.',
                          icon: Icons.fingerprint_outlined,
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _records.length,
                      itemBuilder: (_, i) {
                        final record = _records[i];
                        final status =
                            record['status']?.toString().toLowerCase() ??
                                'present';
                        final isPresent = status == 'present';
                        return ESchoolAnimatedEntry(
                          index: i,
                          child: ESchoolCard(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(
                                isPresent
                                    ? Icons.check_circle_outline
                                    : Icons.cancel_outlined,
                                color:
                                    isPresent ? Colors.green : Colors.redAccent,
                              ),
                              title: Text(record['date']?.toString() ?? 'Date'),
                              subtitle: Text(
                                'Check-in: ${record['check_in'] ?? '-'} • Check-out: ${record['check_out'] ?? '-'}',
                              ),
                              trailing: Chip(label: Text(status)),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
