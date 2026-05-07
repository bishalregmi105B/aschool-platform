import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

final teacherStudentProfileProvider =
    FutureProvider.autoDispose.family<Student, String>((ref, studentId) async {
  final repo = StudentRepository();
  return repo.getProfile(studentId);
});

class TeacherStudentProfileScreen extends ConsumerWidget {
  final String studentId;

  const TeacherStudentProfileScreen({
    super.key,
    required this.studentId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentAsync = ref.watch(teacherStudentProfileProvider(studentId));

    return Scaffold(
      body: studentAsync.when(
        loading: () => const LoadingShimmer(),
        error: (error, _) => ErrorContainer(
          errorMessage: error.toString(),
          onRetry: () => ref.refresh(teacherStudentProfileProvider(studentId)),
        ),
        data: (student) {
          return DefaultTabController(
            length: 2,
            child: Column(
              children: [
                const TabBar(
                  tabs: [
                    Tab(text: 'General'),
                    Tab(text: 'Guardians'),
                  ],
                ),
                Expanded(
                  child: TabBarView(
                    children: [
                      _StudentGeneralTab(student: student),
                      _StudentGuardiansTab(student: student),
                    ],
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

class _StudentGeneralTab extends StatelessWidget {
  final Student student;

  const _StudentGeneralTab({required this.student});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ESchoolCard(
          child: Row(
            children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: ASchoolTheme.primary.withAlpha(20),
                backgroundImage: (student.photoUrl ?? '').trim().isNotEmpty
                    ? NetworkImage(student.photoUrl!)
                    : null,
                child: (student.photoUrl ?? '').trim().isNotEmpty
                    ? null
                    : Text(
                        student.fullName.isEmpty
                            ? '?'
                            : student.fullName.substring(0, 1).toUpperCase(),
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: ASchoolTheme.primary,
                          fontSize: 20,
                        ),
                      ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student.fullName.isEmpty
                          ? 'Unknown Student'
                          : student.fullName,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        if (student.rollNumber != null)
                          'Roll ${student.rollNumber}',
                        if ((student.className ?? '').isNotEmpty)
                          student.className!,
                        if ((student.sectionName ?? '').isNotEmpty)
                          student.sectionName!,
                      ].join(' • '),
                      style: const TextStyle(color: ASchoolTheme.mutedText),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if ((student.studentId ?? '').isNotEmpty)
                          ESchoolInfoPill(
                            icon: Icons.badge_outlined,
                            label: 'ID ${student.studentId}',
                          ),
                        ESchoolInfoPill(
                          icon: Icons.verified_user_outlined,
                          label: (student.status ?? 'active').toUpperCase(),
                          color: (student.status ?? 'active').toLowerCase() ==
                                  'active'
                              ? Colors.green
                              : Colors.orange,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ESchoolCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ESchoolSectionTitle(title: 'Academic Details'),
              const SizedBox(height: 10),
              _DetailRow(label: 'Class', value: student.className),
              _DetailRow(label: 'Section', value: student.sectionName),
              _DetailRow(label: 'Academic Year', value: student.academicYear),
              _DetailRow(
                  label: 'Admission Number', value: student.admissionNumber),
              _DetailRow(
                  label: 'Enrollment Number', value: student.enrollmentNumber),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ESchoolCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ESchoolSectionTitle(title: 'Personal Details'),
              const SizedBox(height: 10),
              _DetailRow(label: 'Gender', value: student.gender),
              _DetailRow(label: 'DOB (AD)', value: student.dobAd),
              _DetailRow(label: 'DOB (BS)', value: student.dobBs),
              _DetailRow(label: 'Blood Group', value: student.bloodGroup),
              _DetailRow(label: 'Nationality', value: student.nationality),
              _DetailRow(label: 'Religion', value: student.religion),
              _DetailRow(label: 'Ethnicity', value: student.ethnicity),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ESchoolCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ESchoolSectionTitle(title: 'Contact'),
              const SizedBox(height: 10),
              _DetailRow(label: 'Phone', value: student.phone),
              _DetailRow(label: 'Email', value: student.email),
              _DetailRow(
                label: 'Address',
                value: _addressText(student.address),
                multiline: true,
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _addressText(Map<String, dynamic>? address) {
    if (address == null || address.isEmpty) return '-';
    final values = <String>[];
    for (final entry in address.entries) {
      final text = entry.value?.toString().trim() ?? '';
      if (text.isNotEmpty) values.add(text);
    }
    return values.isEmpty ? '-' : values.join(', ');
  }
}

class _StudentGuardiansTab extends StatelessWidget {
  final Student student;

  const _StudentGuardiansTab({required this.student});

  @override
  Widget build(BuildContext context) {
    if (student.guardians.isEmpty) {
      return const NoDataContainer(
        title: 'No guardians linked',
        subtitle: 'Guardian profiles for this student are not available yet.',
        icon: Icons.groups_2_outlined,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: student.guardians.length,
      itemBuilder: (context, index) {
        final guardian = student.guardians[index];
        return ESchoolAnimatedEntry(
          index: index,
          child: ESchoolCard(
            margin: const EdgeInsets.only(bottom: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.person_outline),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        guardian.fullName,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    if (guardian.isPrimary)
                      const ESchoolInfoPill(
                        icon: Icons.star_rounded,
                        label: 'Primary',
                        color: Colors.green,
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                _DetailRow(label: 'Relation', value: guardian.relation),
                _DetailRow(label: 'Phone', value: guardian.phone),
                _DetailRow(label: 'Alt Phone', value: guardian.phone2),
                _DetailRow(label: 'Email', value: guardian.email),
                _DetailRow(label: 'Occupation', value: guardian.occupation),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String? value;
  final bool multiline;

  const _DetailRow({
    required this.label,
    required this.value,
    this.multiline = false,
  });

  @override
  Widget build(BuildContext context) {
    final text = (value ?? '').trim();
    final resolved = text.isEmpty ? '-' : text;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment:
            multiline ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 128,
            child: Text(
              label,
              style: const TextStyle(
                color: ASchoolTheme.mutedText,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              resolved,
              style: const TextStyle(fontWeight: FontWeight.w600),
              maxLines: multiline ? 3 : 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
