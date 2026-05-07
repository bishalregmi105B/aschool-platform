import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/models/plugin_manifest.dart';
import 'package:aschool_shared/services/plugin_provider.dart';
import 'package:aschool_shared/widgets/plugin_gate.dart';

void main() {
  group('PluginGate Widget', () {
    Widget buildTestApp({
      required String pluginSlug,
      required Widget child,
      Widget? fallback,
      required PluginState pluginState,
    }) {
      return ProviderScope(
        overrides: [
          pluginProvider.overrideWith((_) {
            return _FakePluginNotifier(pluginState);
          }),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: PluginGate(
              pluginSlug: pluginSlug,
              child: child,
              fallback: fallback,
            ),
          ),
        ),
      );
    }

    testWidgets('shows child when plugin is installed', (tester) async {
      final state = PluginState(
        plugins: [
          const InstalledPlugin(slug: 'lms', name: 'LMS'),
          const InstalledPlugin(slug: 'attendance', name: 'Attendance'),
        ],
      );

      await tester.pumpWidget(buildTestApp(
        pluginSlug: 'lms',
        child: const Text('LMS Dashboard'),
        pluginState: state,
      ));

      expect(find.text('LMS Dashboard'), findsOneWidget);
      expect(find.text('Feature Not Available'), findsNothing);
    });

    testWidgets('shows default fallback when plugin not installed',
        (tester) async {
      final state = PluginState(
        plugins: [
          const InstalledPlugin(slug: 'attendance', name: 'Attendance'),
        ],
      );

      await tester.pumpWidget(buildTestApp(
        pluginSlug: 'lms',
        child: const Text('LMS Dashboard'),
        pluginState: state,
      ));

      expect(find.text('LMS Dashboard'), findsNothing);
      expect(find.text('Feature Not Available'), findsOneWidget);
      expect(find.textContaining('lms'), findsOneWidget);
    });

    testWidgets('shows custom fallback when provided', (tester) async {
      final state = PluginState(plugins: []);

      await tester.pumpWidget(buildTestApp(
        pluginSlug: 'lms',
        child: const Text('LMS Dashboard'),
        fallback: const Text('Upgrade Now'),
        pluginState: state,
      ));

      expect(find.text('LMS Dashboard'), findsNothing);
      expect(find.text('Upgrade Now'), findsOneWidget);
    });

    testWidgets('shows extension_off icon in default fallback',
        (tester) async {
      final state = PluginState(plugins: []);

      await tester.pumpWidget(buildTestApp(
        pluginSlug: 'library',
        child: const Text('Library'),
        pluginState: state,
      ));

      expect(find.byIcon(Icons.extension_off), findsOneWidget);
    });

    testWidgets('reacts to state change when plugin is added',
        (tester) async {
      final notifier = _FakePluginNotifier(const PluginState(plugins: []));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            pluginProvider.overrideWith((_) => notifier),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: PluginGate(
                pluginSlug: 'lms',
                child: Text('LMS Active'),
              ),
            ),
          ),
        ),
      );

      expect(find.text('Feature Not Available'), findsOneWidget);
      expect(find.text('LMS Active'), findsNothing);

      // Simulate plugin install
      notifier.addPlugin(const InstalledPlugin(slug: 'lms', name: 'LMS'));
      await tester.pump();

      expect(find.text('LMS Active'), findsOneWidget);
      expect(find.text('Feature Not Available'), findsNothing);
    });

    testWidgets('empty plugins list shows fallback for any slug',
        (tester) async {
      final state = PluginState(plugins: []);

      await tester.pumpWidget(buildTestApp(
        pluginSlug: 'anything',
        child: const Text('Content'),
        pluginState: state,
      ));

      expect(find.text('Content'), findsNothing);
      expect(find.text('Feature Not Available'), findsOneWidget);
    });
  });
}

class _FakePluginNotifier extends StateNotifier<PluginState>
    implements PluginNotifier {
  _FakePluginNotifier(super.state);

  void addPlugin(InstalledPlugin plugin) {
    state = PluginState(plugins: [...state.plugins, plugin]);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}
