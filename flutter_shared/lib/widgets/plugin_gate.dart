import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/plugin_provider.dart';

/// PluginGate — Conditionally renders child widget based on plugin installation status.
///
/// Usage:
/// ```dart
/// PluginGate(
///   pluginSlug: 'lms',
///   child: LMSDashboard(),
///   fallback: PluginPromoCard(slug: 'lms'),
/// )
/// ```
class PluginGate extends ConsumerWidget {
  final String pluginSlug;
  final Widget child;
  final Widget? fallback;

  const PluginGate({
    super.key,
    required this.pluginSlug,
    required this.child,
    this.fallback,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plugins = ref.watch(pluginProvider);

    if (plugins.isInstalled(pluginSlug)) {
      return child;
    }

    return fallback ?? _DefaultFallback(pluginSlug: pluginSlug);
  }
}

class _DefaultFallback extends StatelessWidget {
  final String pluginSlug;
  const _DefaultFallback({required this.pluginSlug});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.extension_off, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Feature Not Available',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'The "$pluginSlug" plugin is not installed for your school. '
              'Contact your school admin to enable this feature.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
      ),
    );
  }
}
