import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/theme_provider.dart';
import '../theme/app_theme.dart';

class AppDrawer extends ConsumerWidget {
  final String userFullName;
  final String userSubtitle;
  final String userRole;
  final List<DrawerSection> sections;
  final VoidCallback onLogout;

  const AppDrawer({
    super.key,
    required this.userFullName,
    required this.userSubtitle,
    required this.userRole,
    required this.sections,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    return Drawer(
      child: Column(
        children: [
          _DrawerHeader(
            userFullName: userFullName,
            userSubtitle: userSubtitle,
            userRole: userRole,
          ),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                for (final section in sections) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                    child: Text(
                      section.title.toUpperCase(),
                      style: const TextStyle(
                        color: ASchoolTheme.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                  for (final item in section.items) _DrawerTile(item: item),
                ],
                const Divider(height: 32),
                _ThemeModeTile(themeMode: themeMode, onSet: ref.read(themeModeProvider.notifier).setMode),
                ListTile(
                  leading: const Icon(Icons.logout_rounded, color: Colors.red),
                  title: const Text(
                    'Logout',
                    style: TextStyle(
                      color: Colors.red,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onTap: onLogout,
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class DrawerSection {
  final String title;
  final List<DrawerItemData> items;

  const DrawerSection({
    required this.title,
    required this.items,
  });
}

class DrawerItemData {
  final IconData icon;
  final String title;
  final String path;
  final bool isLocked;

  const DrawerItemData({
    required this.icon,
    required this.title,
    required this.path,
    this.isLocked = false,
  });
}

class _DrawerHeader extends StatelessWidget {
  final String userFullName;
  final String userSubtitle;
  final String userRole;

  const _DrawerHeader({
    required this.userFullName,
    required this.userSubtitle,
    required this.userRole,
  });

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(20, topInset + 24, 20, 24),
      color: ASchoolTheme.primary,
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: Colors.white,
            child: Text(
              userFullName.isNotEmpty ? userFullName[0].toUpperCase() : 'A',
              style: const TextStyle(
                color: ASchoolTheme.primary,
                fontWeight: FontWeight.bold,
                fontSize: 24,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  userFullName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$userRole • $userSubtitle',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withAlpha(210),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DrawerTile extends StatelessWidget {
  final DrawerItemData item;

  const _DrawerTile({required this.item});

  @override
  Widget build(BuildContext context) {
    final color = item.isLocked ? Colors.grey : Colors.grey.shade800;

    return ListTile(
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
      leading: Icon(
        item.isLocked ? Icons.lock_outline_rounded : item.icon,
        color: color,
      ),
      title: Text(
        item.title,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w500,
        ),
      ),
      trailing: item.isLocked
          ? null
          : const Icon(Icons.chevron_right_rounded, size: 18),
      onTap: item.isLocked
          ? null
          : () {
              Navigator.of(context).pop();
              context.go(item.path);
            },
    );
  }
}

/// Light/Dark/System switcher shown in the drawer. Cycles through the three
/// modes on tap; the icon + subtitle reflect the current choice.
class _ThemeModeTile extends StatelessWidget {
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onSet;

  const _ThemeModeTile({required this.themeMode, required this.onSet});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (icon, label) = switch (themeMode) {
      ThemeMode.light => (Icons.light_mode_rounded, 'Light'),
      ThemeMode.dark => (Icons.dark_mode_rounded, 'Dark'),
      _ => (Icons.brightness_auto_rounded, 'System'),
    };

    return ListTile(
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
      leading: Icon(icon, color: scheme.primary),
      title: Text(
        'Theme: $label',
        style: TextStyle(
          color: scheme.onSurface,
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: Text(
        'Tap to switch light / dark / system',
        style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11),
      ),
      onTap: () {
        final next = switch (themeMode) {
          ThemeMode.system => ThemeMode.light,
          ThemeMode.light => ThemeMode.dark,
          _ => ThemeMode.system,
        };
        onSet(next);
      },
    );
  }
}
