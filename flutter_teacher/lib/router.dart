import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

import 'screens/shell_screen.dart';
import 'features/dashboard/teacher_dashboard.dart';
import 'features/attendance/attendance_screen.dart';
import 'features/marks/marks_entry_screen.dart';
import 'features/assignments/assignments_screen.dart';
import 'features/timetable/timetable_screen.dart';
import 'features/ai_tools/teacher_ai_screen.dart';
import 'features/students/class_students_screen.dart';
import 'features/students/student_profile_screen.dart';
import 'features/notices/teacher_notices_screen.dart';
import 'features/class_section/class_section_screen.dart';
import 'features/lessons/create_lesson_screen.dart';
import 'features/lessons/create_topic_screen.dart';
import 'features/holidays/holiday_list_screen.dart';
import 'features/exams/offline_exam_screen.dart';
import 'features/exams/online_exam_screen.dart';
import 'features/exams/report_cards_screen.dart';
import 'features/diary/student_diary_screen.dart';
import 'features/leave/leave_screen.dart';
import 'features/leave/my_attendance_screen.dart';
import 'features/payroll/payroll_slips_screen.dart';
import 'features/announcements/announcement_screen.dart';
import 'features/library/teacher_library_screen.dart';
import 'features/wellbeing/student_wellbeing_screen.dart';
import 'features/portfolio/student_portfolios_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorDashboardKey =
    GlobalKey<NavigatorState>(debugLabel: 'dashboardShell');
final _shellNavigatorAttendanceKey =
    GlobalKey<NavigatorState>(debugLabel: 'attendanceShell');
final _shellNavigatorMarksKey =
    GlobalKey<NavigatorState>(debugLabel: 'marksShell');
final _shellNavigatorAIToolsKey =
    GlobalKey<NavigatorState>(debugLabel: 'aiToolsShell');

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
            ),
          ),
        ),
      );
    },
    redirect: (context, state) {
      final loggedIn = authUser != null;
      final onLogin = state.matchedLocation == '/login';
      if (!loggedIn && !onLogin) return '/login';
      if (loggedIn && onLogin) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => SharedLoginScreen(
          appTitle: 'ASchool Teacher',
          loginType: LoginType.staff,
          onLoginSuccess: () {
            context.go('/dashboard');
          },
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return TeacherShellScreen(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            navigatorKey: _shellNavigatorDashboardKey,
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (context, state) => const TeacherDashboard(),
              ),
              // Sub-routes accessed from Dashboard or Drawer
              GoRoute(
                  path: '/class-section',
                  builder: (_, __) => const ClassSectionScreen()),
              GoRoute(
                  path: '/students',
                  builder: (_, __) => const ClassStudentsScreen()),
              GoRoute(
                path: '/students/:studentId',
                builder: (_, state) => TeacherStudentProfileScreen(
                  studentId: state.pathParameters['studentId']!,
                ),
              ),
              GoRoute(
                  path: '/lessons',
                  builder: (_, __) => const CreateLessonScreen()),
              GoRoute(
                  path: '/topics',
                  builder: (_, __) => const CreateTopicScreen()),
              GoRoute(
                  path: '/timetable',
                  builder: (_, __) => const TimetableScreen()),
              GoRoute(
                  path: '/holidays',
                  builder: (_, __) => const HolidayListScreen()),
              GoRoute(
                  path: '/assignments',
                  builder: (_, __) => const AssignmentsScreen()),
              GoRoute(
                  path: '/offline-exam',
                  builder: (_, __) => const OfflineExamScreen()),
              GoRoute(
                  path: '/online-exam',
                  builder: (_, __) => const OnlineExamScreen()),
              GoRoute(
                  path: '/report-cards',
                  builder: (_, __) => const TeacherReportCardsScreen()),
              GoRoute(
                  path: '/diary',
                  builder: (_, __) => const StudentDiaryScreen()),
              GoRoute(
                  path: '/announcements',
                  builder: (_, __) => const AnnouncementScreen()),
              GoRoute(
                  path: '/notices',
                  builder: (_, __) => const TeacherNoticesScreen()),
              GoRoute(
                  path: '/chat',
                  builder: (_, __) => const SharedChatScreen(title: 'Chat')),
              GoRoute(path: '/leave', builder: (_, __) => const LeaveScreen()),
              GoRoute(
                  path: '/my-attendance',
                  builder: (_, __) => const MyAttendanceScreen()),
              GoRoute(
                  path: '/payroll',
                  builder: (_, __) => const PayrollSlipsScreen()),
              GoRoute(
                  path: '/library',
                  builder: (_, __) => const TeacherLibraryScreen()),
              GoRoute(
                  path: '/student-wellbeing',
                  builder: (_, __) => const StudentWellbeingScreen()),
              GoRoute(
                  path: '/portfolios',
                  builder: (_, __) => const StudentPortfoliosScreen()),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _shellNavigatorAttendanceKey,
            routes: [
              GoRoute(
                path: '/attendance',
                builder: (context, state) => const AttendanceScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _shellNavigatorMarksKey,
            routes: [
              GoRoute(
                path: '/marks',
                builder: (context, state) => const MarksEntryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: _shellNavigatorAIToolsKey,
            routes: [
              GoRoute(
                path: '/ai-tools',
                builder: (context, state) => const TeacherAiScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
