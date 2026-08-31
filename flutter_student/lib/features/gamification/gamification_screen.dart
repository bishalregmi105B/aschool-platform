import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Gamification — Badges, points, leaderboard, and houses
///
/// Backed by real endpoints:
/// - GET /student/achievements → {total_points, rank, badges, locked_badges,
///   leaderboard, history} (there is no /student/gamification endpoint)
/// - GET /gamification/houses  → [{name, color, total_points, ...}]
class GamificationScreen extends ConsumerStatefulWidget {
  const GamificationScreen({super.key});

  @override
  ConsumerState<GamificationScreen> createState() => _GamificationScreenState();
}

class _GamificationScreenState extends ConsumerState<GamificationScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<String, dynamic>? _myStats;
  List<dynamic> _badges = [];
  List<dynamic> _leaderboard = [];
  List<dynamic> _houses = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.get('/student/achievements');
      final payload = safeMap(envelopeData(res.data));
      // Houses live on the gamification blueprint; a failure there must not
      // blank the whole screen, so degrade to an empty list.
      List<dynamic> houses = const [];
      try {
        final housesRes = await ApiClient.instance.get('/gamification/houses');
        houses = safeList(envelopeData(housesRes.data));
      } catch (e) {
        debugPrint('GamificationScreen houses load failed: $e');
      }
      setState(() {
        _myStats = {
          'total_points': payload['total_points'] ?? 0,
          'rank': payload['rank'],
          'badge_count': safeList(payload['badges']).length,
        };
        _badges = [
          ...safeList(payload['badges']),
          ...safeList(payload['locked_badges']),
        ];
        _leaderboard = safeList(payload['leaderboard']);
        _houses = houses;
      });
    } catch (e, st) {
      debugPrint('GamificationScreen load failed: $e\n$st');
      _error = 'Could not load your badges and points.';
    }
    setState(() => _loading = false);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return PluginGate(
      pluginSlug: 'gamification',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Achievements & Points'),
        body: _loading
            ? const LoadingShimmer()
            : _error != null
                ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                : Column(
                children: [
                  // Points header
                  if (_myStats != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            theme.colorScheme.primary,
                            theme.colorScheme.primary.withAlpha(180),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.star_rounded,
                              color: Colors.amber, size: 40),
                          const SizedBox(height: 8),
                          Text(
                            '${_myStats?['total_points'] ?? 0}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 36,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const Text('Total Points',
                              style: TextStyle(color: Colors.white70)),
                          const SizedBox(height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              _PointStat(
                                label: 'Rank',
                                value: '#${_myStats?['rank'] ?? '--'}',
                              ),
                              _PointStat(
                                label: 'Level',
                                value: _myStats?['level'] ?? '--',
                              ),
                              _PointStat(
                                label: 'Badges',
                                value: '${_myStats?['badge_count'] ?? 0}',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  TabBar(
                    controller: _tabController,
                    tabs: const [
                      Tab(text: 'Leaderboard'),
                      Tab(text: 'Badges'),
                      Tab(text: 'Houses'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _LeaderboardTab(leaderboard: _leaderboard),
                        _BadgesTab(badges: _badges),
                        _HousesTab(houses: _houses),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _PointStat extends StatelessWidget {
  final String label;
  final String value;

  const _PointStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 16)),
        Text(label,
            style: const TextStyle(color: Colors.white70, fontSize: 11)),
      ],
    );
  }
}

class _LeaderboardTab extends StatelessWidget {
  final List<dynamic> leaderboard;
  const _LeaderboardTab({required this.leaderboard});

  @override
  Widget build(BuildContext context) {
    if (leaderboard.isEmpty) {
      return const NoDataContainer(
        title: 'Leaderboard empty',
        subtitle: 'Earn points to appear on the leaderboard!',
        icon: Icons.leaderboard_rounded,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: leaderboard.length,
      itemBuilder: (context, index) {
        final s = leaderboard[index];
        final rank = index + 1;
        final Color rankColor = rank == 1
            ? Colors.amber
            : rank == 2
                ? Colors.grey
                : rank == 3
                    ? const Color(0xFFCD7F32)
                    : Colors.blueGrey;
        return ListTile(
          leading: CircleAvatar(
            backgroundColor: rankColor.withAlpha(25),
            child: Text('$rank',
                style:
                    TextStyle(fontWeight: FontWeight.bold, color: rankColor)),
          ),
          title: Text(s['student_name'] ?? s['name'] ?? '—',
              style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(s['class_name'] ?? '—'),
          trailing: Text('${s['points'] ?? 0} pts',
              style: const TextStyle(fontWeight: FontWeight.bold)),
        );
      },
    );
  }
}

class _BadgesTab extends StatelessWidget {
  final List<dynamic> badges;
  const _BadgesTab({required this.badges});

  @override
  Widget build(BuildContext context) {
    if (badges.isEmpty) {
      return const NoDataContainer(
        title: 'No badges yet',
        subtitle: 'Complete activities to earn badges!',
        icon: Icons.military_tech_rounded,
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.8,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: badges.length,
      itemBuilder: (context, index) {
        final b = badges[index];
        final bool earned = b['earned'] == true || b['earned_at'] != null;
        return Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: earned
                  ? Colors.amber.withAlpha(30)
                  : Colors.grey.withAlpha(20),
              child: Text(
                b['emoji'] ?? '🏅',
                style:
                    TextStyle(fontSize: 24, color: earned ? null : Colors.grey),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              b['name'] ?? '—',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: earned ? null : Colors.grey,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        );
      },
    );
  }
}

class _HousesTab extends StatelessWidget {
  final List<dynamic> houses;
  const _HousesTab({required this.houses});

  @override
  Widget build(BuildContext context) {
    if (houses.isEmpty) {
      return const NoDataContainer(
        title: 'No house groups',
        subtitle: 'House competition data will appear here',
        icon: Icons.home_rounded,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: houses.length,
      itemBuilder: (context, index) {
        final h = houses[index];
        final maxPoints = (houses
            .map((x) => safeNumOrNull(x['total_points']) ?? 0)
            .reduce((a, b) => a > b ? a : b)).toDouble();
        final pts = (safeNumOrNull(h['total_points']) ?? 0).toDouble();
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(h['emoji'] ?? '🏠',
                        style: const TextStyle(fontSize: 24)),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(h['name'] ?? '—',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 16))),
                    Text('${h['total_points'] ?? 0} pts',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: maxPoints > 0 ? pts / maxPoints : 0,
                  backgroundColor: Colors.grey.withAlpha(30),
                  valueColor: AlwaysStoppedAnimation<Color>(
                      _parseColor(safeStringOrNull(h['color'])) ??
                          Theme.of(context).colorScheme.primary),
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(4),
                ),
                const SizedBox(height: 4),
                Text('${h['member_count'] ?? 0} members',
                    style: TextStyle(fontSize: 12, color: Colors.grey[600])),
              ],
            ),
          ),
        );
      },
    );
  }

  Color? _parseColor(String? hex) {
    if (hex == null) return null;
    final c = hex.replaceAll('#', '');
    if (c.length == 6) {
      return Color(int.parse('FF$c', radix: 16));
    }
    return null;
  }
}
