import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/auth_flow_controller.dart';

class UnifiedLoginScreen extends ConsumerStatefulWidget {
  final LoginFlow initialFlow;
  final VoidCallback onBackToModeSelection;
  final String? schoolSlug;
  final String? schoolName;

  const UnifiedLoginScreen({
    super.key,
    required this.initialFlow,
    required this.onBackToModeSelection,
    this.schoolSlug,
    this.schoolName,
  });

  @override
  ConsumerState<UnifiedLoginScreen> createState() =>
      _UnifiedLoginScreenState();
}

class _UnifiedLoginScreenState extends ConsumerState<UnifiedLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  late LoginFlow _loginFlow;
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

    final success = _loginFlow == LoginFlow.student
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
    if (resolveRoleTarget(userRole) == UserRoleTarget.unsupported) {
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
                                label: const Text('Change'),
                              ),
                            ],
                          ),
                          if (widget.schoolName != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Row(
                                children: [
                                  Icon(Icons.school_outlined, size: 16, color: Colors.grey[600]),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      widget.schoolName!,
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                            color: Colors.grey[700],
                                          ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
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
                                _loginFlow == LoginFlow.student
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
  final LoginFlow mode;

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
