import 'package:aschool_parent/aschool_parent.dart' as parent_app;
import 'package:aschool_shared/aschool_shared.dart';
import 'package:aschool_student/aschool_student.dart' as student_app;
import 'package:aschool_teacher/aschool_teacher.dart' as teacher_app;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../screens/mode_selection_screen.dart';
import '../screens/onboarding_screen.dart';
import '../screens/school_lookup_screen.dart';
import '../screens/splash_screen.dart';
import '../screens/unified_login_screen.dart';
import '../state/auth_flow_controller.dart';

class ASchoolUnifiedUserApp extends ConsumerWidget {
  const ASchoolUnifiedUserApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    if (authState.user != null) {
      final roleTarget = resolveRoleTarget(authState.user!.role);
      switch (roleTarget) {
        case UserRoleTarget.student:
          return const student_app.ASchoolStudentApp();
        case UserRoleTarget.parent:
          return const parent_app.ASchoolParentApp();
        case UserRoleTarget.teacher:
          return const teacher_app.ASchoolTeacherApp();
        case UserRoleTarget.unsupported:
          return UnsupportedRoleApp(role: authState.user!.role);
      }
    }

    if (authState.isLoading) {
      return const SplashScreen();
    }

    return const _UserLoginApp();
  }
}

class _UserLoginApp extends StatelessWidget {
  const _UserLoginApp();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ASchool User',
      debugShowCheckedModeBanner: false,
      theme: ASchoolTheme.light,
      darkTheme: ASchoolTheme.dark,
      themeMode: ThemeMode.system,
      home: const _UserEntryFlow(),
    );
  }
}

class _UserEntryFlow extends StatefulWidget {
  const _UserEntryFlow();

  @override
  State<_UserEntryFlow> createState() => _UserEntryFlowState();
}

class _UserEntryFlowState extends State<_UserEntryFlow> {
  EntryStage _stage = EntryStage.loading;
  LoginFlow _selectedFlow = LoginFlow.student;
  String? _selectedSchoolSlug;
  String? _selectedSchoolName;

  @override
  void initState() {
    super.initState();
    _bootstrapFlow();
  }

  Future<void> _bootstrapFlow() async {
    final prefs = await SharedPreferences.getInstance();
    final seenOnboarding = prefs.getBool(onboardingSeenKey) ?? false;
    // Restore previously selected school
    _selectedSchoolSlug = prefs.getString(schoolSlugKey);
    if (_selectedSchoolSlug != null) {
      ApiClient.setSchoolSlug(_selectedSchoolSlug!);
    }
    if (!mounted) return;
    setState(() {
      _stage = seenOnboarding ? EntryStage.mode : EntryStage.onboarding;
    });
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(onboardingSeenKey, true);
    if (!mounted) return;
    setState(() {
      _stage = EntryStage.mode;
    });
  }

  void _selectMode(LoginFlow flow) {
    setState(() {
      _selectedFlow = flow;
      _stage = EntryStage.school;
    });
  }

  Future<void> _selectSchool(String slug, String name) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(schoolSlugKey, slug);
    ApiClient.setSchoolSlug(slug);
    if (!mounted) return;
    setState(() {
      _selectedSchoolSlug = slug;
      _selectedSchoolName = name;
      _stage = EntryStage.login;
    });
  }

  void _goBackToModeSelection() {
    setState(() {
      _stage = EntryStage.mode;
    });
  }

  void _goBackToSchoolSelection() {
    setState(() {
      _stage = EntryStage.school;
    });
  }

  Widget _stageWidget() {
    switch (_stage) {
      case EntryStage.loading:
        return const LoadingScreen(message: 'Preparing your experience...');
      case EntryStage.onboarding:
        return OnboardingScreen(onDone: _completeOnboarding);
      case EntryStage.mode:
        return ModeSelectionScreen(onModeSelected: _selectMode);
      case EntryStage.school:
        return SchoolSelectionScreen(
          selectedFlow: _selectedFlow,
          onSchoolSelected: _selectSchool,
          onBack: _goBackToModeSelection,
          preselectedSlug: _selectedSchoolSlug,
        );
      case EntryStage.login:
        return UnifiedLoginScreen(
          initialFlow: _selectedFlow,
          schoolSlug: _selectedSchoolSlug,
          schoolName: _selectedSchoolName,
          onBackToModeSelection: _goBackToSchoolSelection,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 420),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, animation) {
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0.02, 0.02),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        );
      },
      child: KeyedSubtree(
        key: ValueKey(_stage),
        child: _stageWidget(),
      ),
    );
  }
}

class UnsupportedRoleApp extends ConsumerWidget {
  final String role;

  const UnsupportedRoleApp({super.key, required this.role});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ASchoolTheme.light,
      darkTheme: ASchoolTheme.dark,
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.admin_panel_settings_outlined,
                    size: 56,
                    color: ASchoolTheme.warning,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Use Admin App',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Role "$role" belongs to the admin side. Please sign in through the ASchool Admin app.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: () async {
                      await ref.read(authProvider.notifier).logout();
                    },
                    child: const Text('Sign Out'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
