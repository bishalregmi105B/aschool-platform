import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

final teacherDashboardProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final resp = await ApiClient.instance.get('/teacher/dashboard');
  return resp.data['data'] as Map<String, dynamic>;
});

/// Teacher dashboard — today's classes, quick attendance, stats
class TeacherDashboard extends ConsumerWidget {
  const TeacherDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(teacherDashboardProvider);
    final user = ref.watch(authProvider).user;
    final plugins = ref.watch(pluginProvider);

    return PullToRefresh(
      onRefresh: () => ref.refresh(teacherDashboardProvider.future),
      child: state.when(
        loading: () => const ShimmerLoadingGrid(),
        error: (err, stack) => ErrorContainer(
          errorMessage: err.toString(),
          onRetry: () => ref.refresh(teacherDashboardProvider.future),
        ),
        data: (data) {
          final classes =
              List<Map<String, dynamic>>.from(data['today_classes'] ?? []);
          final stats = data['stats'] as Map<String, dynamic>? ?? {};
          final notices =
              List<Map<String, dynamic>>.from(data['recent_notices'] ?? []);

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Greeting Section
              Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: ASchoolTheme.primary.withAlpha(30),
                    child: Text(
                      user?.firstName?.substring(0, 1).toUpperCase() ?? 'T',
                      style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: ASchoolTheme.primary),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Good morning, ${user?.firstName ?? 'Teacher'}!',
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 2),
                        NepaliDateDisplay(
                            style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 13,
                                fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Quick Stats Grid
              Row(
                children: [
                  Expanded(
                    child: StatCard(
                      title: 'Classes Today',
                      value: '${stats['classes_today'] ?? 0}',
                      icon: Icons.class_rounded,
                      color: ASchoolTheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatCard(
                      title: 'Pending',
                      value: '${stats['pending_attendance'] ?? 0}',
                      icon: Icons.pending_actions_rounded,
                      color: Colors.orange,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatCard(
                      title: 'Assignments',
                      value: '${stats['pending_assignments'] ?? 0}',
                      icon: Icons.assignment_late_rounded,
                      color: Colors.red,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 32),

              // Academics Quick Menu
              const SectionHeader(
                title: 'Academics Quick Menu',
                padding: EdgeInsets.zero,
              ),
              const SizedBox(height: 12),
              _TeacherQuickActions(plugins: plugins),

              const SizedBox(height: 28),

              // Today's Classes Section
              SectionHeader(
                title: "Today's Schedule",
                actionText: 'Full Timetable',
                onActionTap: () => context.go('/timetable'),
              ),
              const SizedBox(height: 12),
              if (classes.isEmpty)
                const NoDataContainer(
                  title: 'No classes today! 🎉',
                  subtitle: 'Enjoy your free time.',
                  icon: Icons.celebration_rounded,
                )
              else
                ...classes.map((c) => _buildClassCard(context, c)),

              const SizedBox(height: 32),

              // Recent Notices Section
              if (notices.isNotEmpty) ...[
                SectionHeader(
                  title: 'Recent Notices',
                  actionText: 'View All',
                  onActionTap: () => context.go('/notices'),
                ),
                const SizedBox(height: 12),
                ...notices.map((n) => Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                      elevation: 0,
                      color: Colors.white,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.all(16),
                          leading: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                                color: Colors.orange.withAlpha(20),
                                borderRadius: BorderRadius.circular(12)),
                            child: const Icon(Icons.campaign_rounded,
                                color: Colors.orange),
                          ),
                          title: Text(n['title'] ?? '',
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text((n['date'] ?? '').isNotEmpty ? adToBsString(DateTime.tryParse(n['date']!) ?? DateTime.now()) : '',
                                style: TextStyle(
                                    color: Colors.grey.shade600, fontSize: 12)),
                          ),
                        ),
                      ),
                    )),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _buildClassCard(BuildContext context, Map<String, dynamic> c) {
    final attended = c['attendance_marked'] == true;
    final theme = Theme.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(5),
              blurRadius: 10,
              offset: const Offset(0, 4))
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: attended ? null : () => context.go('/attendance'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: ASchoolTheme.primary.withAlpha(20),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    c['period'] ?? '',
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: ASchoolTheme.primary),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c['subject'] ?? '',
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${c['class_name'] ?? ''} • ${c['time'] ?? ''}',
                      style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                          fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              if (attended)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                      color: Colors.green.withAlpha(20),
                      borderRadius: BorderRadius.circular(8)),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_rounded,
                          size: 14, color: Colors.green),
                      SizedBox(width: 4),
                      Text('Done',
                          style: TextStyle(
                              fontSize: 12,
                              color: Colors.green,
                              fontWeight: FontWeight.bold)),
                    ],
                  ),
                )
              else
                FilledButton.icon(
                  onPressed: () => context.go('/attendance'),
                  icon: const Icon(Icons.fact_check_rounded, size: 16),
                  label: const Text('Take'),
                  style: FilledButton.styleFrom(
                    backgroundColor: ASchoolTheme.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TeacherQuickActions extends StatelessWidget {
  final PluginState plugins;
  const _TeacherQuickActions({required this.plugins});

  static const _quickActions = [
    _TeacherActionItem(
      icon: Icons.fact_check_rounded,
      label: 'Attendance',
      color: ASchoolTheme.primary,
      path: '/attendance',
      moduleKey: 'attendance',
    ),
    _TeacherActionItem(
      icon: Icons.grade_rounded,
      label: 'Marks',
      color: Colors.orange,
      path: '/marks',
      moduleKey: 'marks',
      requiredPlugin: 'exams',
    ),
    _TeacherActionItem(
      icon: Icons.assignment_rounded,
      label: 'Assignments',
      color: Colors.deepOrange,
      path: '/assignments',
      moduleKey: 'assignments',
      requiredPlugin: 'assignments',
    ),
    _TeacherActionItem(
      icon: Icons.people_alt_rounded,
      label: 'Students',
      color: Colors.indigo,
      path: '/students',
      moduleKey: 'students',
    ),
    _TeacherActionItem(
      icon: Icons.schedule_rounded,
      label: 'Timetable',
      color: Colors.blue,
      path: '/timetable',
      moduleKey: 'timetable',
    ),
    _TeacherActionItem(
      icon: Icons.book_rounded,
      label: 'Lessons',
      color: Colors.green,
      path: '/lessons',
      moduleKey: 'lessons',
    ),
    _TeacherActionItem(
      icon: Icons.topic_rounded,
      label: 'Topics',
      color: Colors.teal,
      path: '/topics',
      moduleKey: 'topics',
    ),
  ];

  static const _moreActions = [
    _TeacherActionItem(
      icon: Icons.class_rounded,
      label: 'Class Section',
      color: Colors.deepPurple,
      path: '/class-section',
      moduleKey: 'class_section',
    ),
    _TeacherActionItem(
      icon: Icons.quiz_rounded,
      label: 'Offline Exam',
      color: Colors.brown,
      path: '/offline-exam',
      moduleKey: 'offline_exam',
      requiredPlugin: 'exams',
    ),
    _TeacherActionItem(
      icon: Icons.computer_rounded,
      label: 'Online Exam',
      color: Colors.brown,
      path: '/online-exam',
      moduleKey: 'online_exam',
      requiredPlugin: 'exams',
    ),
    _TeacherActionItem(
      icon: Icons.bar_chart_rounded,
      label: 'Report Cards',
      color: Colors.indigo,
      path: '/report-cards',
      moduleKey: 'report_cards',
      requiredPlugin: 'exams',
    ),
    _TeacherActionItem(
      icon: Icons.menu_book_rounded,
      label: 'Student Diary',
      color: Colors.lightBlue,
      path: '/diary',
      moduleKey: 'diary',
      requiredPlugin: 'notices',
    ),
    _TeacherActionItem(
      icon: Icons.campaign_rounded,
      label: 'Announcements',
      color: Colors.amber,
      path: '/announcements',
      moduleKey: 'announcements',
    ),
    _TeacherActionItem(
      icon: Icons.notifications_rounded,
      label: 'Notices',
      color: Colors.amber,
      path: '/notices',
      moduleKey: 'notices',
    ),
    _TeacherActionItem(
      icon: Icons.event_busy_rounded,
      label: 'Leave',
      color: Colors.red,
      path: '/leave',
      moduleKey: 'leave',
    ),
    _TeacherActionItem(
      icon: Icons.fingerprint_rounded,
      label: 'My Attendance',
      color: Colors.blueGrey,
      path: '/my-attendance',
      moduleKey: 'my_attendance',
    ),
    _TeacherActionItem(
      icon: Icons.receipt_long_rounded,
      label: 'Payroll',
      color: Colors.pink,
      path: '/payroll',
      moduleKey: 'payroll',
    ),
    _TeacherActionItem(
      icon: Icons.auto_awesome_rounded,
      label: 'AI Tools',
      color: Colors.purple,
      path: '/ai-tools',
      moduleKey: 'ai_tools',
      requiredPlugin: 'ai_tutor',
    ),
    _TeacherActionItem(
      icon: Icons.forum_rounded,
      label: 'Chat',
      color: Colors.green,
      path: '/chat',
      moduleKey: 'chat',
    ),
    _TeacherActionItem(
      icon: Icons.beach_access_rounded,
      label: 'Holidays',
      color: Colors.cyan,
      path: '/holidays',
      moduleKey: 'holidays',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final visibleQuickActions =
        _quickActions.where((action) => action.isVisible(plugins)).toList();
    final visibleMoreActions =
        _moreActions.where((action) => action.isVisible(plugins)).toList();

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = _gridColumns(constraints.maxWidth);
        return GridView.count(
          crossAxisCount: columns,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 16,
          crossAxisSpacing: 12,
          childAspectRatio: 0.84,
          children: [
            ...visibleQuickActions.map(
              (action) => _TeacherActionTile(
                icon: action.icon,
                label: action.label,
                color: action.color,
                onTap: () => context.go(action.path),
              ),
            ),
            if (visibleMoreActions.isNotEmpty)
              _TeacherActionTile(
                icon: Icons.grid_view_rounded,
                label: 'More',
                color: ASchoolTheme.primaryDark,
                onTap: () => _showMoreMenu(context, visibleMoreActions),
              ),
          ],
        );
      },
    );
  }

  void _showMoreMenu(
    BuildContext context,
    List<_TeacherActionItem> actions,
  ) {
    CustomBottomSheet.show<void>(
      context: context,
      title: 'Teacher More Menu',
      height: MediaQuery.of(context).size.height * 0.72,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = _gridColumns(constraints.maxWidth - 32);
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            child: GridView.count(
              crossAxisCount: columns,
              mainAxisSpacing: 16,
              crossAxisSpacing: 12,
              childAspectRatio: 0.84,
              children: actions
                  .map(
                    (action) => _TeacherActionTile(
                      icon: action.icon,
                      label: action.label,
                      color: action.color,
                      onTap: () {
                        Navigator.of(context).pop();
                        context.go(action.path);
                      },
                    ),
                  )
                  .toList(),
            ),
          );
        },
      ),
    );
  }

  int _gridColumns(double width) {
    if (width >= 520) return 5;
    if (width >= 400) return 4;
    if (width >= 320) return 3;
    return 2;
  }
}

class _TeacherActionItem {
  final IconData icon;
  final String label;
  final Color color;
  final String path;
  final String moduleKey;
  final String? requiredPlugin;

  const _TeacherActionItem({
    required this.icon,
    required this.label,
    required this.color,
    required this.path,
    required this.moduleKey,
    this.requiredPlugin,
  });

  bool isVisible(PluginState plugins) {
    if (!plugins.isModuleVisible(moduleKey)) {
      return false;
    }
    if (requiredPlugin != null && !plugins.isInstalled(requiredPlugin!)) {
      return false;
    }
    return true;
  }
}

class _TeacherActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _TeacherActionTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: color.withAlpha(18),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              icon,
              color: color,
            ),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 11.5,
                color: Colors.black87,
                fontWeight: FontWeight.w600,
                height: 1.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
