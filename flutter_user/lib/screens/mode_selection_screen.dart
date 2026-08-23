import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

import '../state/auth_flow_controller.dart';
import '../widgets/glow_orb.dart';

class ModeSelectionScreen extends StatefulWidget {
  final ValueChanged<LoginFlow> onModeSelected;

  const ModeSelectionScreen({super.key, required this.onModeSelected});

  @override
  State<ModeSelectionScreen> createState() => _ModeSelectionScreenState();
}

class _ModeSelectionScreenState extends State<ModeSelectionScreen> {
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
      LoginFlow.student,
      LoginFlow.parent,
      LoginFlow.teacher,
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
          child: GlowOrb(
            size: 220,
            color: const Color(0xFF93C5FD).withValues(alpha: 0.28),
          ),
        ),
        Positioned(
          bottom: -80,
          left: -40,
          child: GlowOrb(
            size: 200,
            color: const Color(0xFFA7F3D0).withValues(alpha: 0.24),
          ),
        ),
      ],
    );
  }
}

class _ModeCard extends StatelessWidget {
  final LoginFlow mode;
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
