import 'package:flutter/material.dart';

class ResponsiveActionGridItem {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const ResponsiveActionGridItem({
    required this.label,
    required this.icon,
    required this.color,
    this.onTap,
  });
}

class ResponsiveActionGrid extends StatelessWidget {
  final List<ResponsiveActionGridItem> items;
  final double spacing;
  final double runSpacing;
  final double childAspectRatio;

  const ResponsiveActionGrid({
    super.key,
    required this.items,
    this.spacing = 12,
    this.runSpacing = 14,
    this.childAspectRatio = 0.9,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = _gridColumns(constraints.maxWidth);
        return GridView.count(
          crossAxisCount: columns,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: runSpacing,
          crossAxisSpacing: spacing,
          childAspectRatio: childAspectRatio,
          children: items
              .map(
                (item) => _ResponsiveActionTile(item: item),
              )
              .toList(),
        );
      },
    );
  }

  int _gridColumns(double width) {
    if (width >= 620) return 5;
    if (width >= 460) return 4;
    if (width >= 320) return 3;
    return 2;
  }
}

class _ResponsiveActionTile extends StatelessWidget {
  final ResponsiveActionGridItem item;

  const _ResponsiveActionTile({required this.item});

  @override
  Widget build(BuildContext context) {
    final color = item.color;
    return InkWell(
      onTap: item.onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(
          color: color.withAlpha(14),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withAlpha(30)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withAlpha(20),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(item.icon, color: color, size: 24),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: Text(
                item.label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.onSurface,
                  height: 1.1,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
