import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class SearchBarWidget extends StatelessWidget {
  final String hintText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onFilterTap;
  final TextEditingController? controller;

  const SearchBarWidget({
    super.key,
    this.hintText = 'Search...',
    this.onChanged,
    this.onFilterTap,
    this.controller,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      height: 50,
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(25),
        border: isDark ? Border.all(color: ASchoolTheme.darkBorder) : null,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(isDark ? 60 : 10),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 8),
            child: Icon(Icons.search, color: theme.colorScheme.onSurfaceVariant),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              style: TextStyle(color: theme.colorScheme.onSurface),
              decoration: InputDecoration(
                hintText: hintText,
                hintStyle: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                border: InputBorder.none,
                isDense: true,
              ),
            ),
          ),
          if (onFilterTap != null)
            IconButton(
              icon: Icon(Icons.tune, color: theme.colorScheme.onSurfaceVariant),
              onPressed: onFilterTap,
            ),
        ],
      ),
    );
  }
}
