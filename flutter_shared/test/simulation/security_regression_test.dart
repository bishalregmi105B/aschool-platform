import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

String readRepoFile(String relativePath) {
  final file = File(relativePath);
  expect(file.existsSync(), isTrue, reason: 'Missing file: $relativePath');
  return file.readAsStringSync();
}

void main() {
  group('Simulation Security Regression Suite (Flutter)', () {
    test('SEC-10 / M5: OTP endpoint must use /auth/send-otp', () {
      final source = readRepoFile('lib/services/auth_service.dart');

      expect(source.contains("/auth/send-otp"), isTrue);
      expect(source.contains("/auth/request-otp"), isFalse);
    });

    test('SEC-11 / H3: NoDataContainer call uses title + subtitle arguments',
        () {
      final source =
          readRepoFile('lib/widgets/notification_center_screen.dart');

      expect(source.contains('NoDataContainer('), isTrue);
      expect(source.contains('title:'), isTrue);
      expect(source.contains('subtitle:'), isTrue);
      expect(source.contains('message:'), isFalse);
    });

    test('SEC-12 / H3: student attendance screen uses getAttendance API', () {
      final source =
          readRepoFile('lib/features/student_attendance_screen.dart');

      expect(source.contains('getAttendance('), isTrue);
      expect(source.contains('getStudentAttendance('), isFalse);
    });

    test(
        'H4: refresh flow should queue concurrent 401s behind one refresh call',
        () {
      final source = readRepoFile('lib/services/api_client.dart');

      // A robust single-flight refresh implementation typically uses a completer/future queue.
      final hasSingleFlightQueue = source.contains('Completer') ||
          source.contains('Future<void>? _refreshFuture');
      expect(hasSingleFlightQueue, isTrue);
    });
  });
}
