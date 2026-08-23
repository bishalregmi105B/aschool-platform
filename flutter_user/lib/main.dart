import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'widgets/role_app_host.dart';

export 'widgets/role_app_host.dart' show ASchoolUnifiedUserApp;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: ASchoolUnifiedUserApp()));
}
