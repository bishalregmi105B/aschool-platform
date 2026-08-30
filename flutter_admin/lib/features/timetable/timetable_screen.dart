import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key});

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  List<Map<String, dynamic>> _slots = [];
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
      final r = await ApiClient.instance.get('/timetable');
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _slots = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (e, st) {
      debugPrint('TimetableScreen load failed: $e\n$st');
      _slots = [];
      _error = 'Could not load the timetable.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingShimmer());
    if (_error != null) {
      return Scaffold(
        body: ErrorContainer(errorMessage: _error!, onRetry: _load),
      );
    }
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: _slots.length,
          itemBuilder: (_, i) {
            final s = _slots[i];
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                leading: const Icon(Icons.schedule_outlined),
                title: Text(
                    'Day ${s['day_of_week'] ?? '-'}  Period ${s['period_number'] ?? '-'}'),
                subtitle:
                    Text('${s['start_time'] ?? '-'} - ${s['end_time'] ?? '-'}'),
              ),
            );
          },
        ),
      ),
    );
  }
}
