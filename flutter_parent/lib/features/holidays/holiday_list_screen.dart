import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ParentHolidayScreen extends ConsumerStatefulWidget {
  const ParentHolidayScreen({super.key});

  @override
  ConsumerState<ParentHolidayScreen> createState() =>
      _ParentHolidayScreenState();
}

class _ParentHolidayScreenState extends ConsumerState<ParentHolidayScreen> {
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
    if (_loading) return const LoadingShimmer();
    return RefreshIndicator(
      onRefresh: _load,
      child: _events.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                NoDataContainer(
                  title: 'No upcoming holidays',
                  subtitle: 'Published holiday events will appear here.',
                  icon: Icons.event_busy_rounded,
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _events.length,
              itemBuilder: (_, i) {
                final e = _events[i];
                return ESchoolAnimatedEntry(
                  index: i,
                  child: ESchoolCard(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: EdgeInsets.zero,
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
                    ),
                  ),
                );
              },
            ),
    );
  }
}
