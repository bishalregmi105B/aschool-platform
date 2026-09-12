import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:aschool_shared/aschool_shared.dart';

import 'widgets/role_app_host.dart';

export 'widgets/role_app_host.dart' show ASchoolUnifiedUserApp;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Bilingual UI + server-authoritative clocks (M-01).
  unawaited(I18nService.instance.load());
  ServerTimeService.instance.startSync();
  // Push notifications: init FCM/OneSignal at startup so tokens are captured
  // before login; AuthService registers them with the backend after login.
  unawaited(NotificationService().init());

  // S-A3 (A-30/A-07): resolve the app version once, install crash reporting
  // before runApp, and let the ops gate reuse the same version. Fail-open.
  String appVersion = '0.0.0';
  try {
    appVersion = (await PackageInfo.fromPlatform()).version;
  } catch (_) {}
  CrashReporter.init(appName: 'user', appVersion: appVersion);

  runApp(const ProviderScope(child: ASchoolUnifiedUserApp()));
}
