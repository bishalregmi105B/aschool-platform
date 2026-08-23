import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../utils/nepali_formatter.dart';
import '../widgets/custom_app_bar.dart';
import '../widgets/eschool_components.dart';
import '../widgets/loading_shimmer.dart';
import '../widgets/no_data_container.dart';

/// Shared holiday list screen used by admin, teacher, parent and student apps.
///
/// Fetches published events from `/notices/events` and renders them as
/// animated cards with BS/AD date ranges.
class HolidayListScreen extends StatefulWidget {
  final String title;
  final bool showAppBar;
  final String emptyTitle;
  final String emptySubtitle;
  final bool showLocation;

  const HolidayListScreen({
    super.key,
    this.title = 'Holiday List',
    this.showAppBar = false,
    this.emptyTitle = 'No holidays found',
    this.emptySubtitle = 'Upcoming holiday events will appear here.',
    this.showLocation = false,
  });

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
    return Scaffold(
      appBar: widget.showAppBar ? CustomAppBar(title: widget.title) : null,
      body: _loading
          ? const LoadingShimmer()
          : RefreshIndicator(
              onRefresh: _load,
              child: _events.isEmpty
                  ? ListView(
                      children: [
                        const SizedBox(height: 120),
                        NoDataContainer(
                          title: widget.emptyTitle,
                          subtitle: widget.emptySubtitle,
                          icon: Icons.event_outlined,
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
                              trailing: widget.showLocation
                                  ? Text(e['location']?.toString() ?? '')
                                  : null,
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
