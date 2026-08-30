import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import 'widgets/role_app_host.dart';

export 'widgets/role_app_host.dart' show ASchoolUnifiedUserApp;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Push notifications: init FCM/OneSignal at startup so tokens are captured
  // before login; AuthService registers them with the backend after login.
  unawaited(NotificationService().init());
  runApp(const ProviderScope(child: ASchoolUnifiedUserApp()));
}
