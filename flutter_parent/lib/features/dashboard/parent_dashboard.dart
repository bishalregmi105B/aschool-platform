import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

class ParentDashboard extends ConsumerWidget {
  const ParentDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardState = ref.watch(parentDashboardProvider);

    return dashboardState.when(
      loading: () => const LoadingShimmer(),
      error: (err, _) => ErrorContainer(
        errorMessage: err.toString(),
        onRetry: () => ref.invalidate(parentDashboardProvider),
      ),
      data: (dashboard) => RefreshIndicator(
        onRefresh: () => ref.refresh(parentDashboardProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const _GreetingHeader(),
            const SizedBox(height: 20),
            if (dashboard.children.isEmpty)
              const NoDataContainer(
                title: 'No linked children',
                subtitle: 'Linked student profiles will appear here.',
                icon: Icons.child_care_rounded,
              )
            else
              ...dashboard.children.map(
                (child) => _ChildCard(
                  child: child,
                  selected: _childId(child) ==
                      ref.watch(selectedChildIdForApiProvider),
                  onTap: () {
                    ref.read(selectedChildIdProvider.notifier).state =
                        _childId(child);
                  },
                ),
              ),
            const SizedBox(height: 20),
            const ESchoolSectionTitle(title: 'Quick Actions'),
            const SizedBox(height: 12),
            const _QuickActions(),
            if (dashboard.recentNotices.isNotEmpty) ...[
              const SizedBox(height: 24),
              const ESchoolSectionTitle(title: 'Recent Notices'),
              const SizedBox(height: 8),
              ...dashboard.recentNotices.asMap().entries.map(
                    (entry) => ESchoolAnimatedEntry(
                      index: entry.key,
                      child: ESchoolCard(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: EdgeInsets.zero,
                        child: ListTile(
                          leading: Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: ASchoolTheme.warning.withAlpha(22),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.campaign_rounded,
                              color: ASchoolTheme.warning,
                              size: 20,
                            ),
                          ),
                          title: Text(entry.value['title'] ?? ''),
                          subtitle: Text(entry.value['date'] ?? ''),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () => context.go('/notices'),
                        ),
                      ),
                    ),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ChildCard extends StatelessWidget {
  final Map<String, dynamic> child;
  final bool selected;
  final VoidCallback onTap;

  const _ChildCard({
    required this.child,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final photoUrl = child['photo_url']?.toString();
    final todayStatus = child['today_status']?.toString();

    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 12),
      color: selected ? ASchoolTheme.primary.withAlpha(5) : Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundImage: photoUrl != null && photoUrl.isNotEmpty
                      ? NetworkImage(photoUrl)
                      : null,
                  child: photoUrl == null || photoUrl.isEmpty
                      ? Text(
                          _childName(child).isNotEmpty
                              ? _childName(child)[0]
                              : 'C',
                          style: const TextStyle(fontSize: 20),
                        )
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _childName(child),
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        '${child['class_name'] ?? ''} • Roll: ${child['roll_no'] ?? ''}',
                        style: const TextStyle(
                          fontSize: 13,
                          color: ASchoolTheme.mutedText,
                        ),
                      ),
                    ],
                  ),
                ),
                if (selected)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: ASchoolTheme.primary.withAlpha(18),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      'Selected',
                      style: TextStyle(
                        color: ASchoolTheme.primary,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 8,
              children: [
                ESchoolInfoPill(
                  icon: Icons.fact_check_rounded,
                  label: 'Attendance ${child['attendance_pct'] ?? 0}%',
                  color: ASchoolTheme.success,
                ),
                ESchoolInfoPill(
                  icon: Icons.leaderboard_rounded,
                  label: 'Rank #${child['rank'] ?? '-'}',
                  color: ASchoolTheme.primary,
                ),
                ESchoolInfoPill(
                  icon: Icons.currency_rupee_rounded,
                  label: 'Fees Rs ${child['fees_due'] ?? 0}',
                  color: ASchoolTheme.danger,
                ),
              ],
            ),
            if (todayStatus != null && todayStatus.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: todayStatus == 'present'
                      ? ASchoolTheme.success.withAlpha(14)
                      : ASchoolTheme.danger.withAlpha(14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      todayStatus == 'present'
                          ? Icons.check_circle_rounded
                          : Icons.cancel_rounded,
                      color: todayStatus == 'present'
                          ? ASchoolTheme.success
                          : ASchoolTheme.danger,
                      size: 16,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      todayStatus == 'present'
                          ? 'Present today'
                          : 'Absent today',
                      style: TextStyle(
                        color: todayStatus == 'present'
                            ? ASchoolTheme.success
                            : ASchoolTheme.danger,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _QuickActions extends ConsumerWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plugins = ref.watch(pluginProvider);
    final quickActions = [
      const _ParentActionItem(
        icon: Icons.fact_check_rounded,
        label: 'Attendance',
        path: '/attendance',
        color: ASchoolTheme.success,
        moduleKey: 'attendance',
      ),
      const _ParentActionItem(
        icon: Icons.assessment_rounded,
        label: 'Results',
        path: '/results',
        color: ASchoolTheme.secondary,
        moduleKey: 'results',
      ),
      const _ParentActionItem(
        icon: Icons.assignment_rounded,
        label: 'Homework',
        path: '/homework',
        color: ASchoolTheme.warning,
        moduleKey: 'homework',
      ),
      const _ParentActionItem(
        icon: Icons.schedule_rounded,
        label: 'Timetable',
        path: '/timetable',
        color: ASchoolTheme.primary,
        moduleKey: 'timetable',
      ),
      const _ParentActionItem(
        icon: Icons.payment_rounded,
        label: 'Pay Fees',
        path: '/fees',
        color: ASchoolTheme.primary,
        moduleKey: 'fees',
        requiredPlugin: 'fees',
      ),
      const _ParentActionItem(
        icon: Icons.chat_rounded,
        label: 'Chat',
        path: '/chat',
        color: ASchoolTheme.success,
        moduleKey: 'chat',
      ),
    ];

    final moreActions = [
      const _ParentActionItem(
        icon: Icons.subject_rounded,
        label: 'Subjects',
        path: '/subjects',
        color: ASchoolTheme.secondary,
        moduleKey: 'subjects',
      ),
      const _ParentActionItem(
        icon: Icons.person_rounded,
        label: 'Teachers',
        path: '/teachers',
        color: ASchoolTheme.primaryDark,
        moduleKey: 'teachers',
      ),
      const _ParentActionItem(
        icon: Icons.bar_chart_rounded,
        label: 'Reports',
        path: '/reports',
        color: ASchoolTheme.primary,
        moduleKey: 'reports',
        requiredPlugin: 'exams',
      ),
      const _ParentActionItem(
        icon: Icons.beach_access_rounded,
        label: 'Holidays',
        path: '/holidays',
        color: ASchoolTheme.warning,
        moduleKey: 'holidays',
      ),
      const _ParentActionItem(
        icon: Icons.photo_library_rounded,
        label: 'Gallery',
        path: '/gallery',
        color: ASchoolTheme.secondary,
        moduleKey: 'gallery',
      ),
      const _ParentActionItem(
        icon: Icons.campaign_rounded,
        label: 'Notices',
        path: '/notices',
        color: ASchoolTheme.warning,
        moduleKey: 'notices',
      ),
      const _ParentActionItem(
        icon: Icons.directions_bus_rounded,
        label: 'Bus Tracker',
        path: '/bus-tracker',
        color: ASchoolTheme.warning,
        moduleKey: 'bus_tracker',
        customVisible: _busTrackingVisible,
      ),
      const _ParentActionItem(
        icon: Icons.favorite_rounded,
        label: 'Wellbeing',
        path: '/wellbeing',
        color: ASchoolTheme.danger,
        moduleKey: 'wellbeing',
        requiredPlugin: 'wellbeing',
      ),
    ];

    final visibleQuickActions =
        quickActions.where((action) => action.isVisible(plugins)).toList();
    final visibleMoreActions =
        moreActions.where((action) => action.isVisible(plugins)).toList();

    return ESchoolCard(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = _gridColumns(constraints.maxWidth);
          return GridView.count(
            crossAxisCount: columns,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 14,
            crossAxisSpacing: 12,
            childAspectRatio: 0.9,
            children: [
              ...visibleQuickActions.map(
                (action) => _actionBtn(
                  context,
                  action.icon,
                  action.label,
                  action.path,
                  action.color,
                ),
              ),
              if (visibleMoreActions.isNotEmpty)
                _actionBtn(
                  context,
                  Icons.grid_view_rounded,
                  'More Menu',
                  '/dashboard',
                  ASchoolTheme.primaryDark,
                  onTap: () => _showMoreActions(context, visibleMoreActions),
                ),
            ],
          );
        },
      ),
    );
  }

  static bool _busTrackingVisible(PluginState plugins) {
    return plugins.isInstalled('bus_tracking') ||
        plugins.isInstalled('gps_tracking');
  }

  void _showMoreActions(
    BuildContext context,
    List<_ParentActionItem> actions,
  ) {
    CustomBottomSheet.show<void>(
      context: context,
      title: 'Parent More Menu',
      height: MediaQuery.of(context).size.height * 0.68,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = _gridColumns(constraints.maxWidth - 32);
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: GridView.count(
              crossAxisCount: columns,
              mainAxisSpacing: 14,
              crossAxisSpacing: 12,
              childAspectRatio: 0.9,
              children: actions
                  .map(
                    (action) => _actionBtn(
                      context,
                      action.icon,
                      action.label,
                      action.path,
                      action.color,
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

  Widget _actionBtn(
    BuildContext context,
    IconData icon,
    String label,
    String path,
    Color color, {
    VoidCallback? onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () {
        if (onTap != null) {
          onTap();
        } else {
          context.go(path);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(
          color: color.withAlpha(16),
          borderRadius: BorderRadius.circular(12),
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
              child: Icon(
                icon,
                color: color,
                size: 24,
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
                  fontWeight: FontWeight.w600,
                  color: ASchoolTheme.secondary,
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

class _ParentActionItem {
  final IconData icon;
  final String label;
  final String path;
  final Color color;
  final String moduleKey;
  final String? requiredPlugin;
  final bool Function(PluginState plugins)? customVisible;

  const _ParentActionItem({
    required this.icon,
    required this.label,
    required this.path,
    required this.color,
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

class _GreetingHeader extends StatelessWidget {
  const _GreetingHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(ASchoolTheme.radiusLg),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [ASchoolTheme.primary, ASchoolTheme.primaryDark],
        ),
        boxShadow: [
          BoxShadow(
            color: ASchoolTheme.primary.withAlpha(65),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Namaste!',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 2),
          const NepaliDateDisplay(
            style: TextStyle(color: Colors.white, fontSize: 13),
          ),
          const SizedBox(height: 10),
          Text(
            'Track attendance, fees and notices for your child in one place.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.white.withAlpha(230),
                ),
          ),
        ],
      ),
    );
  }
}

String _childName(Map<String, dynamic> child) {
  final name = child['name']?.toString();
  if (name != null && name.isNotEmpty) return name;
  return 'Child';
}

String _childId(Map<String, dynamic> child) =>
    (child['student_id'] ?? child['id']).toString();
