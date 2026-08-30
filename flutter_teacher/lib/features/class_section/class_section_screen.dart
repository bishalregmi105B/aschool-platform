/// Class Section Screen — Rich dashboard of all teacher's assigned classes
/// Shows real class data, student list with progress, and class stats
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

// ─── Providers ───────────────────────────────────────────────────────────────

final teacherClassesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.instance.get('/teacher/my-classes');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
});

final classStudentsDetailProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, classId) async {
  final resp = await ApiClient.instance
      .get('/teacher/my-students?class_id=$classId');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
});

// ─── Screen ──────────────────────────────────────────────────────────────────

class ClassSectionScreen extends ConsumerStatefulWidget {
  const ClassSectionScreen({super.key});

  @override
  ConsumerState<ClassSectionScreen> createState() => _ClassSectionScreenState();
}

class _ClassSectionScreenState extends ConsumerState<ClassSectionScreen> {
  String? _selectedClassId;
  Map<String, dynamic>? _selectedClass;

  @override
  Widget build(BuildContext context) {
    if (_selectedClassId != null && _selectedClass != null) {
      return _ClassDetailView(
        classData: _selectedClass!,
        onBack: () => setState(() {
          _selectedClassId = null;
          _selectedClass = null;
        }),
      );
    }

    return Scaffold(
      body: _buildClassList(),
    );
  }

  Widget _buildClassList() {
    final classesState = ref.watch(teacherClassesProvider);

    return PullToRefresh(
      onRefresh: () => ref.refresh(teacherClassesProvider.future),
      child: classesState.when(
        loading: () => const ShimmerLoadingList(),
        error: (e, _) => ErrorContainer(
          errorMessage: e.toString(),
          onRetry: () => ref.refresh(teacherClassesProvider.future),
        ),
        data: (classes) {
          if (classes.isEmpty) {
            return const NoDataContainer(
              title: 'No Classes Assigned',
              subtitle: 'You have no classes assigned to you yet.',
              icon: Icons.class_outlined,
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: classes.length,
            itemBuilder: (context, i) {
              final c = classes[i];
              return _ClassCard(
                classData: c,
                index: i,
                onTap: () => setState(() {
                  _selectedClassId = c['id']?.toString();
                  _selectedClass = c;
                }),
              );
            },
          );
        },
      ),
    );
  }
}

// ─── Class Card ──────────────────────────────────────────────────────────────

class _ClassCard extends StatelessWidget {
  final Map<String, dynamic> classData;
  final int index;
  final VoidCallback onTap;

  const _ClassCard(
      {required this.classData, required this.index, required this.onTap});

  static const _colors = [
    Color(0xFF3B82F6), // blue
    Color(0xFF10B981), // green
    Color(0xFF8B5CF6), // purple
    Color(0xFFF59E0B), // amber
    Color(0xFFEF4444), // red
  ];

  @override
  Widget build(BuildContext context) {
    final color = _colors[index % _colors.length];
    final name = safeStringOrNull(classData['name']) ?? 'Class';
    final shortName = safeStringOrNull(classData['short']) ??
        (name.length > 3 ? name.substring(0, 3).toUpperCase() : name);
    final studentCount = safeIntOrNull(classData['student_count']) ?? 0;
    final isClassTeacher = safeBool(classData['is_class_teacher'], fallback: false);

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.grey.shade100),
          ),
          child: Column(
            children: [
              // Header band
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: BoxDecoration(
                  color: color.withAlpha(15),
                  borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(20)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Center(
                        child: Text(
                          shortName,
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 16),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 17)),
                          if (isClassTeacher)
                            Container(
                              margin: const EdgeInsets.only(top: 4),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: color,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text('Class Teacher',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold)),
                            ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: Colors.grey),
                  ],
                ),
              ),
              // Stats row
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    _StatPill(
                        icon: Icons.groups_rounded,
                        label: '$studentCount Students',
                        color: color),
                    const SizedBox(width: 10),
                    _StatPill(
                        icon: Icons.menu_book_rounded,
                        label: '${classData['subject_count'] ?? 0} Subjects',
                        color: Colors.grey.shade600),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _StatPill(
      {required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withAlpha(15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(label,
              style: TextStyle(
                  fontSize: 12, color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// ─── Class Detail View ───────────────────────────────────────────────────────

class _ClassDetailView extends ConsumerStatefulWidget {
  final Map<String, dynamic> classData;
  final VoidCallback onBack;

  const _ClassDetailView({required this.classData, required this.onBack});

  @override
  ConsumerState<_ClassDetailView> createState() => _ClassDetailViewState();
}

class _ClassDetailViewState extends ConsumerState<_ClassDetailView>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _searchCtrl = TextEditingController();
  String _search = '';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final name = safeStringOrNull(widget.classData['name']) ?? 'Class';
    final classId = widget.classData['id']?.toString() ?? '';
    final studentCount = safeIntOrNull(widget.classData['student_count']) ?? 0;

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        leading: BackButton(onPressed: widget.onBack),
        title: Text(name,
            style:
                const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(
                icon: const Icon(Icons.groups_rounded),
                text: 'Students ($studentCount)'),
            const Tab(icon: Icon(Icons.bar_chart_rounded), text: 'Overview'),
          ],
          labelColor: ASchoolTheme.primary,
          unselectedLabelColor: Colors.grey,
          indicatorColor: ASchoolTheme.primary,
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _StudentsTab(
            classId: classId,
            searchCtrl: _searchCtrl,
            search: _search,
            onSearchChanged: (v) => setState(() => _search = v),
          ),
          _OverviewTab(classData: widget.classData),
        ],
      ),
    );
  }
}

// ─── Students Tab ─────────────────────────────────────────────────────────────

class _StudentsTab extends ConsumerWidget {
  final String classId;
  final TextEditingController searchCtrl;
  final String search;
  final ValueChanged<String> onSearchChanged;

  const _StudentsTab({
    required this.classId,
    required this.searchCtrl,
    required this.search,
    required this.onSearchChanged,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentsState = ref.watch(classStudentsDetailProvider(classId));

    return Column(
      children: [
        // Search bar
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: TextField(
            controller: searchCtrl,
            onChanged: onSearchChanged,
            decoration: InputDecoration(
              hintText: 'Search student by name or roll no...',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              suffixIcon: search.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, size: 18),
                      onPressed: () {
                        searchCtrl.clear();
                        onSearchChanged('');
                      },
                    )
                  : null,
              filled: true,
              fillColor: Colors.grey.shade50,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
            ),
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: studentsState.when(
            loading: () => const ShimmerLoadingList(),
            error: (e, _) => ErrorContainer(
              errorMessage: e.toString(),
              onRetry: () =>
                  ref.refresh(classStudentsDetailProvider(classId)),
            ),
            data: (students) {
              final filtered = search.isEmpty
                  ? students
                  : students
                      .where((s) =>
                          (safeStringOrNull(s['name']) ?? '')
                              .toLowerCase()
                              .contains(search.toLowerCase()) ||
                          (s['roll_no'] ?? '').toString().contains(search))
                      .toList();

              if (filtered.isEmpty) {
                return NoDataContainer(
                  title: search.isNotEmpty
                      ? 'No students match "$search"'
                      : 'No students enrolled',
                  icon: Icons.person_search_rounded,
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: filtered.length,
                itemBuilder: (context, i) {
                  final s = filtered[i];
                  return _StudentListTile(student: s);
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

class _StudentListTile extends StatelessWidget {
  final Map<String, dynamic> student;

  const _StudentListTile({required this.student});

  @override
  Widget build(BuildContext context) {
    final name = safeStringOrNull(student['name']) ?? 'Student';
    final rollNo = student['roll_no'] ?? student['roll_number'] ?? '';
    final photoUrl = safeStringOrNull(student['photo_url']);
    final attendancePct = safeNumOrNull(student['attendance_percent']);
    final studentId = student['id']?.toString() ?? '';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 0,
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        onTap: () => context.push('/students/$studentId'),
        leading: CircleAvatar(
          radius: 22,
          backgroundColor: ASchoolTheme.primary.withAlpha(30),
          backgroundImage:
              photoUrl != null ? NetworkImage(photoUrl) : null,
          child: photoUrl == null
              ? Text(
                  name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: const TextStyle(
                      color: ASchoolTheme.primary,
                      fontWeight: FontWeight.bold),
                )
              : null,
        ),
        title: Text(name,
            style:
                const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text('Roll No. $rollNo',
            style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
        trailing: attendancePct != null
            ? _AttendanceBadge(percent: attendancePct.toDouble())
            : const Icon(Icons.chevron_right_rounded,
                color: Colors.grey, size: 18),
      ),
    );
  }
}

class _AttendanceBadge extends StatelessWidget {
  final double percent;

  const _AttendanceBadge({required this.percent});

  @override
  Widget build(BuildContext context) {
    Color color;
    if (percent >= 80) {
      color = Colors.green;
    } else if (percent >= 60) {
      color = Colors.orange;
    } else {
      color = Colors.red;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Text(
        '${percent.toStringAsFixed(0)}%',
        style: TextStyle(
            color: color, fontWeight: FontWeight.bold, fontSize: 12),
      ),
    );
  }
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  final Map<String, dynamic> classData;

  const _OverviewTab({required this.classData});

  @override
  Widget build(BuildContext context) {
    final name = safeStringOrNull(classData['name']) ?? 'Class';
    final studentCount = safeIntOrNull(classData['student_count']) ?? 0;
    final subjectCount = safeIntOrNull(classData['subject_count']) ?? 0;
    final isClassTeacher = safeBool(classData['is_class_teacher'], fallback: false);
    final academicYear = safeStringOrNull(classData['academic_year']);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Info card
        Card(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          elevation: 0,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.class_rounded,
                        color: ASchoolTheme.primary, size: 22),
                    const SizedBox(width: 10),
                    Text(name,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 18)),
                  ],
                ),
                const Divider(height: 24),
                _InfoRow(label: 'Total Students', value: '$studentCount'),
                _InfoRow(label: 'Subjects', value: '$subjectCount'),
                if (academicYear != null)
                  _InfoRow(label: 'Academic Year', value: academicYear),
                _InfoRow(
                    label: 'Role',
                    value: isClassTeacher ? 'Class Teacher' : 'Subject Teacher'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Quick Actions
        const Text('Quick Actions',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _ActionCard(
              icon: Icons.fact_check_rounded,
              label: 'Take Attendance',
              color: Colors.blue,
              onTap: () => context.go('/attendance'),
            ),
            _ActionCard(
              icon: Icons.assignment_rounded,
              label: 'Assignments',
              color: Colors.orange,
              onTap: () => context.go('/assignments'),
            ),
            _ActionCard(
              icon: Icons.menu_book_rounded,
              label: 'Lessons',
              color: Colors.purple,
              onTap: () => context.go('/lessons'),
            ),
            _ActionCard(
              icon: Icons.edit_note_rounded,
              label: 'Marks Entry',
              color: Colors.green,
              onTap: () => context.go('/marks'),
            ),
          ],
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
          Text(value,
              style: const TextStyle(
                  fontWeight: FontWeight.w600, fontSize: 14)),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionCard(
      {required this.icon,
      required this.label,
      required this.color,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: (MediaQuery.of(context).size.width - 56) / 2,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(label,
                style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w600,
                    fontSize: 13),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
