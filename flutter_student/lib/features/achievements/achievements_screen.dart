import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Achievements — Badges, points, leaderboard
class AchievementsScreen extends ConsumerStatefulWidget {
  const AchievementsScreen({super.key});

  @override
  ConsumerState<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends ConsumerState<AchievementsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/student/achievements');
      final payload = res.data;
      setState(() {
        _data = payload is Map<String, dynamic>
            ? (payload['data'] as Map?)?.cast<String, dynamic>() ?? payload
            : null;
      });
    } catch (_) {}
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
      pluginSlug: 'student_portfolio',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Achievements'),
        body: Column(
          children: [
            // Points summary
            if (_data != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      theme.colorScheme.primary,
                      theme.colorScheme.primary.withAlpha(180),
                    ],
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _PointsStat(
                      label: 'Total Points',
                      value: '${_data?['total_points'] ?? 0}',
                      icon: Icons.star,
                    ),
                    Container(width: 1, height: 40, color: Colors.white24),
                    _PointsStat(
                      label: 'Rank',
                      value: '#${_data?['rank'] ?? '--'}',
                      icon: Icons.leaderboard,
                    ),
                    Container(width: 1, height: 40, color: Colors.white24),
                    _PointsStat(
                      label: 'Badges',
                      value: '${(_data?['badges'] as List?)?.length ?? 0}',
                      icon: Icons.military_tech,
                    ),
                  ],
                ),
              ),

            TabBar(
              controller: _tabController,
              tabs: const [
                Tab(text: 'Badges'),
                Tab(text: 'Leaderboard'),
                Tab(text: 'History'),
              ],
            ),

            Expanded(
              child: _loading
                  ? const LoadingShimmer()
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _buildBadges(),
                        _buildLeaderboard(),
                        _buildHistory(),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBadges() {
    final badges = (_data?['badges'] as List?) ?? [];
    final lockedBadges = (_data?['locked_badges'] as List?) ?? [];

    if (badges.isEmpty && lockedBadges.isEmpty) {
      return const Center(child: Text('No badges yet. Keep going! 💪'));
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (badges.isNotEmpty) ...[
            Text('Earned',
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: badges.map<Widget>((badge) {
                return _BadgeWidget(
                  emoji: badge['emoji'] ?? '🏅',
                  name: badge['name'] ?? '',
                  description: badge['description'] ?? '',
                  earned: true,
                );
              }).toList(),
            ),
          ],
          if (lockedBadges.isNotEmpty) ...[
            const SizedBox(height: 24),
            Text('Locked',
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: lockedBadges.map<Widget>((badge) {
                return _BadgeWidget(
                  emoji: badge['emoji'] ?? '🔒',
                  name: badge['name'] ?? '',
                  description: badge['requirement'] ?? '',
                  earned: false,
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLeaderboard() {
    final leaderboard = (_data?['leaderboard'] as List?) ?? [];

    if (leaderboard.isEmpty) {
      return const NoDataContainer(
        title: 'Leaderboard not available',
        subtitle: 'Class rankings will appear once points are published.',
        icon: Icons.leaderboard_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: leaderboard.length,
        itemBuilder: (context, index) {
          final entry = leaderboard[index];
          final rank = index + 1;
          final isMe = entry['is_me'] == true;

          return Card(
            margin: const EdgeInsets.only(bottom: 6),
            color: isMe
                ? Theme.of(context).colorScheme.primaryContainer.withAlpha(80)
                : null,
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: rank <= 3
                    ? [
                        Colors.amber,
                        Colors.grey[300]!,
                        Colors.brown[300]!
                      ][rank - 1]
                        .withAlpha(50)
                    : Colors.grey[100],
                child: Text(
                  rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : '$rank',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: rank <= 3 ? 20 : 14,
                  ),
                ),
              ),
              title: Text(
                entry['name'] ?? '',
                style: TextStyle(
                  fontWeight: isMe ? FontWeight.bold : FontWeight.w500,
                ),
              ),
              subtitle: Text(entry['class_name'] ?? '',
                  style: const TextStyle(fontSize: 12)),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.star, color: Colors.amber, size: 16),
                  const SizedBox(width: 4),
                  Text('${entry['points'] ?? 0}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHistory() {
    final history = (_data?['history'] as List?) ?? [];

    if (history.isEmpty) {
      return const NoDataContainer(
        title: 'No activity yet',
        subtitle: 'Your points and badge activity timeline will appear here.',
        icon: Icons.history_rounded,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: history.length,
        itemBuilder: (context, index) {
          final item = history[index];
          final points = (item['points'] as int?) ?? 0;
          final positive = points >= 0;

          return Card(
            margin: const EdgeInsets.only(bottom: 6),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor:
                    (positive ? Colors.green : Colors.red).withAlpha(25),
                child: Icon(
                  positive ? Icons.add : Icons.remove,
                  color: positive ? Colors.green : Colors.red,
                  size: 20,
                ),
              ),
              title: Text(item['description'] ?? ''),
              subtitle: Text(item['date'] ?? '',
                  style: const TextStyle(fontSize: 12)),
              trailing: Text(
                '${positive ? '+' : ''}$points pts',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: positive ? Colors.green : Colors.red,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _PointsStat extends StatelessWidget {
  final String label, value;
  final IconData icon;
  const _PointsStat(
      {required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: Colors.white, size: 22),
        const SizedBox(height: 4),
        Text(value,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold)),
        Text(label,
            style: const TextStyle(color: Colors.white70, fontSize: 11)),
      ],
    );
  }
}

class _BadgeWidget extends StatelessWidget {
  final String emoji, name, description;
  final bool earned;
  const _BadgeWidget(
      {required this.emoji,
      required this.name,
      required this.description,
      required this.earned});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 100,
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: earned
                  ? Colors.amber.withAlpha(30)
                  : Colors.grey.withAlpha(20),
              borderRadius: BorderRadius.circular(16),
              border: earned
                  ? Border.all(color: Colors.amber.withAlpha(100))
                  : null,
            ),
            child: Center(
              child: Text(
                emoji,
                style: TextStyle(
                  fontSize: 32,
                  color: earned ? null : Colors.grey,
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(name,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: earned ? null : Colors.grey,
              ),
              textAlign: TextAlign.center),
          Text(description,
              style: TextStyle(fontSize: 10, color: Colors.grey[500]),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}
