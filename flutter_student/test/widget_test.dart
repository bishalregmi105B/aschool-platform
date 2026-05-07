import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('student test harness builds', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
