import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';
import 'router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: ASchoolAdminApp()));
}

class ASchoolAdminApp extends ConsumerWidget {
  const ASchoolAdminApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'ASchool Admin',
      debugShowCheckedModeBanner: false,
      theme: ASchoolTheme.light,
      darkTheme: ASchoolTheme.dark,
      routerConfig: router,
    );
  }
}
