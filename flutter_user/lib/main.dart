import 'package:aschool_parent/aschool_parent.dart' as parent_app;
import 'package:aschool_shared/aschool_shared.dart';
import 'package:aschool_student/aschool_student.dart' as student_app;
import 'package:aschool_teacher/aschool_teacher.dart' as teacher_app;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: ASchoolUnifiedUserApp()));
}

enum _UserRoleTarget { student, parent, teacher, unsupported }

enum _LoginFlow { student, parent, teacher }

enum _EntryStage { loading, onboarding, mode, login }

extension _LoginFlowView on _LoginFlow {
  String get label {
    switch (this) {
      case _LoginFlow.student:
        return 'Student';
      case _LoginFlow.parent:
        return 'Parent';
      case _LoginFlow.teacher:
        return 'Teacher';
    }
  }

  String get subtitle {
    switch (this) {
      case _LoginFlow.student:
        return 'Timetable, homework, results, and progress in one place.';
      case _LoginFlow.parent:
        return 'Track attendance, fees, notices, and child performance.';
      case _LoginFlow.teacher:
        return 'Manage classes, attendance, marks, and teaching tools.';
    }
  }

  String get identifierLabel {
    if (this == _LoginFlow.student) return 'Student ID';
    return 'Phone Number or Email';
  }

  String get identifierHint {
    switch (this) {
      case _LoginFlow.student:
        return 'e.g. STU-2023-001';
      case _LoginFlow.parent:
        return '98XXXXXXXX or parent@email.com';
      case _LoginFlow.teacher:
        return '98XXXXXXXX or teacher@school.edu.np';
    }
  }

  TextInputType get keyboardType {
    if (this == _LoginFlow.student) return TextInputType.text;
    return TextInputType.emailAddress;
  }

  IconData get icon {
    switch (this) {
      case _LoginFlow.student:
        return Icons.school_rounded;
      case _LoginFlow.parent:
        return Icons.family_restroom_rounded;
      case _LoginFlow.teacher:
        return Icons.menu_book_rounded;
    }
  }

  Color get accent {
    switch (this) {
      case _LoginFlow.student:
        return const Color(0xFF2563EB);
      case _LoginFlow.parent:
        return const Color(0xFF0E9F6E);
      case _LoginFlow.teacher:
        return const Color(0xFFD97706);
    }
  }
}

const String _onboardingSeenKey = 'user_onboarding_seen_v1';

_UserRoleTarget _resolveRoleTarget(String rawRole) {
  final role = rawRole.trim().toLowerCase();
  if (role == 'student') return _UserRoleTarget.student;
  if (role == 'parent') return _UserRoleTarget.parent;
  if (role == 'teacher' || role == 'staff') return _UserRoleTarget.teacher;
  return _UserRoleTarget.unsupported;
}

class ASchoolUnifiedUserApp extends ConsumerWidget {
  const ASchoolUnifiedUserApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    if (authState.user != null) {
      final roleTarget = _resolveRoleTarget(authState.user!.role);
      switch (roleTarget) {
        case _UserRoleTarget.student:
          return const student_app.ASchoolStudentApp();
        case _UserRoleTarget.parent:
          return const parent_app.ASchoolParentApp();
        case _UserRoleTarget.teacher:
          return const teacher_app.ASchoolTeacherApp();
        case _UserRoleTarget.unsupported:
          return UnsupportedRoleApp(role: authState.user!.role);
      }
    }

    if (authState.isLoading) {
      return const _BootSplashApp();
    }

    return const _UserLoginApp();
  }
}

class _BootSplashApp extends StatelessWidget {
  const _BootSplashApp();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ASchoolTheme.light,
      darkTheme: ASchoolTheme.dark,
      home: const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
    );
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
  _EntryStage _stage = _EntryStage.loading;
  _LoginFlow _selectedFlow = _LoginFlow.student;

  @override
  void initState() {
    super.initState();
    _bootstrapFlow();
  }

  Future<void> _bootstrapFlow() async {
    final prefs = await SharedPreferences.getInstance();
    final seenOnboarding = prefs.getBool(_onboardingSeenKey) ?? false;
    if (!mounted) return;
    setState(() {
      _stage = seenOnboarding ? _EntryStage.mode : _EntryStage.onboarding;
    });
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_onboardingSeenKey, true);
    if (!mounted) return;
    setState(() {
      _stage = _EntryStage.mode;
    });
  }

  void _selectMode(_LoginFlow flow) {
    setState(() {
      _selectedFlow = flow;
      _stage = _EntryStage.login;
    });
  }

  void _goBackToModeSelection() {
    setState(() {
      _stage = _EntryStage.mode;
    });
  }

  Widget _stageWidget() {
    switch (_stage) {
      case _EntryStage.loading:
        return const _LoadingScreen(message: 'Preparing your experience...');
      case _EntryStage.onboarding:
        return _OnboardingScreen(onDone: _completeOnboarding);
      case _EntryStage.mode:
        return _ModeSelectionScreen(onModeSelected: _selectMode);
      case _EntryStage.login:
        return _UnifiedLoginScreen(
          initialFlow: _selectedFlow,
          onBackToModeSelection: _goBackToModeSelection,
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

class _OnboardingSlide {
  final String title;
  final String subtitle;
  final String details;
  final IconData icon;
  final Color color;

  const _OnboardingSlide({
    required this.title,
    required this.subtitle,
    required this.details,
    required this.icon,
    required this.color,
  });
}

class _OnboardingScreen extends StatefulWidget {
  final VoidCallback onDone;

  const _OnboardingScreen({required this.onDone});

  @override
  State<_OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<_OnboardingScreen> {
  static const List<_OnboardingSlide> _slides = [
    _OnboardingSlide(
      title: 'Welcome to ASchool',
      subtitle: 'One app for daily school life',
      details:
          'Stay connected to classes, announcements, assignments, and progress with smooth real-time updates.',
      icon: Icons.auto_awesome_rounded,
      color: Color(0xFF2563EB),
    ),
    _OnboardingSlide(
      title: 'Fast and Focused',
      subtitle: 'Built for school routines',
      details:
          'Navigate quickly between attendance, timetable, fees, marks, and communication tools with a modern interface.',
      icon: Icons.bolt_rounded,
      color: Color(0xFF0E9F6E),
    ),
    _OnboardingSlide(
      title: 'Pick Your Mode',
      subtitle: 'Student, Parent, or Teacher',
      details:
          'Choose your mode first, then sign in and continue with a role-specific experience tailored to your workflow.',
      icon: Icons.hub_rounded,
      color: Color(0xFFD97706),
    ),
  ];

  final _pageController = PageController();
  int _index = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _next() async {
    final isLast = _index == _slides.length - 1;
    if (isLast) {
      widget.onDone();
      return;
    }
    await _pageController.nextPage(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final progress = _slides.length <= 1 ? 0.0 : _index / (_slides.length - 1);
    final isLast = _index == _slides.length - 1;

    return Scaffold(
      body: Stack(
        children: [
          _OnboardingBackdrop(progress: progress),
          SafeArea(
            child: Column(
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: widget.onDone,
                    child: const Text('Skip'),
                  ),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _pageController,
                    onPageChanged: (value) {
                      setState(() {
                        _index = value;
                      });
                    },
                    itemCount: _slides.length,
                    itemBuilder: (context, index) {
                      final slide = _slides[index];
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                        child: _OnboardingCard(
                          slide: slide,
                          active: _index == index,
                        ),
                      );
                    },
                  ),
                ),
                _OnboardingIndicators(current: _index, total: _slides.length),
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: ElevatedButton.icon(
                    onPressed: _next,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size.fromHeight(54),
                      backgroundColor: ASchoolTheme.primary,
                      foregroundColor: Colors.white,
                    ),
                    icon: Icon(
                      isLast
                          ? Icons.check_circle_outline_rounded
                          : Icons.arrow_forward_rounded,
                    ),
                    label: Text(isLast ? 'Get Started' : 'Next'),
                  ),
                ),
                const SizedBox(height: 14),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OnboardingBackdrop extends StatelessWidget {
  final double progress;

  const _OnboardingBackdrop({required this.progress});

  @override
  Widget build(BuildContext context) {
    final topColor = Color.lerp(
      const Color(0xFFF7FBFF),
      const Color(0xFFF7FFF7),
      progress,
    );
    final bottomColor = Color.lerp(
      const Color(0xFFDDEBFF),
      const Color(0xFFFFF0DC),
      progress,
    );

    return Stack(
      children: [
        Positioned.fill(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 600),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  topColor ?? const Color(0xFFF7FBFF),
                  bottomColor ?? const Color(0xFFDDEBFF),
                ],
              ),
            ),
          ),
        ),
        AnimatedPositioned(
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
          top: 44 + (32 * progress),
          left: -34 + (20 * progress),
          child: _GlowOrb(
            size: 180,
            color: const Color(0xFF60A5FA).withValues(alpha: 0.24),
          ),
        ),
        AnimatedPositioned(
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
          bottom: -32 + (36 * progress),
          right: -16 + (14 * progress),
          child: _GlowOrb(
            size: 200,
            color: const Color(0xFF34D399).withValues(alpha: 0.22),
          ),
        ),
      ],
    );
  }
}

class _GlowOrb extends StatelessWidget {
  final double size;
  final Color color;

  const _GlowOrb({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.3),
            blurRadius: 48,
            spreadRadius: 4,
          ),
        ],
      ),
    );
  }
}

class _OnboardingCard extends StatelessWidget {
  final _OnboardingSlide slide;
  final bool active;

  const _OnboardingCard({required this.slide, required this.active});

  @override
  Widget build(BuildContext context) {
    return AnimatedScale(
      scale: active ? 1 : 0.95,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      child: AnimatedOpacity(
        opacity: active ? 1 : 0.7,
        duration: const Duration(milliseconds: 220),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: slide.color.withValues(alpha: 0.25),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.07),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TweenAnimationBuilder<double>(
                  duration: const Duration(milliseconds: 340),
                  curve: Curves.easeOutBack,
                  tween: Tween(begin: active ? 0.8 : 0.92, end: 1),
                  builder: (context, value, child) {
                    return Transform.scale(
                      scale: value,
                      child: child,
                    );
                  },
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [
                          slide.color.withValues(alpha: 0.2),
                          slide.color.withValues(alpha: 0.1),
                        ],
                      ),
                      border: Border.all(
                        color: slide.color.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Icon(slide.icon, size: 46, color: slide.color),
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  slide.title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: ASchoolTheme.primaryDark,
                      ),
                ),
                const SizedBox(height: 12),
                Text(
                  slide.subtitle,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  slide.details,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        height: 1.45,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OnboardingIndicators extends StatelessWidget {
  final int current;
  final int total;

  const _OnboardingIndicators({required this.current, required this.total});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(total, (index) {
        final active = index == current;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: active ? 24 : 8,
          height: 8,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(99),
            color: active ? ASchoolTheme.primary : Colors.black26,
          ),
        );
      }),
    );
  }
}

class _ModeSelectionScreen extends StatefulWidget {
  final ValueChanged<_LoginFlow> onModeSelected;

  const _ModeSelectionScreen({required this.onModeSelected});

  @override
  State<_ModeSelectionScreen> createState() => _ModeSelectionScreenState();
}

class _ModeSelectionScreenState extends State<_ModeSelectionScreen> {
  bool _showCards = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        _showCards = true;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    const modes = [
      _LoginFlow.student,
      _LoginFlow.parent,
      _LoginFlow.teacher,
    ];

    return Scaffold(
      body: Stack(
        children: [
          const _ModeSelectionBackground(),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 4),
                  Text(
                    'Choose your mode',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: ASchoolTheme.primaryDark,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Select Teacher, Parent, or Student to continue',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 22),
                  Expanded(
                    child: ListView.separated(
                      itemCount: modes.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 14),
                      itemBuilder: (context, index) {
                        final mode = modes[index];
                        return _ModeCard(
                          mode: mode,
                          index: index,
                          visible: _showCards,
                          onTap: () => widget.onModeSelected(mode),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'You can change this mode later on the sign-in screen.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeSelectionBackground extends StatelessWidget {
  const _ModeSelectionBackground();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFFF8FAFC),
                  Color(0xFFEFF6FF),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          top: -70,
          right: -50,
          child: _GlowOrb(
            size: 220,
            color: const Color(0xFF93C5FD).withValues(alpha: 0.28),
          ),
        ),
        Positioned(
          bottom: -80,
          left: -40,
          child: _GlowOrb(
            size: 200,
            color: const Color(0xFFA7F3D0).withValues(alpha: 0.24),
          ),
        ),
      ],
    );
  }
}

class _ModeCard extends StatelessWidget {
  final _LoginFlow mode;
  final int index;
  final bool visible;
  final VoidCallback onTap;

  const _ModeCard({
    required this.mode,
    required this.index,
    required this.visible,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final duration = Duration(milliseconds: 300 + (index * 110));

    return AnimatedSlide(
      duration: duration,
      curve: Curves.easeOutCubic,
      offset: visible ? Offset.zero : const Offset(0, 0.15),
      child: AnimatedOpacity(
        duration: duration,
        opacity: visible ? 1 : 0,
        child: Material(
          color: Colors.white.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(22),
          child: InkWell(
            borderRadius: BorderRadius.circular(22),
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: mode.accent.withValues(alpha: 0.25),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 54,
                    height: 54,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: mode.accent.withValues(alpha: 0.12),
                    ),
                    child: Icon(mode.icon, color: mode.accent),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          mode.label,
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          mode.subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(Icons.arrow_forward_rounded, color: mode.accent),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _UnifiedLoginScreen extends ConsumerStatefulWidget {
  final _LoginFlow initialFlow;
  final VoidCallback onBackToModeSelection;

  const _UnifiedLoginScreen({
    required this.initialFlow,
    required this.onBackToModeSelection,
  });

  @override
  ConsumerState<_UnifiedLoginScreen> createState() =>
      _UnifiedLoginScreenState();
}

class _UnifiedLoginScreenState extends ConsumerState<_UnifiedLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  late _LoginFlow _loginFlow;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _loginFlow = widget.initialFlow;
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String get _identifierLabel {
    return _loginFlow.identifierLabel;
  }

  String get _identifierHint {
    return _loginFlow.identifierHint;
  }

  TextInputType get _keyboardType {
    return _loginFlow.keyboardType;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;
    final notifier = ref.read(authProvider.notifier);

    final success = _loginFlow == _LoginFlow.student
        ? await notifier.loginWithStudentId(identifier, password)
        : await notifier.loginWithEmailOrPhone(identifier, password);

    if (!mounted) return;

    if (!success) {
      final error = ref.read(authProvider).error ?? 'Login failed';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: ASchoolTheme.danger),
      );
      return;
    }

    final userRole = ref.read(authProvider).user?.role ?? '';
    if (_resolveRoleTarget(userRole) == _UserRoleTarget.unsupported) {
      await notifier.logout();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'This account role ($userRole) is not part of the User app. Please use the Admin app.',
          ),
          backgroundColor: ASchoolTheme.warning,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.white,
                    _loginFlow.accent.withValues(alpha: 0.08),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 430),
                  child: Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color:
                          Theme.of(context).cardColor.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: _loginFlow.accent.withValues(alpha: 0.22),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 26,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                  child: _SelectedModeBadge(mode: _loginFlow)),
                              TextButton.icon(
                                onPressed: widget.onBackToModeSelection,
                                icon: const Icon(Icons.swap_horiz_rounded),
                                label: const Text('Change mode'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Text(
                            '${_loginFlow.label} Sign In',
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _loginFlow.subtitle,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 20),
                          TextFormField(
                            controller: _identifierController,
                            keyboardType: _keyboardType,
                            decoration: InputDecoration(
                              labelText: _identifierLabel,
                              hintText: _identifierHint,
                              prefixIcon: Icon(
                                _loginFlow == _LoginFlow.student
                                    ? Icons.badge_outlined
                                    : Icons.person_outline,
                              ),
                            ),
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) {
                                return 'Please enter your $_identifierLabel';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              labelText: 'Password',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                ),
                                onPressed: () {
                                  setState(() {
                                    _obscurePassword = !_obscurePassword;
                                  });
                                },
                              ),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty) {
                                return 'Please enter your password';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton(
                            onPressed: authState.isLoading ? null : _submit,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _loginFlow.accent,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                            ),
                            child: authState.isLoading
                                ? const SizedBox(
                                    height: 22,
                                    width: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : Text(
                                    'Continue as ${_loginFlow.label}',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Use ASchool Admin app for admin/school-admin roles.',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SelectedModeBadge extends StatelessWidget {
  final _LoginFlow mode;

  const _SelectedModeBadge({required this.mode});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: mode.accent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(mode.icon, size: 18, color: mode.accent),
          const SizedBox(width: 8),
          Text(
            mode.label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: mode.accent,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _LoadingScreen extends StatelessWidget {
  final String? message;

  const _LoadingScreen({this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          if (message != null) ...[
            const SizedBox(height: 12),
            Text(message!, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ],
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
