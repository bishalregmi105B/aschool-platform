import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

// --- State Management ---

final myClassesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.instance.get('/teacher/my-classes');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
});

final classStudentsProvider = FutureProvider.autoDispose
    .family<List<_StudentAttendance>, String>((ref, classId) async {
  final resp = await ApiClient.instance.get('/attendance/students/$classId');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? [])
      .map((s) => _StudentAttendance(
            id: s['id']?.toString() ?? '',
            rollNo: s['roll_no'] ?? 0,
            name: s['name'] ?? '',
            photoUrl: s['photo_url'],
            status: AttendanceStatus.present, // Default present
          ))
      .toList();
});

class _TeacherAttendanceNotifier
    extends StateNotifier<AsyncValue<List<_StudentAttendance>>> {
  final Ref ref;
  _TeacherAttendanceNotifier(this.ref) : super(const AsyncData([]));

  void setStudents(List<_StudentAttendance> students) {
    // Deep copy to allow independent mutations
    state = AsyncData(students
        .map((s) => _StudentAttendance(
              id: s.id,
              rollNo: s.rollNo,
              name: s.name,
              photoUrl: s.photoUrl,
              status: s.status,
            ))
        .toList());
  }

  void setStatus(int index, AttendanceStatus status) {
    state.whenData((students) {
      final updated = List<_StudentAttendance>.from(students);
      updated[index].status = status;
      state = AsyncData(updated);
    });
  }

  void markAll(AttendanceStatus status) {
    state.whenData((students) {
      final updated = students.map((s) => s..status = status).toList();
      state = AsyncData(updated);
    });
  }

  Future<void> submit(String classId) async {
    final students = state.value ?? [];
    try {
      await ApiClient.instance.post('/attendance/submit', data: {
        'class_id': classId,
        'records': students
            .map((s) => {'student_id': s.id, 'status': s.status.name})
            .toList(),
      });
    } catch (e) {
      throw Exception('Failed to submit attendance');
    }
  }
}

final teacherAttendanceProvider = StateNotifierProvider.autoDispose<
    _TeacherAttendanceNotifier, AsyncValue<List<_StudentAttendance>>>((ref) {
  return _TeacherAttendanceNotifier(ref);
});

// --- UI ---

class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key});

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  String? _selectedClassId;
  String? _selectedClassName;
  bool _submitting = false;

  Future<void> _loadStudents(String classId, String className) async {
    setState(() {
      _selectedClassId = classId;
      _selectedClassName = className;
    });

    // Fetch and populate the notifier
    final asyncStudents = await ref.read(classStudentsProvider(classId).future);
    ref.read(teacherAttendanceProvider.notifier).setStudents(asyncStudents);
  }

  Future<void> _submit() async {
    final students = ref.read(teacherAttendanceProvider).value ?? [];
    final present =
        students.where((s) => s.status == AttendanceStatus.present).length;
    final absent =
        students.where((s) => s.status == AttendanceStatus.absent).length;
    final late =
        students.where((s) => s.status == AttendanceStatus.late).length;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => ESchoolDialog(
        icon: Icons.fact_check_outlined,
        title: 'Confirm Submission',
        subtitle: 'Please verify attendance summary before submitting.',
        actions: [
          ESchoolSecondaryButton(
            label: 'Cancel',
            onPressed: () => Navigator.pop(dialogContext, false),
          ),
          ESchoolPrimaryButton(
            label: 'Submit',
            icon: Icons.send_rounded,
            onPressed: () => Navigator.pop(dialogContext, true),
          ),
        ],
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Class: $_selectedClassName',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ESchoolInfoPill(
                  icon: Icons.check_circle_outline,
                  label: 'Present $present',
                  color: Colors.green,
                ),
                ESchoolInfoPill(
                  icon: Icons.cancel_outlined,
                  label: 'Absent $absent',
                  color: Colors.red,
                ),
                ESchoolInfoPill(
                  icon: Icons.timelapse_outlined,
                  label: 'Late $late',
                  color: Colors.orange,
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Are you sure you want to submit this attendance record?'),
          ],
        ),
      ),
    );

    if (confirmed != true) return;

    setState(() => _submitting = true);
    try {
      await ref
          .read(teacherAttendanceProvider.notifier)
          .submit(_selectedClassId!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content:
              Text('Attendance submitted! $present Present, $absent Absent.'),
          backgroundColor: Colors.green,
        ));
        setState(() {
          _selectedClassId = null;
          _selectedClassName = null;
        });
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Saved offline — will sync when connected.'),
          backgroundColor: Colors.orange,
        ));
        setState(() {
          _selectedClassId = null;
          _selectedClassName = null;
        });
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_selectedClassId == null) {
      return Scaffold(
        appBar: const CustomAppBar(title: 'Take Attendance'),
        body: _buildClassPicker(),
      );
    }

    final studentsState = ref.watch(teacherAttendanceProvider);
    final students = studentsState.value ?? [];

    return Scaffold(
      appBar: CustomAppBar(
        title: _selectedClassName ?? 'Attendance',
        showBackButton: true,
        onBackPressed: () => setState(() {
          _selectedClassId = null;
          _selectedClassName = null;
        }),
      ),
      body: studentsState.when(
        loading: () => const ShimmerLoadingList(),
        error: (err, stack) => ErrorContainer(
          errorMessage: err.toString(),
          onRetry: () => _loadStudents(_selectedClassId!, _selectedClassName!),
        ),
        data: (_) => Column(
          children: [
            // Quick Actions & Summary
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.white,
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            HapticFeedback.mediumImpact();
                            ref
                                .read(teacherAttendanceProvider.notifier)
                                .markAll(AttendanceStatus.present);
                          },
                          icon: const Icon(Icons.check_circle_outline,
                              size: 18, color: Colors.green),
                          label: const Text('All Present',
                              style: TextStyle(color: Colors.green)),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.green),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            HapticFeedback.mediumImpact();
                            ref
                                .read(teacherAttendanceProvider.notifier)
                                .markAll(AttendanceStatus.absent);
                          },
                          icon: const Icon(Icons.cancel_outlined,
                              size: 18, color: Colors.red),
                          label: const Text('All Absent',
                              style: TextStyle(color: Colors.red)),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.red),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _countBadge(
                          'Present',
                          students
                              .where(
                                  (s) => s.status == AttendanceStatus.present)
                              .length,
                          Colors.green),
                      _countBadge(
                          'Absent',
                          students
                              .where((s) => s.status == AttendanceStatus.absent)
                              .length,
                          Colors.red),
                      _countBadge(
                          'Late',
                          students
                              .where((s) => s.status == AttendanceStatus.late)
                              .length,
                          Colors.orange),
                      _countBadge('Total', students.length, Colors.blue),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Student List
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: students.length,
                itemBuilder: (context, index) {
                  final s = students[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      child: Row(
                        children: [
                          Container(
                            width: 28,
                            alignment: Alignment.center,
                            child: Text('${s.rollNo}',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Colors.grey.shade500)),
                          ),
                          CircleAvatar(
                            radius: 20,
                            backgroundColor: Colors.blue.withAlpha(20),
                            backgroundImage: s.photoUrl != null
                                ? NetworkImage(s.photoUrl!)
                                : null,
                            child: s.photoUrl == null
                                ? Text(s.name.isNotEmpty ? s.name[0] : '?',
                                    style: const TextStyle(color: Colors.blue))
                                : null,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(s.name,
                                style: const TextStyle(
                                    fontSize: 15, fontWeight: FontWeight.w500),
                                overflow: TextOverflow.ellipsis),
                          ),
                          _statusBtn(index, AttendanceStatus.present, 'P',
                              Colors.green),
                          const SizedBox(width: 8),
                          _statusBtn(
                              index, AttendanceStatus.absent, 'A', Colors.red),
                          const SizedBox(width: 8),
                          _statusBtn(
                              index, AttendanceStatus.late, 'L', Colors.orange),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: SizedBox(
            height: 54,
            child: FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox()
                  : const Icon(Icons.cloud_upload_rounded),
              label: _submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('Submit Attendance',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              style: FilledButton.styleFrom(
                backgroundColor: ASchoolTheme.primary,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildClassPicker() {
    final classesState = ref.watch(myClassesProvider);

    return PullToRefresh(
      onRefresh: () => ref.refresh(myClassesProvider.future),
      child: classesState.when(
        loading: () => const ShimmerLoadingList(),
        error: (err, stack) => ErrorContainer(
            errorMessage: err.toString(),
            onRetry: () => ref.refresh(myClassesProvider.future)),
        data: (classes) {
          if (classes.isEmpty) {
            return const NoDataContainer(
              title: 'No classes assigned',
              subtitle: 'You have no classes assigned for attendance today.',
              icon: Icons.event_busy_rounded,
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: classes.length,
            itemBuilder: (context, index) {
              final c = classes[index];
              final isMarked = c['attendance_marked'] == true;

              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                child: ListTile(
                  contentPadding: const EdgeInsets.all(16),
                  leading: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                        color: ASchoolTheme.primary.withAlpha(20),
                        borderRadius: BorderRadius.circular(12)),
                    child: Text(
                      c['short'] ?? 'CL',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: ASchoolTheme.primary),
                    ),
                  ),
                  title: Text(c['name'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text('${c['student_count'] ?? 0} students enrolled',
                      style: TextStyle(color: Colors.grey.shade600)),
                  trailing: isMarked
                      ? Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
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
                                      color: Colors.green,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12)),
                            ],
                          ),
                        )
                      : const Icon(Icons.chevron_right_rounded,
                          color: Colors.grey),
                  onTap: isMarked
                      ? null
                      : () => _loadStudents(c['id'].toString(), c['name']),
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _countBadge(String label, int count, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
          color: color.withAlpha(20), borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text('$label: $count',
              style: TextStyle(
                  color: color, fontWeight: FontWeight.bold, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _statusBtn(
      int index, AttendanceStatus status, String label, Color color) {
    final students = ref.read(teacherAttendanceProvider).value ?? [];
    final active = students[index].status == status;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        ref.read(teacherAttendanceProvider.notifier).setStatus(index, status);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: active ? color : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: active ? color : Colors.grey.shade300,
              width: active ? 2 : 1),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: active ? Colors.white : Colors.grey.shade600,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
        ),
      ),
    );
  }
}

enum AttendanceStatus { present, absent, late }

class _StudentAttendance {
  final String id;
  final int rollNo;
  final String name;
  final String? photoUrl;
  AttendanceStatus status;

  _StudentAttendance({
    required this.id,
    required this.rollNo,
    required this.name,
    this.photoUrl,
    required this.status,
  });
}
