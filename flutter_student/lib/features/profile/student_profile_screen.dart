import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

class StudentProfileScreen extends ConsumerWidget {
  const StudentProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentState = ref.watch(currentStudentProvider);
    final attendanceState = ref.watch(attendanceProvider);
    final assignmentsState = ref.watch(assignmentsProvider);
    final resultsState = ref.watch(resultsProvider);

    return Scaffold(
      appBar: const CustomAppBar(title: 'My Profile'),
      body: studentState.when(
        loading: () => const LoadingShimmer(),
        error: (error, _) => ErrorContainer(
          errorMessage: error.toString(),
          onRetry: () => ref.invalidate(currentStudentProvider),
        ),
        data: (student) {
          if (student == null) {
            return const NoDataContainer(
              title: 'Student profile not found',
              subtitle: 'Please contact your school administrator.',
              icon: Icons.person_search_rounded,
            );
          }

          final attendancePct =
              attendanceState.valueOrNull?.summary.percentage ?? 0;
          final pendingHomework =
              assignmentsState.valueOrNull?.pending.length ?? 0;
          final resultsCount = resultsState.valueOrNull?.length ?? 0;

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(currentStudentProvider);
              ref.invalidate(attendanceProvider);
              ref.invalidate(assignmentsProvider);
              ref.invalidate(resultsProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _ProfileHeader(student: student),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _StatTile(
                        label: 'Attendance',
                        value: '${attendancePct.toStringAsFixed(1)}%',
                        icon: Icons.check_circle_outline,
                        color: Colors.green,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StatTile(
                        label: 'Homework Due',
                        value: '$pendingHomework',
                        icon: Icons.assignment_late_outlined,
                        color: Colors.orange,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StatTile(
                        label: 'Results',
                        value: '$resultsCount',
                        icon: Icons.emoji_events_outlined,
                        color: ASchoolTheme.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Student Details',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _InfoRow(label: 'Student ID', value: student.studentId),
                        _InfoRow(
                            label: 'Admission No',
                            value: student.admissionNumber),
                        _InfoRow(label: 'Class', value: student.className),
                        _InfoRow(label: 'Section', value: student.sectionName),
                        _InfoRow(
                            label: 'Roll Number',
                            value: student.rollNumber?.toString()),
                        _InfoRow(label: 'Email', value: student.email),
                        _InfoRow(label: 'Phone', value: student.phone),
                        _InfoRow(label: 'Status', value: student.status),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'History & Analysis',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            _QuickLinkChip(
                              icon: Icons.schedule_rounded,
                              label: 'Timetable',
                              onTap: () => context.go('/timetable'),
                            ),
                            _QuickLinkChip(
                              icon: Icons.assignment_rounded,
                              label: 'Homework',
                              onTap: () => context.go('/homework'),
                            ),
                            _QuickLinkChip(
                              icon: Icons.emoji_events_rounded,
                              label: 'Results',
                              onTap: () => context.go('/results'),
                            ),
                            _QuickLinkChip(
                              icon: Icons.family_restroom_rounded,
                              label: 'Guardians',
                              onTap: () => context.go('/dashboard/guardians'),
                            ),
                            _QuickLinkChip(
                              icon: Icons.folder_special_rounded,
                              label: 'Portfolio',
                              onTap: () => context.go('/dashboard/portfolio'),
                            ),
                            _QuickLinkChip(
                              icon: Icons.star_rounded,
                              label: 'Achievements',
                              onTap: () =>
                                  context.go('/dashboard/achievements'),
                            ),
                            _QuickLinkChip(
                              icon: Icons.favorite_rounded,
                              label: 'Wellbeing',
                              onTap: () => context.go('/dashboard/wellbeing'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  final Student student;

  const _ProfileHeader({required this.student});

  @override
  Widget build(BuildContext context) {
    final hasPhoto = (student.photoUrl ?? '').isNotEmpty;
    final initial =
        student.fullName.isNotEmpty ? student.fullName[0].toUpperCase() : 'S';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: ASchoolTheme.primary.withAlpha(20),
              backgroundImage:
                  hasPhoto ? NetworkImage(student.photoUrl!) : null,
              child: hasPhoto
                  ? null
                  : Text(
                      initial,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: ASchoolTheme.primary,
                      ),
                    ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    student.fullName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    student.classSection.isEmpty
                        ? 'Class details unavailable'
                        : student.classSection,
                    style: TextStyle(
                      color: Colors.grey.shade700,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String? value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
          Expanded(
            child: Text(
              (value == null || value!.trim().isEmpty) ? '-' : value!,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickLinkChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickLinkChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Ink(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Colors.grey.shade300),
          color: Colors.grey.shade50,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: ASchoolTheme.primary),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
