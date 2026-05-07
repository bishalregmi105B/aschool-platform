import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/plugin_provider.dart';
import '../theme/app_theme.dart';

class DynamicBottomNav extends ConsumerWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<BottomNavItem> fixedTabs;
  final List<PluginBottomNavItem> pluginTabs;

  const DynamicBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.fixedTabs,
    required this.pluginTabs,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plugins = ref.watch(pluginProvider);

    final visiblePluginTabs =
        pluginTabs.where((tab) => plugins.isInstalled(tab.pluginSlug)).toList();

    final allTabs = [
      ...fixedTabs,
      ...visiblePluginTabs,
    ];

    // Cap to 5 maximum tabs as per standard design
    final displayTabs = allTabs.length <= 5
        ? allTabs
        : [
            ...allTabs.take(4),
            const BottomNavItem(
              icon: Icons.menu,
              label: 'Menu',
            ),
          ];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: Colors.black.withAlpha(18)),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(15),
            blurRadius: 18,
            offset: const Offset(0, -4),
          ),
        ],
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(displayTabs.length, (index) {
              final isSelected = currentIndex == index;
              final tab = displayTabs[index];

              return GestureDetector(
                onTap: () => onTap(index),
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeInOut,
                  padding: EdgeInsets.symmetric(
                    horizontal: isSelected ? 14 : 10,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? ASchoolTheme.primary.withAlpha(18)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        tab.icon,
                        color: isSelected
                            ? ASchoolTheme.primary
                            : ASchoolTheme.mutedText,
                        size: 22,
                      ),
                      if (isSelected) ...[
                        const SizedBox(width: 6),
                        Text(
                          tab.label,
                          style: TextStyle(
                            color: ASchoolTheme.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

class BottomNavItem {
  final IconData icon;
  final String label;

  const BottomNavItem({required this.icon, required this.label});
}

class PluginBottomNavItem extends BottomNavItem {
  final String pluginSlug;

  const PluginBottomNavItem({
    required super.icon,
    required super.label,
    required this.pluginSlug,
  });
}
