import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:aschool_user/main.dart';

void main() {
  testWidgets('boots unified user app shell', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(
      const ProviderScope(child: ASchoolUnifiedUserApp()),
    );
    await tester.pump(const Duration(milliseconds: 350));

    final hasOnboarding = find.text('Welcome to ASchool').evaluate().isNotEmpty;
    final hasModeSelection = find.text('Choose your mode').evaluate().isNotEmpty;
    final hasLoginTitle = find.textContaining('Sign In').evaluate().isNotEmpty;
    final hasLoader =
        find.byType(CircularProgressIndicator).evaluate().isNotEmpty;

    expect(hasOnboarding || hasModeSelection || hasLoginTitle || hasLoader, isTrue);
  });
}
