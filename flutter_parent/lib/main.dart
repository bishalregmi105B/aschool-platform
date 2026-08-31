import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';
import 'router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Push notifications: init FCM/OneSignal at startup. Token registration with
  // the backend uses any stored session token; AuthService retries after login.
  unawaited(NotificationService().init());
  runApp(const ProviderScope(child: ASchoolParentApp()));
}

class ASchoolParentApp extends ConsumerWidget {
  const ASchoolParentApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);
    return MaterialApp.router(
      title: 'ASchool Parent',
      debugShowCheckedModeBanner: false,
      theme: ASchoolTheme.light,
      darkTheme: ASchoolTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
