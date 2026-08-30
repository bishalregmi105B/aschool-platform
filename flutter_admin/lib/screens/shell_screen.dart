import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ShellScreen extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const ShellScreen({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;
    final plugins = ref.watch(pluginProvider);
    final location = GoRouterState.of(context).matchedLocation;
    final useLocalAppBar = _usesLocalAppBar(location);

    return Scaffold(
      appBar: useLocalAppBar
          ? null
          : AppBar(
              title: Text(_titleFor(location,
                  fallback: user?.schoolName ?? 'ASchool Admin')),
              actions: [
                NotificationBell(
                  tooltip: 'Notifications',
                  onTap: () => context.push('/notifications'),
                ),
                IconButton(
                  icon: const Icon(Icons.storefront_rounded),
                  tooltip: 'Marketplace',
                  onPressed: () => context.go('/marketplace'),
                ),
                const SizedBox(width: 8),
              ],
            ),
      drawer: AppDrawer(
        userFullName: user?.fullName ?? 'Admin',
        userSubtitle: user?.email ?? user?.phone ?? '',
        userRole: 'Admin',
        sections: _drawerSections(plugins),
        onLogout: () {
          Navigator.of(context).pop();
          ref.read(authProvider.notifier).logout();
          context.go('/login');
        },
      ),
      body: navigationShell,
      bottomNavigationBar: DynamicBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        fixedTabs: const [
          BottomNavItem(icon: Icons.dashboard_rounded, label: 'Home'),
          BottomNavItem(icon: Icons.groups_rounded, label: 'People'),
          BottomNavItem(icon: Icons.fact_check_rounded, label: 'Attendance'),
          BottomNavItem(icon: Icons.payments_rounded, label: 'Fees'),
          BottomNavItem(icon: Icons.menu_rounded, label: 'More'),
        ],
        pluginTabs: const [],
      ),
    );
  }

  List<DrawerSection> _drawerSections(PluginState plugins) {
    return [
      const DrawerSection(
        title: 'Academic Management',
        items: [
          DrawerItemData(
              icon: Icons.dashboard_rounded,
              title: 'Dashboard',
              path: '/dashboard'),
          DrawerItemData(
              icon: Icons.people_rounded, title: 'Students', path: '/students'),
          DrawerItemData(
              icon: Icons.family_restroom_rounded,
              title: 'Guardians',
              path: '/guardians'),
          DrawerItemData(
              icon: Icons.trending_up_rounded,
              title: 'Promote Students',
              path: '/promote'),
          DrawerItemData(
              icon: Icons.supervisor_account_rounded,
              title: 'Teachers',
              path: '/teachers'),
          DrawerItemData(
              icon: Icons.link_rounded,
              title: 'Class Subjects',
              path: '/class-subjects'),
          DrawerItemData(
              icon: Icons.groups_rounded,
              title: 'Section & Teachers',
              path: '/class-sections'),
        ],
      ),
      DrawerSection(
        title: 'Timetable & Attendance',
        items: [
          DrawerItemData(
            icon: Icons.schedule_rounded,
            title: 'Timetable',
            path: '/timetable',
            isLocked: !plugins.isInstalled('timetable'),
          ),
          DrawerItemData(
            icon: Icons.fact_check_rounded,
            title: 'View Attendance',
            path: '/attendance',
            isLocked: !plugins.isInstalled('attendance'),
          ),
          const DrawerItemData(
              icon: Icons.beach_access_rounded,
              title: 'Holiday List',
              path: '/holidays'),
        ],
      ),
      DrawerSection(
        title: 'Exam & Performance',
        items: [
          DrawerItemData(
            icon: Icons.assignment_rounded,
            title: 'Assignments',
            path: '/assignments',
            isLocked: !plugins.isInstalled('assignments'),
          ),
          DrawerItemData(
            icon: Icons.quiz_rounded,
            title: 'Exams',
            path: '/exams',
            isLocked: !plugins.isInstalled('exams'),
          ),
          DrawerItemData(
            icon: Icons.assessment_rounded,
            title: 'Exam Results',
            path: '/exam-results',
            isLocked: !plugins.isInstalled('exams'),
          ),
        ],
      ),
      DrawerSection(
        title: 'Communication & Media',
        items: [
          DrawerItemData(
            icon: Icons.notifications_rounded,
            title: 'Notices',
            path: '/notices',
            isLocked: !plugins.isInstalled('notices'),
          ),
          const DrawerItemData(
              icon: Icons.campaign_rounded,
              title: 'Announcements',
              path: '/announcements'),
          const DrawerItemData(
              icon: Icons.photo_library_rounded,
              title: 'Gallery',
              path: '/gallery'),
          const DrawerItemData(
              icon: Icons.forum_rounded, title: 'Chat', path: '/chat'),
        ],
      ),
      DrawerSection(
        title: 'Operations',
        items: [
          const DrawerItemData(
              icon: Icons.business_center_rounded,
              title: 'HR & Payroll',
              path: '/hr'),
          DrawerItemData(
            icon: Icons.payments_rounded,
            title: 'Fees',
            path: '/fees',
            isLocked: !plugins.isInstalled('fees'),
          ),
          DrawerItemData(
            icon: Icons.directions_bus_rounded,
            title: 'Transport',
            path: '/transport',
            isLocked: !plugins.isInstalled('gps_tracking'),
          ),
          const DrawerItemData(
              icon: Icons.card_membership_rounded,
              title: 'Certificates & IDs',
              path: '/certificates'),
        ],
      ),
      DrawerSection(
        title: 'Reports & Analytics',
        items: [
          DrawerItemData(
            icon: Icons.bar_chart_rounded,
            title: 'Reports',
            path: '/reports',
            isLocked: !plugins.isInstalled('basic_reports'),
          ),
          DrawerItemData(
            icon: Icons.analytics_rounded,
            title: 'Analytics',
            path: '/analytics',
            isLocked: !plugins.isInstalled('basic_reports'),
          ),
        ],
      ),
      DrawerSection(
        title: 'Learning & Library',
        items: [
          DrawerItemData(
            icon: Icons.play_circle_outline_rounded,
            title: 'LMS',
            path: '/lms',
            isLocked: !plugins.isInstalled('lms'),
          ),
          DrawerItemData(
            icon: Icons.local_library_rounded,
            title: 'Library',
            path: '/library',
            isLocked: !plugins.isInstalled('library'),
          ),
        ],
      ),
      DrawerSection(
        title: 'Student Wellbeing',
        items: [
          DrawerItemData(
            icon: Icons.sentiment_satisfied_alt_rounded,
            title: 'Wellbeing',
            path: '/wellbeing',
            isLocked: !plugins.isInstalled('wellbeing'),
          ),
          DrawerItemData(
            icon: Icons.favorite_rounded,
            title: 'Health Records',
            path: '/health-records',
            isLocked: !plugins.isInstalled('health_records'),
          ),
          DrawerItemData(
            icon: Icons.emoji_events_rounded,
            title: 'Gamification',
            path: '/gamification',
            isLocked: !plugins.isInstalled('gamification'),
          ),
        ],
      ),
      DrawerSection(
        title: 'Operations',
        items: [
          DrawerItemData(
            icon: Icons.badge_rounded,
            title: 'Visitors',
            path: '/visitors',
            isLocked: !plugins.isInstalled('visitor_management'),
          ),
          DrawerItemData(
            icon: Icons.inventory_2_rounded,
            title: 'Inventory',
            path: '/inventory',
            isLocked: !plugins.isInstalled('inventory'),
          ),
        ],
      ),
      DrawerSection(
        title: 'Growth',
        items: [
          DrawerItemData(
            icon: Icons.description_rounded,
            title: 'Admission',
            path: '/admission',
            isLocked: !plugins.isInstalled('admission'),
          ),
          DrawerItemData(
            icon: Icons.school_rounded,
            title: 'Alumni',
            path: '/alumni',
            isLocked: !plugins.isInstalled('alumni'),
          ),
          DrawerItemData(
            icon: Icons.hub_rounded,
            title: 'Social Hub',
            path: '/social-hub',
            isLocked: !plugins.isInstalled('social_hub'),
          ),
        ],
      ),
      DrawerSection(
        title: 'Design & Compliance',
        items: [
          DrawerItemData(
            icon: Icons.palette_rounded,
            title: 'Design Studio',
            path: '/design-studio',
            isLocked: !plugins.isInstalled('design_studio'),
          ),
          DrawerItemData(
            icon: Icons.auto_awesome_rounded,
            title: 'AI Tools',
            path: '/ai-tools',
            isLocked: !plugins.isInstalled('ai_insights'),
          ),
          DrawerItemData(
            icon: Icons.report_problem_rounded,
            title: 'Incidents',
            path: '/incidents',
            isLocked: !plugins.isInstalled('incidents'),
          ),
          DrawerItemData(
            icon: Icons.gavel_rounded,
            title: 'Compliance',
            path: '/compliance',
            isLocked: !plugins.isInstalled('compliance'),
          ),
          const DrawerItemData(
              icon: Icons.storefront_rounded,
              title: 'Marketplace',
              path: '/marketplace'),
          const DrawerItemData(
              icon: Icons.settings_rounded,
              title: 'Settings',
              path: '/settings'),
        ],
      ),
    ];
  }

  String _titleFor(String loc, {required String fallback}) {
    switch (loc) {
      case '/dashboard':
        return fallback;
      case '/students':
        return 'Students';
      case '/guardians':
        return 'Guardians';
      case '/promote':
        return 'Promote Students';
      case '/teachers':
        return 'Teachers';
      case '/class-subjects':
        return 'Class Subjects';
      case '/class-sections':
        return 'Section & Teachers';
      case '/timetable':
        return 'Timetable';
      case '/attendance':
        return 'Attendance';
      case '/holidays':
        return 'Holiday List';
      case '/assignments':
        return 'Assignments';
      case '/exams':
        return 'Exams';
      case '/notices':
        return 'Notices';
      case '/announcements':
        return 'Announcements';
      case '/gallery':
        return 'Gallery';
      case '/chat':
        return 'Chat';
      case '/hr':
        return 'HR & Payroll';
      case '/fees':
        return 'Fees';
      case '/transport':
        return 'Transport';
      case '/certificates':
        return 'Certificates & IDs';
      case '/reports':
        return 'Reports';
      case '/analytics':
        return 'Analytics';
      case '/social-hub':
        return 'Social Hub';
      case '/library':
        return 'Library';
      case '/ai-tools':
        return 'AI Tools';
      case '/incidents':
        return 'Incidents';
      case '/compliance':
        return 'Compliance';
      case '/marketplace':
        return 'Marketplace';
      case '/settings':
        return 'Settings';
      // Plugin screens
      case '/wellbeing':
        return 'Student Wellbeing';
      case '/lms':
        return 'Learning Management';
      case '/admission':
        return 'Admission';
      case '/alumni':
        return 'Alumni Network';
      case '/health-records':
        return 'Health Records';
      case '/gamification':
        return 'Gamification';
      case '/visitors':
        return 'Visitor Management';
      case '/inventory':
        return 'Inventory & Assets';
      case '/design-studio':
        return 'Design Studio';
      case '/exam-results':
        return 'Exam Results';
      default:
        return fallback;
    }
  }

  bool _usesLocalAppBar(String location) {
    const routes = [
      '/admission',
      '/ai-tools',
      '/alumni',
      '/class-sections',
      '/class-subjects',
      '/compliance',
      '/design-studio',
      '/exam-results',
      '/gamification',
      '/health-records',
      '/hr',
      '/incidents',
      '/inventory',
      '/library',
      '/lms',
      '/transport',
      '/visitors',
      '/wellbeing',
    ];

    for (final route in routes) {
      if (location.startsWith(route)) return true;
    }

    return false;
  }
}
