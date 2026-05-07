import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Alumni Network — directory, events, donation tracking
class AlumniScreen extends ConsumerStatefulWidget {
  const AlumniScreen({super.key});

  @override
  ConsumerState<AlumniScreen> createState() => _AlumniScreenState();
}

class _AlumniScreenState extends ConsumerState<AlumniScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _alumni = [];
  List<Map<String, dynamic>> _events = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/alumni?per_page=20'),
        ApiClient.instance.get('/alumni/events?per_page=10'),
      ]);
      setState(() {
        _alumni =
            List<Map<String, dynamic>>.from(results[0].data['data'] ?? []);
        _events =
            List<Map<String, dynamic>>.from(results[1].data['data'] ?? []);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'alumni',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Alumni Network'),
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Directory'),
              Tab(text: 'Events'),
              Tab(text: 'Donations'),
            ],
          ),
        ),
        body: _loading
            ? const LoadingShimmer()
            : TabBarView(
                controller: _tabCtrl,
                children: [
                  _buildDirectory(),
                  _buildEvents(),
                  _buildDonations(),
                ],
              ),
      ),
    );
  }

  Widget _buildDirectory() {
    if (_alumni.isEmpty) {
      return const NoDataContainer(
        title: 'No alumni registered yet',
        subtitle: 'Share the alumni registration link with graduates',
        icon: Icons.school_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _alumni.length,
        itemBuilder: (_, i) {
          final a = _alumni[i];
          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: ASchoolTheme.primary.withAlpha(20),
                  child: Text(
                    (a['name'] as String? ?? 'A')
                        .substring(0, 1)
                        .toUpperCase(),
                    style: const TextStyle(
                      color: ASchoolTheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                title: Text(
                  a['name'] as String? ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  'Batch ${a['graduation_year'] ?? ''} • ${a['occupation'] ?? ''}',
                  style: const TextStyle(
                      fontSize: 12, color: ASchoolTheme.mutedText),
                ),
                trailing: const Icon(
                  Icons.chevron_right_rounded,
                  color: ASchoolTheme.mutedText,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildEvents() {
    if (_events.isEmpty) {
      return const NoDataContainer(
        title: 'No alumni events',
        subtitle: 'Create events to reconnect with your alumni community',
        icon: Icons.event_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _events.length,
        itemBuilder: (_, i) {
          final ev = _events[i];
          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: const Color(0xFF0EA5E9).withAlpha(20),
                  child: const Icon(
                    Icons.event_rounded,
                    color: Color(0xFF0EA5E9),
                  ),
                ),
                title: Text(
                  ev['title'] as String? ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  '${ev['date'] ?? ''} • ${ev['venue'] ?? ''}',
                  style: const TextStyle(
                      fontSize: 12, color: ASchoolTheme.mutedText),
                ),
                trailing: ESchoolInfoPill(
                  icon: Icons.people_rounded,
                  label: '${ev['rsvp_count'] ?? 0} RSVP',
                  color: ASchoolTheme.primary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildDonations() {
    return const Center(
      child: Text(
        'Donation tracking — coming soon',
        style: TextStyle(color: ASchoolTheme.mutedText),
      ),
    );
  }
}
