import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

final classStudentsListProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.instance.get('/teacher/my-students');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
});

final classStudentsSearchProvider =
    StateProvider.autoDispose<String>((ref) => '');

final filteredClassStudentsProvider =
    Provider.autoDispose<AsyncValue<List<Map<String, dynamic>>>>((ref) {
  final studentsAsync = ref.watch(classStudentsListProvider);
  final searchQuery = ref.watch(classStudentsSearchProvider).toLowerCase();

  return studentsAsync.whenData((students) {
    if (searchQuery.isEmpty) return students;
    return students
        .where((s) =>
            (s['name'] ?? '').toString().toLowerCase().contains(searchQuery))
        .toList();
  });
});

class ClassStudentsScreen extends ConsumerWidget {
  const ClassStudentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filteredStudentsAsync = ref.watch(filteredClassStudentsProvider);

    return Scaffold(
      body: Column(
        children: [
          // Search Bar
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search students by name...',
                prefixIcon:
                    const Icon(Icons.search_rounded, color: Colors.grey),
                filled: true,
                fillColor: Colors.grey.shade50,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
              onChanged: (v) =>
                  ref.read(classStudentsSearchProvider.notifier).state = v,
            ),
          ),
          const Divider(height: 1),

          // Student List
          Expanded(
            child: PullToRefresh(
              onRefresh: () => ref.refresh(classStudentsListProvider.future),
              child: filteredStudentsAsync.when(
                loading: () => const ShimmerLoadingList(),
                error: (err, stack) => ErrorContainer(
                  errorMessage: err.toString(),
                  onRetry: () => ref.refresh(classStudentsListProvider.future),
                ),
                data: (students) {
                  if (students.isEmpty) {
                    return const NoDataContainer(
                      title: 'No students found',
                      subtitle: 'Try adjusting your search query.',
                      icon: Icons.person_search_rounded,
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: students.length,
                    itemBuilder: (context, index) =>
                        _StudentCard(student: students[index]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StudentCard extends StatelessWidget {
  final Map<String, dynamic> student;

  const _StudentCard({required this.student});

  @override
  Widget build(BuildContext context) {
    final attendance = (student['attendance_pct'] ?? 0).toDouble();
    final studentId = student['id']?.toString();
    final isGoodAttendance = attendance >= 80;
    final isAverageAttendance = attendance >= 60 && attendance < 80;

    final attColor = isGoodAttendance
        ? Colors.green
        : (isAverageAttendance ? Colors.orange : Colors.red);
    final attIcon = isGoodAttendance
        ? Icons.trending_up_rounded
        : (isAverageAttendance
            ? Icons.trending_flat_rounded
            : Icons.trending_down_rounded);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 0,
      color: Colors.white,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade200),
          borderRadius: BorderRadius.circular(16),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: (studentId == null || studentId.isEmpty)
              ? null
              : () => context.push('/students/$studentId'),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: ASchoolTheme.primary.withAlpha(20),
                  backgroundImage: student['photo_url'] != null
                      ? NetworkImage(student['photo_url'])
                      : null,
                  child: student['photo_url'] == null
                      ? Text(
                          (student['name'] ?? '?')
                              .toString()
                              .substring(0, 1)
                              .toUpperCase(),
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: ASchoolTheme.primary,
                              fontSize: 20),
                        )
                      : null,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        student['name'] ?? 'Unknown Student',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 16),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Roll: ${student['roll_no']}  •  ${student['class_name'] ?? ''}',
                        style: TextStyle(
                            color: Colors.grey.shade600,
                            fontSize: 13,
                            fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: attColor.withAlpha(20),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(attIcon, size: 14, color: attColor),
                          const SizedBox(width: 4),
                          Text(
                            '${attendance.toStringAsFixed(0)}%',
                            style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: attColor,
                                fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text('Attendance',
                        style: TextStyle(
                            fontSize: 10,
                            color: Colors.grey.shade500,
                            fontWeight: FontWeight.w600)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
