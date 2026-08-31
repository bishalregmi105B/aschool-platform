import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

class StudentShellScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const StudentShellScreen({super.key, required this.navigationShell});

  static const _fixedTabs = [
    BottomNavItem(icon: Icons.dashboard_rounded, label: 'Home'),
    BottomNavItem(icon: Icons.schedule_rounded, label: 'Timetable'),
    BottomNavItem(icon: Icons.assignment_rounded, label: 'Homework'),
    BottomNavItem(icon: Icons.emoji_events_rounded, label: 'Results'),
  ];

  static const _drawerSections = [
    _DrawerSection(null, [
      _Tab(
          icon: Icons.dashboard_rounded,
          label: 'Dashboard',
          path: '/dashboard',
          moduleKey: 'dashboard'),
      _Tab(
          icon: Icons.person_rounded,
          label: 'My Profile',
          path: '/dashboard/profile',
          moduleKey: 'profile'),
      _Tab(
          icon: Icons.subject_rounded,
          label: 'My Subjects',
          path: '/dashboard/subjects',
          moduleKey: 'subjects'),
      _Tab(
          icon: Icons.assignment_rounded,
          label: 'Assignments',
          path: '/homework',
          moduleKey: 'homework'),
    ]),
    _DrawerSection(null, [
      _Tab(
          icon: Icons.schedule_rounded,
          label: 'Timetable',
          path: '/timetable',
          moduleKey: 'timetable'),
      _Tab(
          icon: Icons.campaign_rounded,
          label: 'Noticeboard',
          path: '/dashboard/notices',
          moduleKey: 'notices'),
      _Tab(
          icon: Icons.quiz_rounded,
          label: 'Exams',
          path: '/dashboard/exams',
          moduleKey: 'exams',
          pluginSlug: 'exams'),
      _Tab(
          icon: Icons.emoji_events_rounded,
          label: 'Result',
          path: '/results',
          moduleKey: 'results'),
      _Tab(
          icon: Icons.menu_book_rounded,
          label: 'My Diary',
          path: '/dashboard/diary',
          moduleKey: 'diary'),
    ]),
    _DrawerSection(null, [
      _Tab(
          icon: Icons.directions_bus_rounded,
          label: 'Transportation',
          path: '/dashboard/transport',
          moduleKey: 'transport'),
      _Tab(
          icon: Icons.person_rounded,
          label: 'Teachers',
          path: '/dashboard/teachers',
          moduleKey: 'teachers'),
      _Tab(
          icon: Icons.forum_rounded,
          label: 'Chat',
          path: '/dashboard/chat',
          moduleKey: 'chat'),
      _Tab(
          icon: Icons.beach_access_rounded,
          label: 'Holiday',
          path: '/dashboard/holidays',
          moduleKey: 'holidays'),
      _Tab(
          icon: Icons.photo_library_rounded,
          label: 'Gallery',
          path: '/dashboard/gallery',
          moduleKey: 'gallery'),
      _Tab(
          icon: Icons.family_restroom_rounded,
          label: 'Guardian Details',
          path: '/dashboard/guardians',
          moduleKey: 'guardians'),
    ]),
    _DrawerSection('Library & Learning', [
      _Tab(
          icon: Icons.local_library_rounded,
          label: 'Library',
          path: '/dashboard/library',
          moduleKey: 'library',
          pluginSlug: 'library_management'),
      _Tab(
          icon: Icons.menu_book_rounded,
          label: 'E-Library',
          path: '/dashboard/elibrary',
          moduleKey: 'elibrary',
          pluginSlug: 'elibrary'),
      _Tab(
          icon: Icons.play_circle_fill_rounded,
          label: 'LMS Courses',
          path: '/dashboard/lms',
          moduleKey: 'lms',
          pluginSlug: 'lms'),
    ]),
    _DrawerSection('Others', [
      _Tab(
          icon: Icons.smart_toy_rounded,
          label: 'AI Tutor',
          path: '/dashboard/ai-tutor',
          moduleKey: 'ai_tutor',
          pluginSlug: 'ai_tutor'),
      _Tab(
          icon: Icons.people_rounded,
          label: 'My Class',
          path: '/dashboard/classmates',
          moduleKey: 'classmates'),
      _Tab(
          icon: Icons.folder_special_rounded,
          label: 'My Portfolio',
          path: '/dashboard/portfolio',
          moduleKey: 'portfolio',
          pluginSlug: 'student_portfolio'),
      _Tab(
          icon: Icons.star_rounded,
          label: 'Achievements',
          path: '/dashboard/achievements',
          moduleKey: 'achievements',
          pluginSlug: 'student_portfolio'),
      _Tab(
          icon: Icons.favorite_rounded,
          label: 'Wellbeing',
          path: '/dashboard/wellbeing',
          moduleKey: 'wellbeing',
          pluginSlug: 'wellbeing'),
      _Tab(
          icon: Icons.event_available_rounded,
          label: 'Attendance',
          path: '/dashboard/attendance',
          moduleKey: 'attendance',
          pluginSlug: 'attendance'),
      _Tab(
          icon: Icons.health_and_safety_rounded,
          label: 'Health Records',
          path: '/dashboard/health',
          moduleKey: 'health',
          pluginSlug: 'health_records'),
      _Tab(
          icon: Icons.military_tech_rounded,
          label: 'Points & Badges',
          path: '/dashboard/gamification',
          moduleKey: 'gamification',
          pluginSlug: 'gamification'),
      _Tab(
          icon: Icons.receipt_long_rounded,
          label: 'My Fees',
          path: '/dashboard/fees',
          moduleKey: 'fees',
          pluginSlug: 'fees'),
    ]),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final user = ref.watch(authProvider).user;
    final plugins = ref.watch(pluginProvider);

    return Scaffold(
      drawer: Drawer(
        child: Column(
          children: [
            Container(
              padding: EdgeInsets.only(
                  top: MediaQuery.of(context).padding.top + 20,
                  bottom: 20,
                  left: 20,
                  right: 20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    theme.colorScheme.primary,
                    theme.colorScheme.primary.withAlpha(200),
                  ],
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: theme.colorScheme.onPrimary, width: 2),
                      color: theme.colorScheme.primaryContainer,
                      image: user?.avatarUrl != null
                          ? DecorationImage(
                              image: NetworkImage(user!.avatarUrl!),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    child: user?.avatarUrl == null
                        ? Center(
                            child: Text(
                              (user?.fullName.isNotEmpty ?? false)
                                  ? user!.fullName[0].toUpperCase()
                                  : 'S',
                              style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: theme.colorScheme.primary),
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.fullName ?? 'Student',
                          style: TextStyle(
                            color: theme.colorScheme.onPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (user?.email != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            user!.email!,
                            style: TextStyle(
                              color: theme.colorScheme.onPrimary.withAlpha(200),
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  for (final section in _drawerSections)
                    ..._buildVisibleSection(
                      context,
                      section,
                      plugins,
                      theme,
                    ),
                  const Divider(),
                  ListTile(
                    leading:
                        const Icon(Icons.logout_rounded, color: Colors.red),
                    title: const Text('Logout',
                        style: TextStyle(
                            color: Colors.red, fontWeight: FontWeight.w600)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 24),
                    onTap: () {
                      ref.read(authProvider.notifier).logout();
                      context.go('/login');
                    },
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ],
        ),
      ),
      body: navigationShell,
      bottomNavigationBar: DynamicBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: (index) {
          if (index == 4) {
            // Open drawer if "Menu" is tapped (capped at 5 tabs)
            Scaffold.of(context).openDrawer();
          } else {
            navigationShell.goBranch(
              index,
              initialLocation: index == navigationShell.currentIndex,
            );
          }
        },
        fixedTabs: _fixedTabs,
        pluginTabs: const [], // No plugin tabs configured for student nav right now
      ),
    );
  }

  List<Widget> _buildVisibleSection(
    BuildContext context,
    _DrawerSection section,
    PluginState plugins,
    ThemeData theme,
  ) {
    final visibleItems = section.items
        .where((item) => _isVisible(item, plugins))
        .toList(growable: false);
    if (visibleItems.isEmpty) return const [];

    final widgets = <Widget>[];
    if (section.header != null) {
      widgets.add(
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
          child: Text(
            section.header!.toUpperCase(),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: theme.colorScheme.primary,
              letterSpacing: 1.2,
            ),
          ),
        ),
      );
    }

    widgets.addAll(
      visibleItems.map((item) => _buildDrawerItem(context, item)),
    );
    widgets.add(const SizedBox(height: 8));
    return widgets;
  }

  bool _isVisible(_Tab item, PluginState plugins) {
    if (!plugins.isModuleVisible(item.moduleKey)) {
      return false;
    }
    if (item.pluginSlug != null && !plugins.isInstalled(item.pluginSlug!)) {
      return false;
    }
    return true;
  }

  Widget _buildDrawerItem(BuildContext context, _Tab item) {
    final location = GoRouterState.of(context).matchedLocation;
    final selected = location.startsWith(item.path);
    final theme = Theme.of(context);
    final primaryColor = theme.colorScheme.primary;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      child: ListTile(
        dense: true,
        visualDensity: const VisualDensity(vertical: -2),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
        leading: Icon(
          item.icon,
          size: 22,
          color: selected
                ? primaryColor
                : theme.colorScheme.onSurfaceVariant,
        ),
        title: Text(
          item.label,
          style: TextStyle(
            fontSize: 14,
            color: selected
                ? primaryColor
                : theme.colorScheme.onSurface,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        selected: selected,
        selectedTileColor: primaryColor.withAlpha(20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        onTap: () {
          Navigator.pop(context); // Close drawer
          context.go(item.path);
        },
      ),
    );
  }
}

class _Tab {
  final IconData icon;
  final String label;
  final String path;
  final String moduleKey;
  final String? pluginSlug;
  const _Tab(
      {required this.icon,
      required this.label,
      required this.path,
      required this.moduleKey,
      this.pluginSlug});
}

class _DrawerSection {
  final String? header;
  final List<_Tab> items;
  const _DrawerSection(this.header, this.items);
}
