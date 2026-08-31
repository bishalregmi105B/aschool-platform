import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

class StudentDashboard extends ConsumerWidget {
  const StudentDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final currentStudent = ref.watch(currentStudentProvider).value;
    final dashboardState = ref.watch(dashboardProvider);
    final plugins = ref.watch(pluginProvider);

    final fullName = (currentStudent?.fullName ?? user?.fullName ?? '').trim();
    final firstName =
        fullName.isNotEmpty ? fullName.split(' ').first : 'Student';

    return Scaffold(
      appBar: CustomAppBar(
        title: 'Namaste, $firstName! 👋',
        showBackButton: false,
        actions: [
          NotificationBell(
            tooltip: 'Notifications',
            onTap: () => context.push('/notifications'),
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.go('/dashboard/profile'),
          ),
        ],
      ),
      body: PullToRefresh(
        onRefresh: () => ref.read(dashboardProvider.notifier).refresh(),
        child: dashboardState.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(16),
            children: const [
              ShimmerLoadingGrid(
                  itemCount: 1, crossAxisCount: 1, childAspectRatio: 2.5),
              SizedBox(height: 16),
              ShimmerLoadingGrid(itemCount: 3, crossAxisCount: 3),
              SizedBox(height: 24),
              ShimmerLoadingList(itemCount: 4, hasAvatar: false),
            ],
          ),
          error: (err, stack) => ErrorContainer(
            errorMessage: err.toString(),
            onRetry: () => ref.read(dashboardProvider.notifier).refresh(),
          ),
          data: (data) {
            final raw = data.rawData;
            final todayClasses = safeList(raw['today_classes']);
            final pendingHomework = safeList(raw['pending_homework']);
            final recentResults = safeList(raw['recent_results']);
            final notices = safeList(raw['notices']);
            final attendance = raw['attendance'] ?? {};
            final rank = raw['rank'];

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const NepaliDateDisplay(),
                const SizedBox(height: 16),

                if (data.banners.isNotEmpty) ...[
                  BannerCarousel(
                    banners: data.banners,
                    onTap: (banner) {
                      if (banner.linkUrl != null &&
                          banner.linkUrl!.isNotEmpty) {
                        // Handle banner link
                      }
                    },
                  ),
                  const SizedBox(height: 24),
                ],

                // Quick Stats
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        title: 'Attendance',
                        value: '${attendance['percentage'] ?? '--'}%',
                        icon: Icons.check_circle,
                        color: Colors.green,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatCard(
                        title: 'Rank',
                        value: rank != null ? '#$rank' : '--',
                        icon: Icons.leaderboard,
                        color: Colors.amber.shade700,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatCard(
                        title: 'Homework Due',
                        value: '${pendingHomework.length}',
                        icon: Icons.assignment_late,
                        color:
                            pendingHomework.isEmpty ? Colors.grey : Colors.red,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Quick Actions
                const SectionHeader(
                  title: 'Quick Actions',
                  padding: EdgeInsets.zero,
                ),
                const SizedBox(height: 12),
                _StudentQuickActions(plugins: plugins),
                const SizedBox(height: 24),

                // Today's Schedule
                SectionHeader(
                  title: "Today's Classes",
                  actionText: 'Full Timetable',
                  onActionTap: () => context.go('/timetable'),
                  padding: EdgeInsets.zero,
                ),
                const SizedBox(height: 8),
                if (todayClasses.isEmpty)
                  const NoDataContainer(
                    title: 'No classes today 🎉',
                    icon: Icons.event_available,
                  )
                else
                  ...todayClasses.map((cls) => _ClassCard(cls: cls)),

                const SizedBox(height: 24),

                // Pending Homework
                if (pendingHomework.isNotEmpty) ...[
                  SectionHeader(
                    title: 'Pending Homework',
                    actionText: 'View All',
                    onActionTap: () => context.go('/homework'),
                    padding: EdgeInsets.zero,
                  ),
                  const SizedBox(height: 8),
                  ...pendingHomework.take(3).map((hw) => _HomeworkTile(hw: hw)),
                  const SizedBox(height: 24),
                ],

                // Recent Results
                if (recentResults.isNotEmpty) ...[
                  SectionHeader(
                    title: 'Recent Results',
                    actionText: 'All Results',
                    onActionTap: () => context.go('/results'),
                    padding: EdgeInsets.zero,
                  ),
                  const SizedBox(height: 8),
                  ...recentResults.take(2).map((r) => _ResultCard(r: r)),
                  const SizedBox(height: 24),
                ],

                // Recent Notices
                if (notices.isNotEmpty) ...[
                  SectionHeader(
                    title: 'Notices',
                    actionText: 'View All',
                    onActionTap: () => context.go('/dashboard/notices'),
                    padding: EdgeInsets.zero,
                  ),
                  const SizedBox(height: 8),
                  ...notices.take(3).map((n) => _NoticeCard(n: n)),
                ],

                const SizedBox(height: 32),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  final Map<String, dynamic> cls;
  const _ClassCard({required this.cls});

  @override
  Widget build(BuildContext context) {
    final isNow = cls['is_current'] == true;
    const primaryColor = ASchoolTheme.primary;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        border: isNow
            ? Border.all(color: primaryColor.withAlpha(100), width: 1.5)
            : Border.all(
                color: Theme.of(context).brightness == Brightness.dark
                    ? ASchoolTheme.darkBorder
                    : Colors.grey.shade200),
        boxShadow: [
          if (isNow)
            BoxShadow(
              color: primaryColor.withAlpha(20),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
        ],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isNow
                ? primaryColor.withAlpha(20)
                : Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                cls['start_time'] ?? '',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: isNow ? primaryColor : Theme.of(context).colorScheme.onSurface,
                ),
              ),
              Text(
                cls['end_time'] ?? '',
                style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
        title: Text(
          cls['subject'] ?? '',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          cls['teacher'] ?? '',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
        trailing: isNow
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.green.withAlpha(30),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text('NOW',
                    style: TextStyle(
                        fontSize: 11,
                        color: Colors.green,
                        fontWeight: FontWeight.bold)),
              )
            : Text('Period ${cls['period'] ?? ''}',
                style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 12)),
      ),
    );
  }
}

class _HomeworkTile extends StatelessWidget {
  final Map<String, dynamic> hw;
  const _HomeworkTile({required this.hw});

  @override
  Widget build(BuildContext context) {
    final dueDate = hw['due_date'] ?? '';
    final isOverdue = hw['is_overdue'] == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? ASchoolTheme.darkBorder
              : Colors.grey.shade200,
        ),
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: isOverdue
                ? Colors.red.withAlpha(20)
                : ASchoolTheme.secondary.withAlpha(20),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.assignment,
              color: isOverdue ? Colors.red : ASchoolTheme.secondary, size: 20),
        ),
        title: Text(hw['title'] ?? '',
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
          '${hw['subject'] ?? ''} • Due: $dueDate',
          style: TextStyle(
              color: isOverdue
                  ? Colors.red.shade400
                  : Theme.of(context).colorScheme.onSurfaceVariant),
        ),
        trailing: isOverdue
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.red.withAlpha(20),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text('OVERDUE',
                    style: TextStyle(
                        fontSize: 10,
                        color: Colors.red,
                        fontWeight: FontWeight.bold)),
              )
            : const Icon(Icons.chevron_right, color: Colors.grey),
      ),
    );
  }
}

class _StudentQuickActions extends StatelessWidget {
  final PluginState plugins;
  const _StudentQuickActions({required this.plugins});

  static const _quickActions = [
    _StudentActionItem(
      icon: Icons.smart_toy_rounded,
      label: 'AI Tutor',
      color: Colors.purple,
      path: '/dashboard/ai-tutor',
      moduleKey: 'ai_tutor',
      requiredPlugin: 'ai_tutor',
    ),
    _StudentActionItem(
      icon: Icons.assignment_rounded,
      label: 'Homework',
      color: Colors.orange,
      path: '/homework',
      moduleKey: 'homework',
    ),
    _StudentActionItem(
      icon: Icons.schedule_rounded,
      label: 'Timetable',
      color: Colors.indigo,
      path: '/timetable',
      moduleKey: 'timetable',
    ),
    _StudentActionItem(
      icon: Icons.emoji_events_rounded,
      label: 'Results',
      color: Colors.amber,
      path: '/results',
      moduleKey: 'results',
    ),
    _StudentActionItem(
      icon: Icons.quiz_rounded,
      label: 'Exams',
      color: Colors.deepOrange,
      path: '/dashboard/exams',
      moduleKey: 'exams',
      requiredPlugin: 'exams',
    ),
    _StudentActionItem(
      icon: Icons.local_library_rounded,
      label: 'Library',
      color: Colors.teal,
      path: '/dashboard/library',
      moduleKey: 'library',
      requiredPlugin: 'library_management',
    ),
    _StudentActionItem(
      icon: Icons.campaign_rounded,
      label: 'Notices',
      color: Colors.blue,
      path: '/dashboard/notices',
      moduleKey: 'notices',
    ),
  ];

  static const _moreActions = [
    _StudentActionItem(
      icon: Icons.subject_rounded,
      label: 'Subjects',
      color: Colors.blueGrey,
      path: '/dashboard/subjects',
      moduleKey: 'subjects',
    ),
    _StudentActionItem(
      icon: Icons.person_rounded,
      label: 'Teachers',
      color: Colors.deepPurple,
      path: '/dashboard/teachers',
      moduleKey: 'teachers',
    ),
    _StudentActionItem(
      icon: Icons.menu_book_rounded,
      label: 'Diary',
      color: Colors.green,
      path: '/dashboard/diary',
      moduleKey: 'diary',
    ),
    _StudentActionItem(
      icon: Icons.beach_access_rounded,
      label: 'Holidays',
      color: Colors.lightBlue,
      path: '/dashboard/holidays',
      moduleKey: 'holidays',
    ),
    _StudentActionItem(
      icon: Icons.photo_library_rounded,
      label: 'Gallery',
      color: Colors.pink,
      path: '/dashboard/gallery',
      moduleKey: 'gallery',
    ),
    _StudentActionItem(
      icon: Icons.family_restroom_rounded,
      label: 'Guardians',
      color: Colors.brown,
      path: '/dashboard/guardians',
      moduleKey: 'guardians',
    ),
    _StudentActionItem(
      icon: Icons.directions_bus_rounded,
      label: 'Transport',
      color: Colors.orange,
      path: '/dashboard/transport',
      moduleKey: 'transport',
      customVisible: _busTrackingVisible,
    ),
    _StudentActionItem(
      icon: Icons.menu_book_rounded,
      label: 'E-Library',
      color: Colors.teal,
      path: '/dashboard/elibrary',
      moduleKey: 'elibrary',
      requiredPlugin: 'elibrary',
    ),
    _StudentActionItem(
      icon: Icons.play_circle_fill_rounded,
      label: 'LMS',
      color: Colors.blue,
      path: '/dashboard/lms',
      moduleKey: 'lms',
      requiredPlugin: 'lms',
    ),
    _StudentActionItem(
      icon: Icons.people_rounded,
      label: 'My Class',
      color: Colors.cyan,
      path: '/dashboard/classmates',
      moduleKey: 'classmates',
    ),
    _StudentActionItem(
      icon: Icons.folder_special_rounded,
      label: 'Portfolio',
      color: Colors.deepPurple,
      path: '/dashboard/portfolio',
      moduleKey: 'portfolio',
      requiredPlugin: 'student_portfolio',
    ),
    _StudentActionItem(
      icon: Icons.star_rounded,
      label: 'Achievements',
      color: Colors.amber,
      path: '/dashboard/achievements',
      moduleKey: 'achievements',
      requiredPlugin: 'student_portfolio',
    ),
    _StudentActionItem(
      icon: Icons.favorite_rounded,
      label: 'Wellbeing',
      color: Colors.red,
      path: '/dashboard/wellbeing',
      moduleKey: 'wellbeing',
      requiredPlugin: 'wellbeing',
    ),
    _StudentActionItem(
      icon: Icons.forum_rounded,
      label: 'Chat',
      color: Colors.green,
      path: '/dashboard/chat',
      moduleKey: 'chat',
    ),
  ];

  static bool _busTrackingVisible(PluginState plugins) {
    return plugins.isInstalled('bus_tracking') ||
        plugins.isInstalled('gps_tracking');
  }

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
              (action) => _QuickAction(
                icon: action.icon,
                label: action.label,
                color: action.color,
                onTap: () => context.go(action.path),
              ),
            ),
            if (visibleMoreActions.isNotEmpty)
              _QuickAction(
                icon: Icons.grid_view_rounded,
                label: 'More',
                color: ASchoolTheme.primary,
                onTap: () => _showMoreActions(context, visibleMoreActions),
              ),
          ],
        );
      },
    );
  }

  void _showMoreActions(
      BuildContext context, List<_StudentActionItem> actions) {
    CustomBottomSheet.show<void>(
      context: context,
      title: 'More Student Actions',
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
                    (action) => _QuickAction(
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

class _StudentActionItem {
  final IconData icon;
  final String label;
  final Color color;
  final String path;
  final String moduleKey;
  final String? requiredPlugin;
  final bool Function(PluginState plugins)? customVisible;

  const _StudentActionItem({
    required this.icon,
    required this.label,
    required this.color,
    required this.path,
    required this.moduleKey,
    this.requiredPlugin,
    this.customVisible,
  });

  bool isVisible(PluginState plugins) {
    if (!plugins.isModuleVisible(moduleKey)) {
      return false;
    }
    if (requiredPlugin != null && !plugins.isInstalled(requiredPlugin!)) {
      return false;
    }
    if (customVisible != null && !customVisible!(plugins)) {
      return false;
    }
    return true;
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: color.withAlpha(
                Theme.of(context).brightness == Brightness.dark ? 52 : 20,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
                color: Theme.of(context).colorScheme.onSurface,
                height: 1.1,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final Map<String, dynamic> r;
  const _ResultCard({required this.r});

  Color _gradeColor(String grade) {
    if (grade.startsWith('A')) return Colors.green;
    if (grade.startsWith('B')) return Colors.blue;
    if (grade.startsWith('C')) return Colors.orange;
    return Colors.red;
  }

  @override
  Widget build(BuildContext context) {
    final grade = r['grade'] ?? '';
    final gradeColor = _gradeColor(grade);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? ASchoolTheme.darkBorder
              : Colors.grey.shade200,
        ),
      ),
      child: ListTile(
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: gradeColor.withAlpha(20),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text('${r['percentage'] ?? '--'}%',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: gradeColor)),
        ),
        title: Text(r['exam_name'] ?? '',
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('GPA: ${r['gpa'] ?? '--'}',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: gradeColor.withAlpha(20),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(grade,
              style: TextStyle(color: gradeColor, fontWeight: FontWeight.bold)),
        ),
      ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  final Map<String, dynamic> n;
  const _NoticeCard({required this.n});

  @override
  Widget build(BuildContext context) {
    final isUrgent = n['priority'] == 'urgent';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? ASchoolTheme.darkBorder
              : Colors.grey.shade200,
        ),
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color:
                isUrgent ? Colors.red.withAlpha(20) : Colors.blue.withAlpha(20),
            shape: BoxShape.circle,
          ),
          child: Icon(
            isUrgent ? Icons.warning_rounded : Icons.info_outline_rounded,
            color: isUrgent ? Colors.red : Colors.blue,
            size: 20,
          ),
        ),
        title: Text(n['title'] ?? '',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text((n['date'] ?? '').isNotEmpty ? adToBsString(DateTime.tryParse(n['date']!) ?? DateTime.now()) : '',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12)),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
      ),
    );
  }
}
