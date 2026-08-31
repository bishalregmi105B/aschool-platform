import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class ESchoolCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry margin;
  final Color? color;

  const ESchoolCard({
    super.key,
    required this.child,
    this.padding,
    this.margin = EdgeInsets.zero,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding ?? const EdgeInsets.all(14),
      decoration: ASchoolTheme.elevatedBox(
        color: color ?? Theme.of(context).cardColor,
        borderColor: Theme.of(context).brightness == Brightness.dark
            ? ASchoolTheme.darkBorder
            : null,
      ),
      child: child,
    );
  }
}

class ESchoolSectionTitle extends StatelessWidget {
  final String title;
  final Widget? trailing;

  const ESchoolSectionTitle({
    super.key,
    required this.title,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: ASchoolTheme.secondary,
              ),
        ),
        const Spacer(),
        if (trailing != null) trailing!,
      ],
    );
  }
}

class ESchoolInfoPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;

  const ESchoolInfoPill({
    super.key,
    required this.icon,
    required this.label,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final resolvedColor = color ?? ASchoolTheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: resolvedColor.withAlpha(16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: resolvedColor),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: resolvedColor,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class ESchoolAnimatedEntry extends StatelessWidget {
  final int index;
  final Widget child;

  const ESchoolAnimatedEntry({
    super.key,
    required this.index,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 260 + ((index % 10) * 60)),
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
