import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

import 'screens/shell_screen.dart';
import 'features/dashboard/principal_dashboard.dart';
import 'features/students/students_screen.dart';
import 'features/students/guardians_screen.dart';
import 'features/students/promote_screen.dart';
import 'features/teachers/teachers_screen.dart';
import 'features/academics/class_subjects_screen.dart';
import 'features/academics/class_sections_screen.dart';
import 'features/attendance/attendance_overview.dart';
import 'features/attendance/holiday_list_screen.dart';
import 'features/timetable/timetable_screen.dart';
import 'features/assignments/assignments_screen.dart';
import 'features/exams/exams_screen.dart';
import 'features/fees/fees_management.dart';
import 'features/analytics/analytics_screen.dart';
import 'features/social_hub/social_hub_screen.dart';
import 'features/ai_tools/ai_tools_screen.dart';
import 'features/marketplace/marketplace_screen.dart';
import 'features/settings/settings_screen.dart';
import 'features/hr_payroll/hr_payroll_screen.dart';
import 'features/compliance/compliance_screen.dart';
import 'features/transport/transport_screen.dart';
import 'features/library/library_screen.dart';
import 'features/incidents/incident_screen.dart';
import 'features/notices/notices_screen.dart';
import 'features/communications/announcements_screen.dart';
import 'features/communications/gallery_screen.dart';
import 'features/certificates/certificates_screen.dart';
import 'features/reports/reports_hub_screen.dart';
import 'features/wellbeing/wellbeing_screen.dart';
import 'features/lms/lms_screen.dart';
import 'features/admission/admission_screen.dart';
import 'features/alumni/alumni_screen.dart';
import 'features/health_records/health_records_screen.dart';
import 'features/gamification/gamification_screen.dart';
import 'features/visitor_management/visitor_screen.dart';
import 'features/inventory/inventory_screen.dart';
import 'features/design_studio/design_studio_screen.dart';
import 'features/exams/results/exam_results_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authUser = ref.watch(authProvider.select((state) => state.user));

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final isAuth = authUser != null;
      final isLoginRoute = state.matchedLocation == '/login';

      if (!isAuth && !isLoginRoute) return '/login';
      if (isAuth && isLoginRoute) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => SharedLoginScreen(
          appTitle: 'ASchool Admin',
          loginType: LoginType.staff,
          onLoginSuccess: () => context.go('/dashboard'),
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, __, navigationShell) =>
            ShellScreen(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                  path: '/dashboard',
                  builder: (_, __) => const PrincipalDashboard()),
              GoRoute(
                  path: '/marketplace',
                  builder: (_, __) => const MarketplaceScreen()),
              GoRoute(
                  path: '/settings',
                  builder: (_, __) => const SettingsScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                  path: '/students',
                  builder: (_, __) => const StudentsScreen()),
              GoRoute(
                  path: '/guardians',
                  builder: (_, __) => const GuardiansScreen()),
              GoRoute(
                  path: '/promote', builder: (_, __) => const PromoteScreen()),
              GoRoute(
                  path: '/teachers',
                  builder: (_, __) => const TeachersScreen()),
              GoRoute(
                  path: '/class-subjects',
                  builder: (_, __) => const ClassSubjectsScreen()),
              GoRoute(
                  path: '/class-sections',
                  builder: (_, __) => const ClassSectionsScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                  path: '/attendance',
                  builder: (_, __) => const AttendanceOverview()),
              GoRoute(
                  path: '/timetable',
                  builder: (_, __) => const TimetableScreen()),
              GoRoute(
                  path: '/holidays',
                  builder: (_, __) => const HolidayListScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                  path: '/fees', builder: (_, __) => const FeesManagement()),
              GoRoute(path: '/hr', builder: (_, __) => const HrPayrollScreen()),
              GoRoute(
                  path: '/transport',
                  builder: (_, __) => const TransportScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                  path: '/reports',
                  builder: (_, __) => const ReportsHubScreen()),
              GoRoute(
                  path: '/analytics',
                  builder: (_, __) => const AnalyticsScreen()),
              GoRoute(
                  path: '/assignments',
                  builder: (_, __) => const AssignmentsScreen()),
              GoRoute(path: '/exams', builder: (_, __) => const ExamsScreen()),
              GoRoute(
                  path: '/notices', builder: (_, __) => const NoticesScreen()),
              GoRoute(
                  path: '/announcements',
                  builder: (_, __) => const AnnouncementsScreen()),
              GoRoute(
                  path: '/gallery', builder: (_, __) => const GalleryScreen()),
              GoRoute(
                  path: '/chat',
                  builder: (_, __) => const SharedChatScreen(title: 'Chat')),
              GoRoute(
                  path: '/certificates',
                  builder: (_, __) => const CertificatesScreen()),
              GoRoute(
                  path: '/social-hub',
                  builder: (_, __) => const SocialHubScreen()),
              GoRoute(
                  path: '/library', builder: (_, __) => const LibraryScreen()),
              GoRoute(
                  path: '/ai-tools', builder: (_, __) => const AiToolsScreen()),
              GoRoute(
                  path: '/incidents',
                  builder: (_, __) => const IncidentScreen()),
              GoRoute(
                  path: '/compliance',
                  builder: (_, __) => const ComplianceScreen()),
              // ── Plugin screens ────────────────────────────────────────────
              GoRoute(
                  path: '/wellbeing',
                  builder: (_, __) => const WellbeingScreen()),
              GoRoute(
                  path: '/lms',
                  builder: (_, __) => const LmsScreen()),
              GoRoute(
                  path: '/admission',
                  builder: (_, __) => const AdmissionScreen()),
              GoRoute(
                  path: '/alumni',
                  builder: (_, __) => const AlumniScreen()),
              GoRoute(
                  path: '/health-records',
                  builder: (_, __) => const HealthRecordsScreen()),
              GoRoute(
                  path: '/gamification',
                  builder: (_, __) => const GamificationScreen()),
              GoRoute(
                  path: '/visitors',
                  builder: (_, __) => const VisitorScreen()),
              GoRoute(
                  path: '/inventory',
                  builder: (_, __) => const InventoryScreen()),
              GoRoute(
                  path: '/design-studio',
                  builder: (_, __) => const DesignStudioScreen()),
              GoRoute(
                  path: '/exam-results',
                  builder: (_, __) => const ExamResultsScreen()),
            ],
          ),
        ],
      ),
    ],
  );
});
