import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../providers/parent_providers.dart';

class ParentShellScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const ParentShellScreen({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;
    final plugins = ref.watch(pluginProvider);
    final user = ref.watch(authProvider).user;
    final drawerSections = _buildDrawerSections(plugins);

    return Scaffold(
      appBar: CustomAppBar(
        title: _titleFor(location),
        subtitle: 'Parent Portal',
        showBackButton: false,
        actions: [
          const _ChildSwitcher(),
          NotificationBell(
            tooltip: 'Notifications',
            onTap: () => context.push('/notifications'),
          ),
        ],
      ),
      body: navigationShell,
      bottomNavigationBar: DynamicBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        fixedTabs: const [
          BottomNavItem(icon: Icons.home_rounded, label: 'Home'),
          BottomNavItem(icon: Icons.fact_check_rounded, label: 'Attendance'),
          BottomNavItem(icon: Icons.payment_rounded, label: 'Fees'),
          BottomNavItem(icon: Icons.assessment_rounded, label: 'Results'),
        ],
        pluginTabs: const [],
      ),
      drawer: AppDrawer(
        userFullName: user?.fullName ?? 'Parent',
        userSubtitle: user?.phone ?? '',
        userRole: 'Parent',
        sections: drawerSections,
        onLogout: () {
          Navigator.of(context).pop();
          ref.read(authProvider.notifier).logout();
        },
      ),
    );
  }

  String _titleFor(String loc) {
    switch (loc) {
      case '/dashboard':
        return 'Home';
      case '/attendance':
        return 'Attendance';
      case '/fees':
        return 'Fee Payment';
      case '/results':
        return 'Results';
      case '/reports':
        return 'Reports';
      case '/timetable':
        return 'Timetable';
      case '/subjects':
        return 'Subjects';
      case '/teachers':
        return 'Teachers';
      case '/homework':
        return 'Homework';
      case '/holidays':
        return 'Holidays';
      case '/gallery':
        return 'Gallery';
      case '/bus-tracker':
        return 'Bus Tracker';
      case '/chat':
        return 'Chat';
      case '/notices':
        return 'Notices';
      case '/wellbeing':
        return 'Wellbeing';
      case '/elibrary':
        return 'Digital Library';
      case '/portfolio':
        return "Child's Portfolio";
      default:
        return 'ASchool';
    }
  }

  List<DrawerSection> _buildDrawerSections(PluginState plugins) {
    final sections = <DrawerSection>[];

    void addSection(String title, List<_ParentDrawerItem> items) {
      final visible = items
          .where((item) => item.isVisible(plugins))
          .map(
            (item) => DrawerItemData(
              icon: item.icon,
              title: item.title,
              path: item.path,
            ),
          )
          .toList();
      if (visible.isEmpty) return;
      sections.add(DrawerSection(title: title, items: visible));
    }

    addSection('Overview', const [
      _ParentDrawerItem(
          icon: Icons.home_rounded,
          title: 'Dashboard',
          path: '/dashboard',
          moduleKey: 'dashboard'),
      _ParentDrawerItem(
          icon: Icons.fact_check_rounded,
          title: 'Attendance',
          path: '/attendance',
          moduleKey: 'attendance'),
      _ParentDrawerItem(
          icon: Icons.payment_rounded,
          title: 'Fee Payment',
          path: '/fees',
          moduleKey: 'fees',
          pluginSlug: 'fees'),
      _ParentDrawerItem(
          icon: Icons.assessment_rounded,
          title: 'Results',
          path: '/results',
          moduleKey: 'results'),
      _ParentDrawerItem(
          icon: Icons.bar_chart_rounded,
          title: 'Reports',
          path: '/reports',
          moduleKey: 'reports',
          pluginSlug: 'exams'),
    ]);

    addSection('Academics', const [
      _ParentDrawerItem(
          icon: Icons.assignment_rounded,
          title: 'Homework',
          path: '/homework',
          moduleKey: 'homework'),
      _ParentDrawerItem(
          icon: Icons.schedule_rounded,
          title: 'Timetable',
          path: '/timetable',
          moduleKey: 'timetable'),
      _ParentDrawerItem(
          icon: Icons.subject_rounded,
          title: 'Subjects',
          path: '/subjects',
          moduleKey: 'subjects'),
      _ParentDrawerItem(
          icon: Icons.person_rounded,
          title: 'Teachers',
          path: '/teachers',
          moduleKey: 'teachers'),
    ]);

    addSection('School Info', const [
      _ParentDrawerItem(
          icon: Icons.campaign_rounded,
          title: 'Notices',
          path: '/notices',
          moduleKey: 'notices'),
      _ParentDrawerItem(
          icon: Icons.beach_access_rounded,
          title: 'Holidays',
          path: '/holidays',
          moduleKey: 'holidays'),
      _ParentDrawerItem(
          icon: Icons.photo_library_rounded,
          title: 'Gallery',
          path: '/gallery',
          moduleKey: 'gallery'),
      _ParentDrawerItem(
          icon: Icons.chat_rounded,
          title: 'Chat',
          path: '/chat',
          moduleKey: 'chat'),
    ]);

    addSection('Others', const [
      _ParentDrawerItem(
          icon: Icons.directions_bus_rounded,
          title: 'Bus Tracker',
          path: '/bus-tracker',
          moduleKey: 'bus_tracker',
          customVisible: _busTrackingVisible),
      _ParentDrawerItem(
          icon: Icons.favorite_rounded,
          title: 'Wellbeing',
          path: '/wellbeing',
          moduleKey: 'wellbeing',
          pluginSlug: 'wellbeing'),
      _ParentDrawerItem(
          icon: Icons.library_books_rounded,
          title: 'Digital Library',
          path: '/elibrary',
          moduleKey: 'elibrary',
          pluginSlug: 'elibrary'),
      _ParentDrawerItem(
          icon: Icons.folder_special_rounded,
          title: "Child's Portfolio",
          path: '/portfolio',
          moduleKey: 'portfolio',
          pluginSlug: 'student_portfolio'),
    ]);

    return sections;
  }

  static bool _busTrackingVisible(PluginState plugins) {
    return plugins.isInstalled('bus_tracking') ||
        plugins.isInstalled('gps_tracking');
  }
}

class _ParentDrawerItem {
  final IconData icon;
  final String title;
  final String path;
  final String moduleKey;
  final String? pluginSlug;
  final bool Function(PluginState plugins)? customVisible;

  const _ParentDrawerItem({
    required this.icon,
    required this.title,
    required this.path,
    required this.moduleKey,
    this.pluginSlug,
    this.customVisible,
  });

  bool isVisible(PluginState plugins) {
    if (!plugins.isModuleVisible(moduleKey)) {
      return false;
    }
    if (pluginSlug != null && !plugins.isInstalled(pluginSlug!)) {
      return false;
    }
    if (customVisible != null && !customVisible!(plugins)) {
      return false;
    }
    return true;
  }
}

class _ChildSwitcher extends ConsumerWidget {
  const _ChildSwitcher();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardState = ref.watch(parentDashboardProvider);
    final selectedChild = ref.watch(selectedChildProvider);

    return dashboardState.maybeWhen(
      data: (dashboard) {
        if (dashboard.children.isEmpty) return const SizedBox.shrink();

        final selectedId =
            selectedChild == null ? null : _childId(selectedChild);
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: PopupMenuButton<String>(
            tooltip: 'Switch child',
            initialValue: selectedId,
            onSelected: (value) {
              ref.read(selectedChildIdProvider.notifier).state = value;
            },
            itemBuilder: (context) => [
              for (final child in dashboard.children)
                CheckedPopupMenuItem<String>(
                  value: _childId(child),
                  checked: _childId(child) == selectedId,
                  child: Text(_childName(child)),
                ),
            ],
            child: Container(
              constraints: const BoxConstraints(maxWidth: 156),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(36),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.child_care_rounded,
                      size: 18, color: Colors.white),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      _childName(selectedChild ?? dashboard.children.first),
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Icon(Icons.expand_more_rounded,
                      size: 16, color: Colors.white),
                ],
              ),
            ),
          ),
        );
      },
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(horizontal: 12),
        child: SizedBox(
          height: 18,
          width: 18,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
          ),
        ),
      ),
      orElse: () => IconButton(
        icon: const Icon(Icons.refresh_rounded),
        tooltip: 'Reload children',
        onPressed: () => ref.invalidate(parentDashboardProvider),
      ),
    );
  }

  String _childName(Map<String, dynamic> child) {
    final name = child['name']?.toString();
    if (name != null && name.isNotEmpty) return name;
    return 'Child';
  }

  String _childId(Map<String, dynamic> child) =>
      (child['student_id'] ?? child['id']).toString();
}
