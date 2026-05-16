import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

import 'screens/shell_screen.dart';
import 'features/dashboard/parent_dashboard.dart';
import 'features/attendance/child_attendance.dart';
import 'features/fees/fee_payment_screen.dart';
import 'features/results/results_screen.dart';
import 'features/bus_tracker/bus_tracking_screen.dart';
import 'features/chat/parent_chat_screen.dart';
import 'features/notices/parent_notices_screen.dart';
import 'features/wellbeing/child_wellbeing_screen.dart';
import 'features/timetable/child_timetable_screen.dart';
import 'features/subjects/child_subjects_screen.dart';
import 'features/teachers/teachers_screen.dart';
import 'features/homework/homework_screen.dart';
import 'features/holidays/holiday_list_screen.dart';
import 'features/gallery/gallery_screen.dart';
import 'features/results/parent_marksheet_screen.dart';
import 'features/reports/child_reports_screen.dart';
import 'features/pt_conference/pt_conference_screen.dart';
import 'features/dismissal/dismissal_qr_screen.dart';
import 'features/elibrary/parent_elibrary_screen.dart';
import 'features/portfolio/parent_portfolio_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authUser = ref.watch(authProvider.select((state) => state.user));
  return GoRouter(
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
          appTitle: 'ASchool Parent',
          loginType: LoginType.parent,
          onLoginSuccess: () => context.go('/dashboard'),
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, __, navigationShell) =>
            ParentShellScreen(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                  path: '/dashboard',
                  builder: (_, __) => const ParentDashboard()),
              GoRoute(
                  path: '/timetable',
                  builder: (_, __) => const ChildTimetableScreen()),
              GoRoute(
                  path: '/subjects',
                  builder: (_, __) => const ChildSubjectsScreen()),
              GoRoute(
                  path: '/teachers',
                  builder: (_, __) => const ParentTeachersScreen()),
              GoRoute(
                  path: '/homework',
                  builder: (_, __) => const ParentHomeworkScreen()),
              GoRoute(
                  path: '/holidays',
                  builder: (_, __) => const ParentHolidayScreen()),
              GoRoute(
                  path: '/gallery',
                  builder: (_, __) => const ParentGalleryScreen()),
              GoRoute(
                  path: '/reports',
                  builder: (_, __) => const ChildReportsScreen()),
              GoRoute(
                  path: '/bus-tracker',
                  builder: (_, __) => const BusTrackingScreen()),
              GoRoute(
                  path: '/chat', builder: (_, __) => const ParentChatScreen()),
              GoRoute(
                  path: '/notices',
                  builder: (_, __) => const ParentNoticesScreen()),
              GoRoute(
                  path: '/wellbeing',
                  builder: (_, __) => const ChildWellbeingScreen()),
              GoRoute(
                  path: '/pt-conference',
                  builder: (_, __) => const PTConferenceScreen()),
              GoRoute(
                  path: '/dismissal-qr',
                  builder: (_, __) => const DismissalQrScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                  path: '/attendance',
                  builder: (_, __) => const ChildAttendance()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                  path: '/fees', builder: (_, __) => const FeePaymentScreen()),
              GoRoute(
                  path: '/elibrary',
                  builder: (_, __) => const ParentELibraryScreen()),
              GoRoute(
                  path: '/portfolio',
                  builder: (_, __) => const ParentPortfolioScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                  path: '/results',
                  builder: (_, __) => const ResultsScreen(),
                  routes: [
                    GoRoute(
                      path: 'marksheet/:examId/:studentId',
                      builder: (_, state) => ParentMarksheetScreen(
                        examId: state.pathParameters['examId'] ?? '',
                        studentId: state.pathParameters['studentId'] ?? '',
                      ),
                    ),
                  ]),
            ],
          ),
        ],
      ),
    ],
  );
});
