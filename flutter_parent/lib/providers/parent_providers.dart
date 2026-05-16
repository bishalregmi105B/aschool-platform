import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ParentDashboardData {
  final List<Map<String, dynamic>> children;
  final List<Map<String, dynamic>> recentNotices;

  const ParentDashboardData({
    required this.children,
    required this.recentNotices,
  });

  factory ParentDashboardData.fromJson(Map<String, dynamic>? json) {
    return ParentDashboardData(
      children: List<Map<String, dynamic>>.from(json?['children'] ?? []),
      recentNotices:
          List<Map<String, dynamic>>.from(json?['recent_notices'] ?? []),
    );
  }
}

final parentDashboardProvider =
    FutureProvider.autoDispose<ParentDashboardData>((ref) async {
  final resp = await ApiClient.instance.get('/parent/dashboard');
  return ParentDashboardData.fromJson(
    Map<String, dynamic>.from(resp.data['data'] ?? {}),
  );
});

final selectedChildIdProvider = StateProvider<String?>((ref) => null);

final selectedChildProvider = Provider<Map<String, dynamic>?>((ref) {
  final dashboard = ref.watch(parentDashboardProvider).valueOrNull;
  final children = dashboard?.children ?? const <Map<String, dynamic>>[];
  if (children.isEmpty) return null;

  final selectedId = ref.watch(selectedChildIdProvider);
  if (selectedId == null) return children.first;

  for (final child in children) {
    if (_childId(child) == selectedId) return child;
  }
  return children.first;
});

final selectedChildIdForApiProvider = Provider<String?>((ref) {
  final child = ref.watch(selectedChildProvider);
  return child == null ? null : _childId(child);
});

final parentAttendanceProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String?>(
  (ref, studentId) async {
    final resp = await ApiClient.instance.get(
      '/parent/child-attendance',
      queryParameters: _studentQuery(studentId),
    );
    return Map<String, dynamic>.from(resp.data['data'] ?? {});
  },
);

final parentResultsProvider =
    FutureProvider.autoDispose.family<List<ExamResult>, String?>(
  (ref, studentId) async {
    if (studentId == null || studentId.isEmpty) return const [];
    final repo = ref.read(examRepositoryProvider);
    return repo.getResults(studentId: studentId);
  },
);

final parentMarksheetProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, ({String examId, String studentId})>(
  (ref, args) async {
    final repo = ref.read(examRepositoryProvider);
    return repo.getMarksheet(args.examId, args.studentId);
  },
);

final parentTimetableProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String?>(
  (ref, studentId) async {
    final resp = await ApiClient.instance.get(
      '/parent/child-timetable',
      queryParameters: _studentQuery(studentId),
    );
    final data = Map<String, dynamic>.from(resp.data['data'] ?? {});
    return List<Map<String, dynamic>>.from(data['periods'] ?? const []);
  },
);

final parentFeesProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String?>(
  (ref, studentId) async {
    final resp = await ApiClient.instance.get(
      '/parent/outstanding-fees',
      queryParameters: _studentQuery(studentId),
    );
    return List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
  },
);

final parentWellbeingProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String?>(
  (ref, studentId) async {
    final resp = await ApiClient.instance.get(
      '/parent/child-wellbeing',
      queryParameters: _studentQuery(studentId),
    );
    return Map<String, dynamic>.from(resp.data['data'] ?? {});
  },
);

final parentConferencesProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String?>(
  (ref, studentId) async {
    final resp = await ApiClient.instance.get(
      '/parent/conferences',
      queryParameters: _studentQuery(studentId),
    );
    final raw = resp.data['data'];
    if (raw is List) {
      return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return const [];
  },
);

final parentDismissalProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String?>(
  (ref, studentId) async {
    final resp = await ApiClient.instance.get(
      '/parent/dismissal-status',
      queryParameters: _studentQuery(studentId),
    );
    return Map<String, dynamic>.from(resp.data['data'] ?? {});
  },
);

Map<String, dynamic> parentStudentQuery(String? studentId) =>
    _studentQuery(studentId);

Map<String, dynamic> _studentQuery(String? studentId) {
  if (studentId == null || studentId.isEmpty) return const {};
  return {'student_id': studentId};
}

String _childId(Map<String, dynamic> child) =>
    (child['student_id'] ?? child['id']).toString();
