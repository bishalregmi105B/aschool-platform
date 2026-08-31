import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart' show selectedChildIdProvider;

/// Provider that fetches the full child profile breakdown.
final childProfileProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final studentId = ref.watch(selectedChildIdProvider);
  final res = await ApiClient.instance.get('/parent-app/child-profile',
      queryParameters: studentId != null ? {'student_id': studentId} : null);
  final data = res.data is Map<String, dynamic> ? res.data['data'] : null;
  return data is Map<String, dynamic> ? data : <String, dynamic>{};
});

/// Full detail breakdown of the parent's selected child.
class ChildProfileScreen extends ConsumerWidget {
  const ChildProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(childProfileProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: const CustomAppBar(title: 'Child Profile'),
      body: profile.when(
        loading: () => const LoadingShimmer(),
        error: (e, _) => ErrorContainer(
          errorMessage: 'Could not load profile.',
          onRetry: () => ref.invalidate(childProfileProvider),
        ),
        data: (data) {
          if (data.isEmpty) {
            return const NoDataContainer(
              title: 'No profile data',
              subtitle: 'This child has no profile details yet.',
              icon: Icons.person_search_rounded,
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(childProfileProvider),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _ProfileHeader(data: data),
                const SizedBox(height: 12),
                _InfoCard(title: 'Personal Information', rows: [
                  _row('Admission No.', data['admission_number']),
                  _row('Roll No.', data['roll_no']?.toString()),
                  _row('Class',
                      '${data['class_name'] ?? ''} ${data['section_name'] ?? ''}'.trim()),
                  _row('Academic Year', data['academic_year']),
                  _row('Date of Birth (BS)', data['dob_bs']),
                  _row('Gender', data['gender']),
                  _row('Blood Group', data['blood_group']),
                  _row('Address', data['address']),
                  _row('Status', data['status']),
                ]),
                const SizedBox(height: 12),
                _AttendanceCard(
                    attendance:
                        (data['attendance'] as Map<String, dynamic>?) ?? {}),
                const SizedBox(height: 12),
                _FeesCard(fees: (data['fees'] as Map<String, dynamic>?) ?? {}),
                const SizedBox(height: 12),
                _ResultsCard(
                    results: (data['results'] as Map<String, dynamic>?) ?? {}),
                const SizedBox(height: 12),
                _GuardiansCard(
                    guardians:
                        (data['guardians'] as List<dynamic>?) ?? const []),
                const SizedBox(height: 12),
                _TeachersCard(
                    teachers: (data['teachers'] as List<dynamic>?) ?? const []),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }

  Map<String, String?> _row(String label, dynamic value) =>
      {'label': label, 'value': value?.toString()};
}

// ── header ─────────────────────────────────────────────────────────────
class _ProfileHeader extends StatelessWidget {
  final Map<String, dynamic> data;
  const _ProfileHeader({required this.data});

  @override
  Widget build(BuildContext context) {
    final photo = data['photo_url']?.toString();
    final theme = Theme.of(context);
    return ESchoolCard(
      color: theme.cardColor,
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundImage:
                photo != null && photo.isNotEmpty ? NetworkImage(photo) : null,
            child: photo == null || photo.isEmpty
                ? Text(
                    (data['name'] ?? 'S').toString().isNotEmpty
                        ? data['name'].toString()[0].toUpperCase()
                        : 'S',
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(data['name'] ?? 'Student',
                    style: const TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 3),
                Text(
                  '${data['class_name'] ?? ''} ${data['section_name'] ?? ''} • Roll ${data['roll_no'] ?? '—'}'
                      .trim(),
                  style: TextStyle(
                      fontSize: 13, color: theme.colorScheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── generic info card ──────────────────────────────────────────────────
class _InfoCard extends StatelessWidget {
  final String title;
  final List<Map<String, String?>> rows;
  const _InfoCard({required this.title, required this.rows});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filled = rows.where((r) => (r['value'] ?? '').isNotEmpty).toList();
    return ESchoolCard(
      color: theme.cardColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          if (filled.isEmpty)
            Text('No details yet',
                style: TextStyle(
                    fontSize: 12, color: theme.colorScheme.onSurfaceVariant))
          else
            ...filled.map((r) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 120,
                        child: Text(r['label']!,
                            style: TextStyle(
                                fontSize: 12,
                                color: theme.colorScheme.onSurfaceVariant)),
                      ),
                      Expanded(
                        child: Text(r['value'] ?? '',
                            style: const TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                )),
        ],
      ),
    );
  }
}

// ── attendance ─────────────────────────────────────────────────────────
class _AttendanceCard extends StatelessWidget {
  final Map<String, dynamic> attendance;
  const _AttendanceCard({required this.attendance});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pct = attendance['percentage'];
    return ESchoolCard(
      color: theme.cardColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Attendance',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 10),
          Row(
            children: [
              _Stat(value: '$pct%', label: 'Overall', color: Colors.green),
              _Stat(
                  value: '${attendance['present'] ?? 0}',
                  label: 'Present',
                  color: Colors.blue),
              _Stat(
                  value: '${attendance['absent'] ?? 0}',
                  label: 'Absent',
                  color: Colors.red),
              _Stat(
                  value: '${attendance['late'] ?? 0}',
                  label: 'Late',
                  color: Colors.orange),
            ],
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  const _Stat({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 17, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ],
      ),
    );
  }
}

// ── fees ───────────────────────────────────────────────────────────────
class _FeesCard extends StatelessWidget {
  final Map<String, dynamic> fees;
  const _FeesCard({required this.fees});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final due = (fees['due'] as num?) ?? 0;
    final paid = (fees['paid'] as num?) ?? 0;
    return ESchoolCard(
      color: theme.cardColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Fees',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text('Paid: Rs. ${_fmt(paid)}',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.green)),
              ),
              Expanded(
                child: Text('Due: Rs. ${_fmt(due)}',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: due > 0 ? Colors.red : Colors.green)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _fmt(num v) {
    if (v == v.roundToDouble()) return v.toInt().toString();
    return v.toStringAsFixed(2);
  }
}

// ── results ────────────────────────────────────────────────────────────
class _ResultsCard extends StatelessWidget {
  final Map<String, dynamic> results;
  const _ResultsCard({required this.results});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasAny =
        (results['latest_exam'] ?? results['gpa'] ?? results['grade']) != null;
    return ESchoolCard(
      color: theme.cardColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Latest Results',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          if (!hasAny)
            Text('No published results yet',
                style: TextStyle(
                    fontSize: 12, color: theme.colorScheme.onSurfaceVariant))
          else ...[
            Text(results['latest_exam']?.toString() ?? '',
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Row(
              children: [
                Text('GPA: ${results['gpa'] ?? '—'}',
                    style: const TextStyle(fontSize: 12)),
                const SizedBox(width: 16),
                Text('Grade: ${results['grade'] ?? '—'}',
                    style: const TextStyle(fontSize: 12)),
                const SizedBox(width: 16),
                Text('Rank: ${results['rank'] ?? '—'}',
                    style: const TextStyle(fontSize: 12)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ── guardians ──────────────────────────────────────────────────────────
class _GuardiansCard extends StatelessWidget {
  final List<dynamic> guardians;
  const _GuardiansCard({required this.guardians});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ESchoolCard(
      color: theme.cardColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Guardians',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          if (guardians.isEmpty)
            Text('No guardians recorded',
                style: TextStyle(
                    fontSize: 12, color: theme.colorScheme.onSurfaceVariant))
          else
            ...guardians.map((g) {
              g as Map<String, dynamic>;
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    const Icon(Icons.person_outline, size: 16),
                    const SizedBox(width: 6),
                    Text('${g['name'] ?? ''} (${g['relation'] ?? '—'})',
                        style: const TextStyle(fontSize: 12)),
                    const SizedBox(width: 8),
                    Text(g['phone'] ?? '',
                        style: TextStyle(
                            fontSize: 12,
                            color: theme.colorScheme.onSurfaceVariant)),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

// ── teachers ───────────────────────────────────────────────────────────
class _TeachersCard extends StatelessWidget {
  final List<dynamic> teachers;
  const _TeachersCard({required this.teachers});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ESchoolCard(
      color: theme.cardColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Class Teachers',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          if (teachers.isEmpty)
            Text('No timetable teachers yet',
                style: TextStyle(
                    fontSize: 12, color: theme.colorScheme.onSurfaceVariant))
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: teachers
                  .map((t) => Chip(
                        label: Text(t.toString(),
                            style: const TextStyle(fontSize: 11)),
                        visualDensity: VisualDensity.compact,
                      ))
                  .toList(),
            ),
        ],
      ),
    );
  }
}
