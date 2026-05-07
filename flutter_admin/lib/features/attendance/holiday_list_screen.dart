import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class HolidayListScreen extends StatefulWidget {
  const HolidayListScreen({super.key});

  @override
  State<HolidayListScreen> createState() => _HolidayListScreenState();
}

class _HolidayListScreenState extends State<HolidayListScreen> {
  List<Map<String, dynamic>> _events = [];
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
          .get('/notices/events', queryParameters: {'per_page': 100});
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _events = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (_) {
      _events = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingShimmer());
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: _events.length,
          itemBuilder: (_, i) {
            final e = _events[i];
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                leading: const Icon(Icons.event_outlined),
                title: Text(e['title']?.toString() ?? 'Holiday'),
                subtitle: Text(
                  NepaliFormatter.preferredDateRange(
                    startBs: e['start_date_bs']?.toString(),
                    endBs: e['end_date_bs']?.toString(),
                    startAd: e['start_date']?.toString(),
                    endAd: e['end_date']?.toString(),
                  ),
                ),
                trailing: Text(e['location']?.toString() ?? ''),
              ),
            );
          },
        ),
      ),
    );
  }
}
