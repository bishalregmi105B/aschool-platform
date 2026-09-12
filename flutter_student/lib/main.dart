import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:aschool_shared/aschool_shared.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Bilingual UI + server-authoritative clocks (M-01).
  unawaited(I18nService.instance.load());
  ServerTimeService.instance.startSync();
  // Push notifications: init FCM/OneSignal at startup. Token registration with
  // the backend uses any stored session token; AuthService retries after login.
  unawaited(NotificationService().init());

  // S-A3 (A-30/A-07): resolve the app version once, install crash reporting
  // before runApp, and let the ops gate reuse the same version. Fail-open.
  String appVersion = '0.0.0';
  try {
    appVersion = (await PackageInfo.fromPlatform()).version;
  } catch (_) {}
  CrashReporter.init(appName: 'student', appVersion: appVersion);

  runApp(const ProviderScope(child: ASchoolStudentApp()));
}

class ASchoolStudentApp extends ConsumerWidget {
  const ASchoolStudentApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);
    return MaterialApp.router(
      title: 'ASchool Student',
      theme: ASchoolTheme.light,
      darkTheme: ASchoolTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      // S-A3 (A-07): server-driven maintenance / force-update gate. Runs the
      // ops check after auth bootstrap; fail-open on any error.
      builder: (context, child) => OpsGate(
          appName: 'student', child: child ?? const SizedBox.shrink()),
    );
  }
}
