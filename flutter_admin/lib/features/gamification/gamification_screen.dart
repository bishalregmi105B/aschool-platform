import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Gamification — leaderboards, badges, streaks, rewards
class GamificationScreen extends ConsumerStatefulWidget {
  const GamificationScreen({super.key});

  @override
  ConsumerState<GamificationScreen> createState() =>
      _GamificationScreenState();
}

class _GamificationScreenState extends ConsumerState<GamificationScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _leaderboard = [];
  List<Map<String, dynamic>> _badges = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/gamification/leaderboard?per_page=20'),
        ApiClient.instance.get('/gamification/badges?per_page=20'),
      ]);
      setState(() {
        _leaderboard =
            List<Map<String, dynamic>>.from(results[0].data['data'] ?? []);
        _badges =
            List<Map<String, dynamic>>.from(results[1].data['data'] ?? []);
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('GamificationScreen load failed: $e\n$st');
      setState(() {
        _error = 'Could not load gamification data.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'gamification',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Gamification'),
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Leaderboard'),
              Tab(text: 'Badges'),
            ],
          ),
        ),
        body: _loading
            ? const LoadingShimmer()
            : _error != null
                ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                : TabBarView(
                    controller: _tabCtrl,
                    children: [_buildLeaderboard(), _buildBadges()],
                  ),
      ),
    );
  }

  // ── Leaderboard Tab ───────────────────────────────────────────────────────

  Widget _buildLeaderboard() {
    if (_leaderboard.isEmpty) {
      return const NoDataContainer(
        title: 'No leaderboard data',
        subtitle: 'Student points accumulate as they complete activities',
        icon: Icons.emoji_events_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _leaderboard.length,
        itemBuilder: (_, i) {
          final entry = _leaderboard[i];
          final rank = i + 1;
          final rankColor = switch (rank) {
            1 => const Color(0xFFFFD700),
            2 => const Color(0xFFC0C0C0),
            3 => const Color(0xFFCD7F32),
            _ => ASchoolTheme.mutedText,
          };
          final points =
              safeIntOrNull(entry['total_points']) ?? 0;

          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: rankColor.withAlpha(30),
                  child: Text(
                    '$rank',
                    style: TextStyle(
                      color: rankColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                title: Text(
                  safeStringOrNull(entry['student_name']) ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  safeStringOrNull(entry['class_name']) ?? '',
                  style: const TextStyle(
                      fontSize: 12, color: ASchoolTheme.mutedText),
                ),
                trailing: ESchoolInfoPill(
                  icon: Icons.star_rounded,
                  label: '$points pts',
                  color: ASchoolTheme.primary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Badges Tab ────────────────────────────────────────────────────────────

  Widget _buildBadges() {
    if (_badges.isEmpty) {
      return const NoDataContainer(
        title: 'No badges created',
        subtitle: 'Create badges to reward student achievements',
        icon: Icons.military_tech_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          childAspectRatio: 0.85,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
        ),
        itemCount: _badges.length,
        itemBuilder: (_, i) {
          final badge = _badges[i];
          final awardedCount =
              safeIntOrNull(badge['awarded_count']) ?? 0;

          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              padding: const EdgeInsets.all(12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.military_tech_rounded,
                    size: 36,
                    color: Color(0xFFFFD700),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    safeStringOrNull(badge['name']) ?? '',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${awardedCount}× awarded',
                    style: const TextStyle(
                      fontSize: 10,
                      color: ASchoolTheme.mutedText,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
