import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';


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

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onDone;

  const OnboardingScreen({super.key, required this.onDone});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
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
    // Flat backdrop — gradient + glow orbs removed for a simpler look.
    return const Stack(
      children: [
        Positioned.fill(
          child: ColoredBox(color: Color(0xFFF7FBFF)),
        ),
      ],
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
                      color: slide.color.withValues(alpha: 0.1),
                      border: Border.all(
                        color: slide.color.withValues(alpha: 0.3),
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
