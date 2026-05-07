import 'package:flutter/material.dart';

import 'responsive_action_grid.dart';

class ModuleInsightItem {
  final String label;
  final String value;
  final IconData icon;

  const ModuleInsightItem({
    required this.label,
    required this.value,
    required this.icon,
  });
}

class ModuleActionItem {
  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  const ModuleActionItem({
    required this.label,
    required this.icon,
    this.onTap,
  });
}

class ModuleScreenTemplate extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData heroIcon;
  final Color accentColor;
  final List<ModuleInsightItem> insights;
  final List<ModuleActionItem> actions;
  final List<String> highlights;
  final Widget? floatingActionButton;

  const ModuleScreenTemplate({
    super.key,
    required this.title,
    required this.subtitle,
    required this.heroIcon,
    this.accentColor = const Color(0xFF2563EB),
    this.insights = const [],
    this.actions = const [],
    this.highlights = const [],
    this.floatingActionButton,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: floatingActionButton,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
              child: _HeroCard(
                title: title,
                subtitle: subtitle,
                heroIcon: heroIcon,
                accentColor: accentColor,
              ),
            ),
          ),
          if (insights.isNotEmpty)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 1.5,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final item = insights[index];
                    return _Staggered(
                      index: index,
                      child: _InsightCard(item: item, accentColor: accentColor),
                    );
                  },
                  childCount: insights.length,
                ),
              ),
            ),
          if (actions.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: _SectionCard(
                  title: 'Quick Actions',
                  child: ResponsiveActionGrid(
                    items: actions
                        .map(
                          (a) => ResponsiveActionGridItem(
                            label: a.label,
                            icon: a.icon,
                            color: accentColor,
                            onTap: a.onTap,
                          ),
                        )
                        .toList(),
                  ),
                ),
              ),
            ),
          if (highlights.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                child: _SectionCard(
                  title: 'Workflow Highlights',
                  child: Column(
                    children: highlights
                        .asMap()
                        .entries
                        .map(
                          (entry) => ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            leading: CircleAvatar(
                              radius: 14,
                              backgroundColor: accentColor.withAlpha(26),
                              child: Text(
                                '${entry.key + 1}',
                                style: TextStyle(
                                  color: accentColor,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            title: Text(entry.value),
                          ),
                        )
                        .toList(),
                  ),
                ),
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData heroIcon;
  final Color accentColor;

  const _HeroCard({
    required this.title,
    required this.subtitle,
    required this.heroIcon,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, (1 - value) * 20),
            child: child,
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              accentColor,
              Color.lerp(accentColor, Colors.black, 0.16)!,
            ],
          ),
          boxShadow: [
            BoxShadow(
              color: accentColor.withAlpha(58),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(36),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(heroIcon, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InsightCard extends StatelessWidget {
  final ModuleInsightItem item;
  final Color accentColor;

  const _InsightCard({required this.item, required this.accentColor});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.black.withAlpha(14)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(item.icon, size: 18, color: accentColor),
          const Spacer(),
          Text(
            item.value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 2),
          Text(item.label,
              style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;

  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.black.withAlpha(14)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _Staggered extends StatelessWidget {
  final int index;
  final Widget child;

  const _Staggered({required this.index, required this.child});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 320 + (index * 70)),
      curve: Curves.easeOutCubic,
      builder: (context, value, built) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, (1 - value) * 12),
            child: built,
          ),
        );
      },
      child: child,
    );
  }
}
