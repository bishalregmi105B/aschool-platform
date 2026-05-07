import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_theme.dart';
import '../services/auth_service.dart';

enum LoginType {
  student, // Uses Student ID
  staff, // Uses Email
  parent, // Uses Phone or Email
}

class SharedLoginScreen extends ConsumerStatefulWidget {
  final String appTitle;
  final LoginType loginType;
  final VoidCallback onLoginSuccess;

  const SharedLoginScreen({
    super.key,
    required this.appTitle,
    required this.loginType,
    required this.onLoginSuccess,
  });

  @override
  ConsumerState<SharedLoginScreen> createState() => _SharedLoginScreenState();
}

class _SharedLoginScreenState extends ConsumerState<SharedLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;
    final notifier = ref.read(authProvider.notifier);

    bool success = false;
    if (widget.loginType == LoginType.student) {
      success = await notifier.loginWithStudentId(identifier, password);
    } else {
      success = await notifier.loginWithEmailOrPhone(identifier, password);
    }

    if (mounted) {
      if (success) {
        widget.onLoginSuccess();
      } else {
        final error = ref.read(authProvider).error;
        if (error != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(error), backgroundColor: ASchoolTheme.danger),
          );
        }
      }
    }
  }

  String get _identifierLabel {
    switch (widget.loginType) {
      case LoginType.student:
        return 'Student ID';
      case LoginType.staff:
        return 'Phone Number or Email';
      case LoginType.parent:
        return 'Phone Number or Email';
    }
  }

  String get _identifierHint {
    switch (widget.loginType) {
      case LoginType.student:
        return 'e.g. STU-2023-001';
      case LoginType.staff:
        return '98XXXXXXXX or name@school.edu.np';
      case LoginType.parent:
        return '98XXXXXXXX or name@email.com';
    }
  }

  TextInputType get _keyboardType {
    switch (widget.loginType) {
      case LoginType.student:
        return TextInputType.text;
      case LoginType.staff:
        return TextInputType.emailAddress;
      case LoginType.parent:
        return TextInputType.emailAddress;
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.school_rounded,
                    size: 80,
                    color: ASchoolTheme.primary,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    widget.appTitle,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: ASchoolTheme.primaryDark,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign in to continue',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.grey[600],
                        ),
                  ),
                  const SizedBox(height: 48),
                  
                  // Identifier Field
                  TextFormField(
                    controller: _identifierController,
                    keyboardType: _keyboardType,
                    decoration: InputDecoration(
                      labelText: _identifierLabel,
                      hintText: _identifierHint,
                      prefixIcon: Icon(
                        widget.loginType == LoginType.student
                            ? Icons.badge_outlined
                            : Icons.person_outline,
                      ),
                    ),
                    validator: (v) => v == null || v.isEmpty ? 'Please enter your $_identifierLabel' : null,
                  ),
                  const SizedBox(height: 16),
                  
                  // Password Field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                        ),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                    validator: (v) => v == null || v.isEmpty ? 'Please enter your password' : null,
                  ),
                  const SizedBox(height: 24),
                  
                  // Submit Button
                  ElevatedButton(
                    onPressed: authState.isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ASchoolTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: authState.isLoading
                        ? const SizedBox(
                            height: 24,
                            width: 24,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Text(
                            'Sign In',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
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
