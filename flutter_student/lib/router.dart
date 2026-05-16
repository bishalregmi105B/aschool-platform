import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

import 'screens/shell_screen.dart';
import 'features/dashboard/student_dashboard.dart';
import 'features/timetable/student_timetable.dart';
import 'features/homework/homework_screen.dart';
import 'features/results/student_results.dart';
import 'features/results/student_marksheet_screen.dart';
import 'features/library/student_library.dart';
import 'features/lms/student_lms.dart';
import 'features/ai_tutor/ai_tutor_screen.dart';
import 'features/portfolio/portfolio_screen.dart';
import 'features/notices/student_notices.dart';
import 'features/elibrary/elibrary_screen.dart';
import 'features/wellbeing/student_wellbeing.dart';
import 'features/achievements/achievements_screen.dart';
import 'features/subjects/subjects_screen.dart';
import 'features/classmates/classmates_screen.dart';
import 'features/exams/student_exams_screen.dart';
import 'features/diary/student_diary_screen.dart';
import 'features/transport/student_transport_screen.dart';
import 'features/teachers/teachers_list_screen.dart';
import 'features/holidays/holiday_list_screen.dart';
import 'features/gallery/gallery_screen.dart';
import 'features/guardians/guardian_details_screen.dart';
import 'features/profile/student_profile_screen.dart';
import 'features/attendance/student_attendance_screen.dart';
import 'features/health_records/student_health_screen.dart';
import 'features/gamification/gamification_screen.dart';
import 'features/fees/student_fees_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _dashboardNavKey = GlobalKey<NavigatorState>(debugLabel: 'dashboardNav');
final _timetableNavKey = GlobalKey<NavigatorState>(debugLabel: 'timetableNav');
final _homeworkNavKey = GlobalKey<NavigatorState>(debugLabel: 'homeworkNav');
final _resultsNavKey = GlobalKey<NavigatorState>(debugLabel: 'resultsNav');

const Map<String, String> _legacyStudentRouteRedirects = {
  '/notices': '/dashboard/notices',
  '/profile': '/dashboard/profile',
  '/subjects': '/dashboard/subjects',
  '/classmates': '/dashboard/classmates',
  '/exams': '/dashboard/exams',
  '/diary': '/dashboard/diary',
  '/library': '/dashboard/library',
  '/elibrary': '/dashboard/elibrary',
  '/lms': '/dashboard/lms',
  '/ai-tutor': '/dashboard/ai-tutor',
  '/portfolio': '/dashboard/portfolio',
  '/achievements': '/dashboard/achievements',
  '/wellbeing': '/dashboard/wellbeing',
  '/teachers': '/dashboard/teachers',
  '/holidays': '/dashboard/holidays',
  '/gallery': '/dashboard/gallery',
  '/transport': '/dashboard/transport',
  '/guardians': '/dashboard/guardians',
  '/chat': '/dashboard/chat',
};

final routerProvider = Provider<GoRouter>((ref) {
  final authUser = ref.watch(authProvider.select((state) => state.user));
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/dashboard',
    errorBuilder: (context, state) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: NoDataContainer(
              title: 'Page not found',
              subtitle: state.uri.toString(),
              icon: Icons.wrong_location_outlined,
            ),
          ),
        ),
      );
    },
    redirect: (context, state) {
      final loggedIn = authUser != null;
      final loggingIn = state.matchedLocation == '/login';
      if (!loggedIn && !loggingIn) return '/login';
      if (loggedIn && loggingIn) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => SharedLoginScreen(
          appTitle: 'ASchool Student',
          loginType: LoginType.student,
          onLoginSuccess: () => context.go('/dashboard'),
        ),
      ),
      ..._legacyStudentRouteRedirects.entries.map(
        (entry) => GoRoute(
          path: entry.key,
          redirect: (_, __) => entry.value,
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return StudentShellScreen(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            navigatorKey: _dashboardNavKey,
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (context, state) => const StudentDashboard(),
                routes: [
                  // Nested routes can go here, like /dashboard/details
                  GoRoute(
                      path: 'subjects',
                      builder: (_, __) => const SubjectsScreen()),
                  GoRoute(
                      path: 'classmates',
                      builder: (_, __) => const ClassmatesScreen()),
                  GoRoute(
                      path: 'exams',
                      builder: (_, __) => const StudentExamsScreen()),
                  GoRoute(
                      path: 'diary',
                      builder: (_, __) => const StudentDiaryScreen()),
                  GoRoute(
                      path: 'library',
                      builder: (_, __) => const StudentLibrary()),
                  GoRoute(
                      path: 'elibrary',
                      builder: (_, __) => const ELibraryScreen()),
                  GoRoute(path: 'lms', builder: (_, __) => const StudentLMS()),
                  GoRoute(
                      path: 'ai-tutor',
                      builder: (_, __) => const AITutorScreen()),
                  GoRoute(
                      path: 'portfolio',
                      builder: (_, __) => const PortfolioScreen()),
                  GoRoute(
                      path: 'achievements',
                      builder: (_, __) => const AchievementsScreen()),
                  GoRoute(
                      path: 'wellbeing',
                      builder: (_, __) => const StudentWellbeing()),
                  GoRoute(
                      path: 'notices',
                      builder: (_, __) => const StudentNotices()),
                  GoRoute(
                      path: 'chat',
                      builder: (_, __) =>
                          const SharedChatScreen(title: 'Chat')),
                  GoRoute(
                      path: 'teachers',
                      builder: (_, __) => const TeachersListScreen()),
                  GoRoute(
                      path: 'holidays',
                      builder: (_, __) => const HolidayListScreen()),
                  GoRoute(
                      path: 'gallery',
                      builder: (_, __) => const GalleryScreen()),
                  GoRoute(
                      path: 'transport',
                      builder: (_, __) => const StudentTransportScreen()),
                  GoRoute(
                      path: 'guardians',
                      builder: (_, __) => const GuardianDetailsScreen()),
                  GoRoute(
                      path: 'profile',
                      builder: (_, __) => const StudentProfileScreen()),
                  GoRoute(
                      path: 'attendance',
                      builder: (_, __) => const StudentAttendanceScreen()),
                  GoRoute(
                      path: 'health',
                      builder: (_, __) => const StudentHealthScreen()),
                  GoRoute(
                      path: 'gamification',
                      builder: (_, __) => const GamificationScreen()),
                  GoRoute(
                      path: 'fees',
                      builder: (_, __) => const StudentFeesScreen()),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _timetableNavKey,
            routes: [
              GoRoute(
                path: '/timetable',
                builder: (context, state) => const StudentTimetable(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _homeworkNavKey,
            routes: [
              GoRoute(
                path: '/homework',
                builder: (context, state) => const HomeworkScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _resultsNavKey,
            routes: [
              GoRoute(
                path: '/results',
                builder: (context, state) => const StudentResults(),
                routes: [
                  GoRoute(
                    path: 'marksheet/:examId',
                    builder: (context, state) => StudentMarksheetScreen(
                      examId: state.pathParameters['examId'] ?? '',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
