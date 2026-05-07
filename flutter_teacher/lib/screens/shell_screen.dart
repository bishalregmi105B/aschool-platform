import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

class TeacherShellScreen extends ConsumerStatefulWidget {
  final StatefulNavigationShell navigationShell;

  const TeacherShellScreen({
    super.key,
    required this.navigationShell,
  });

  @override
  ConsumerState<TeacherShellScreen> createState() => _TeacherShellScreenState();
}

class _TeacherShellScreenState extends ConsumerState<TeacherShellScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  void _onNavDestinationSelected(int index) {
    if (index == 4) {
      _scaffoldKey.currentState?.openDrawer();
      return;
    }

    widget.navigationShell.goBranch(
      index,
      initialLocation: index == widget.navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final canPop = GoRouter.of(context).canPop();
    final useLocalAppBar = _usesLocalAppBar(location);
    final user = ref.watch(authProvider).user;
    final plugins = ref.watch(pluginProvider);
    final drawerSections = _buildDrawerSections(plugins);
    final showNoticesAction = plugins.isModuleVisible('notices');

    return Scaffold(
      key: _scaffoldKey,
      appBar: useLocalAppBar
          ? null
          : CustomAppBar(
              title: _titleFor(location),
              showBackButton: canPop,
              onBackPressed: canPop ? () => context.pop() : null,
              actions: [
                if (showNoticesAction)
                  IconButton(
                    icon: const Icon(Icons.notifications_outlined),
                    onPressed: () => context.push('/notices'),
                  ),
              ],
            ),
      drawer: AppDrawer(
        userFullName: user?.fullName ?? 'Teacher',
        userSubtitle: user?.phone ?? 'Staff Member',
        userRole: 'Teacher',
        onLogout: () => ref.read(authProvider.notifier).logout(),
        sections: drawerSections,
      ),
      body: widget.navigationShell,
      bottomNavigationBar: DynamicBottomNav(
        currentIndex: widget.navigationShell.currentIndex,
        onTap: _onNavDestinationSelected,
        fixedTabs: const [
          BottomNavItem(icon: Icons.dashboard_rounded, label: 'Home'),
          BottomNavItem(icon: Icons.fact_check_rounded, label: 'Attendance'),
          BottomNavItem(icon: Icons.grade_rounded, label: 'Marks'),
          BottomNavItem(icon: Icons.auto_awesome_rounded, label: 'AI Tools'),
          BottomNavItem(icon: Icons.menu_rounded, label: 'Menu'),
        ],
        pluginTabs: const [],
      ),
    );
  }

  String _titleFor(String location) {
    if (location.startsWith('/dashboard')) return 'Dashboard';
    if (location.startsWith('/class-section')) return 'Class Section';
    if (location.startsWith('/attendance')) return 'Attendance';
    if (location.startsWith('/marks')) return 'Marks Entry';
    if (location.startsWith('/assignments')) return 'Assignments';
    if (location.startsWith('/timetable')) return 'My Timetable';
    if (location.startsWith('/ai-tools')) return 'AI Tools';
    if (location == '/students') return 'My Students';
    if (location.startsWith('/students/')) return 'Student Profile';
    if (location.startsWith('/students')) return 'Student Details';
    if (location.startsWith('/notices')) return 'Notices';
    if (location.startsWith('/lessons')) return 'Subject Lessons';
    if (location.startsWith('/topics')) return 'Create Topic';
    if (location.startsWith('/holidays')) return 'Holiday List';
    if (location.startsWith('/offline-exam')) return 'Offline Exam';
    if (location.startsWith('/online-exam')) return 'Online Exam';
    if (location.startsWith('/report-cards')) return 'Report Cards';
    if (location.startsWith('/diary')) return 'Student Diary';
    if (location.startsWith('/announcements')) return 'Announcements';
    if (location.startsWith('/chat')) return 'Chat';
    if (location.startsWith('/leave')) return 'Leave';
    if (location.startsWith('/my-attendance')) return 'My Attendance';
    if (location.startsWith('/payroll')) return 'Payroll Slips';
    return 'ASchool';
  }

  bool _usesLocalAppBar(String location) {
    return location.startsWith('/attendance') ||
        location.startsWith('/ai-tools');
  }

  List<DrawerSection> _buildDrawerSections(PluginState plugins) {
    final sections = <DrawerSection>[];

    void addSection(String title, List<_TeacherDrawerItem> items) {
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

    addSection('Academic Management', const [
      _TeacherDrawerItem(
          icon: Icons.dashboard_rounded,
          title: 'Dashboard',
          path: '/dashboard',
          moduleKey: 'dashboard'),
      _TeacherDrawerItem(
          icon: Icons.class_rounded,
          title: 'Class Section',
          path: '/class-section',
          moduleKey: 'class_section'),
      _TeacherDrawerItem(
          icon: Icons.people_alt_rounded,
          title: 'Student Details',
          path: '/students',
          moduleKey: 'students'),
      _TeacherDrawerItem(
          icon: Icons.book_rounded,
          title: 'Create Lesson',
          path: '/lessons',
          moduleKey: 'lessons'),
      _TeacherDrawerItem(
          icon: Icons.topic_rounded,
          title: 'Create Topic',
          path: '/topics',
          moduleKey: 'topics'),
      _TeacherDrawerItem(
          icon: Icons.schedule_rounded,
          title: 'Timetable',
          path: '/timetable',
          moduleKey: 'timetable'),
    ]);

    addSection('Attendance', const [
      _TeacherDrawerItem(
          icon: Icons.fact_check_rounded,
          title: 'Add Attendance',
          path: '/attendance',
          moduleKey: 'attendance'),
      _TeacherDrawerItem(
          icon: Icons.beach_access_rounded,
          title: 'Holiday List',
          path: '/holidays',
          moduleKey: 'holidays'),
    ]);

    addSection('Exam & Performance', const [
      _TeacherDrawerItem(
          icon: Icons.assignment_rounded,
          title: 'Assignments',
          path: '/assignments',
          moduleKey: 'assignments',
          pluginSlug: 'assignments'),
      _TeacherDrawerItem(
          icon: Icons.grade_rounded,
          title: 'Marks Entry',
          path: '/marks',
          moduleKey: 'marks',
          pluginSlug: 'exams'),
      _TeacherDrawerItem(
          icon: Icons.quiz_rounded,
          title: 'Offline Exam',
          path: '/offline-exam',
          moduleKey: 'offline_exam',
          pluginSlug: 'exams'),
      _TeacherDrawerItem(
          icon: Icons.computer_rounded,
          title: 'Online Exam',
          path: '/online-exam',
          moduleKey: 'online_exam',
          pluginSlug: 'exams'),
      _TeacherDrawerItem(
          icon: Icons.bar_chart_rounded,
          title: 'Report Cards',
          path: '/report-cards',
          moduleKey: 'report_cards',
          pluginSlug: 'exams'),
    ]);

    addSection('Communication & Media', const [
      _TeacherDrawerItem(
          icon: Icons.menu_book_rounded,
          title: 'Student Diary',
          path: '/diary',
          moduleKey: 'diary',
          pluginSlug: 'notices'),
      _TeacherDrawerItem(
          icon: Icons.campaign_rounded,
          title: 'Announcements',
          path: '/announcements',
          moduleKey: 'announcements'),
      _TeacherDrawerItem(
          icon: Icons.notifications_rounded,
          title: 'Notices',
          path: '/notices',
          moduleKey: 'notices'),
      _TeacherDrawerItem(
          icon: Icons.forum_rounded,
          title: 'Chat',
          path: '/chat',
          moduleKey: 'chat'),
    ]);

    addSection('Personnel Management', const [
      _TeacherDrawerItem(
          icon: Icons.event_busy_rounded,
          title: 'Leave',
          path: '/leave',
          moduleKey: 'leave'),
      _TeacherDrawerItem(
          icon: Icons.fingerprint_rounded,
          title: 'My Attendance',
          path: '/my-attendance',
          moduleKey: 'my_attendance'),
      _TeacherDrawerItem(
          icon: Icons.receipt_long_rounded,
          title: 'Payroll Slips',
          path: '/payroll',
          moduleKey: 'payroll'),
    ]);

    addSection('Tools', const [
      _TeacherDrawerItem(
          icon: Icons.auto_awesome_rounded,
          title: 'AI Tools',
          path: '/ai-tools',
          moduleKey: 'ai_tools',
          pluginSlug: 'ai_tutor'),
    ]);

    return sections;
  }
}

class _TeacherDrawerItem {
  final IconData icon;
  final String title;
  final String path;
  final String moduleKey;
  final String? pluginSlug;

  const _TeacherDrawerItem({
    required this.icon,
    required this.title,
    required this.path,
    required this.moduleKey,
    this.pluginSlug,
  });

  bool isVisible(PluginState plugins) {
    if (!plugins.isModuleVisible(moduleKey)) {
      return false;
    }
    if (pluginSlug != null && !plugins.isInstalled(pluginSlug!)) {
      return false;
    }
    return true;
  }
}
