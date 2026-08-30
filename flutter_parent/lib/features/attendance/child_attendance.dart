import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

class ChildAttendance extends ConsumerWidget {
  const ChildAttendance({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedChildId = ref.watch(selectedChildIdForApiProvider);
    final state = ref.watch(parentAttendanceProvider(selectedChildId));

    return state.when(
      loading: () => const LoadingShimmer(),
      error: (err, _) => ErrorContainer(
        errorMessage: err.toString(),
        onRetry: () =>
            ref.invalidate(parentAttendanceProvider(selectedChildId)),
      ),
      data: (data) {
        final records = List<Map<String, dynamic>>.from(data['records'] ?? []);
        final summary = Map<String, dynamic>.from(data['summary'] ?? const {});

        return RefreshIndicator(
          onRefresh: () =>
              ref.refresh(parentAttendanceProvider(selectedChildId).future),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ESchoolCard(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _stat('Present', '${summary['present'] ?? 0}',
                        ASchoolTheme.success),
                    _stat('Absent', '${summary['absent'] ?? 0}',
                        ASchoolTheme.danger),
                    _stat('Late', '${summary['late'] ?? 0}',
                        ASchoolTheme.warning),
                    _stat('Total', '${summary['total_days'] ?? 0}',
                        ASchoolTheme.primary),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              ESchoolCard(
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Attendance Rate'),
                        Text(
                          '${summary['percentage'] ?? 0}%',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: safeDouble(summary['percentage']) / 100,
                      color: ASchoolTheme.success,
                      backgroundColor: ASchoolTheme.success.withAlpha(20),
                      minHeight: 8,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const ESchoolSectionTitle(title: 'Daily Records'),
              const SizedBox(height: 8),
              if (records.isEmpty)
                const NoDataContainer(
                  title: 'No attendance records',
                  subtitle: 'Attendance will appear after it is marked.',
                  icon: Icons.fact_check_rounded,
                )
              else
                ...records.asMap().entries.map(
                      (entry) => ESchoolAnimatedEntry(
                        index: entry.key,
                        child: _recordTile(entry.value),
                      ),
                    ),
            ],
          ),
        );
      },
    );
  }

  Widget _recordTile(Map<String, dynamic> record) {
    final status = record['status'] ?? 'present';
    final studentName = record['student_name']?.toString();
    late Color color;
    late IconData icon;
    switch (status) {
      case 'absent':
        color = ASchoolTheme.danger;
        icon = Icons.cancel_rounded;
        break;
      case 'late':
        color = ASchoolTheme.warning;
        icon = Icons.schedule_rounded;
        break;
      default:
        color = ASchoolTheme.success;
        icon = Icons.check_circle_rounded;
    }

    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 8),
      padding: EdgeInsets.zero,
      child: ListTile(
        leading: Icon(icon, color: color),
        title: Text(
          studentName != null && studentName.isNotEmpty
              ? '${record['date'] ?? ''} • $studentName'
              : (record['date'] ?? ''),
        ),
        subtitle: record['note'] != null ? Text(record['note']) : null,
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: color.withAlpha(20),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            status.toString().toUpperCase(),
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
      ],
    );
  }
}
