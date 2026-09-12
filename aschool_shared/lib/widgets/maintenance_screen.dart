import 'package:flutter/material.dart';

/// A-07: full-screen maintenance notice rendered INSTEAD of the app home
/// while the server reports `maintenance` for the app (or globally).
///
/// Forest-Green ops palette — deliberately distinct from the everyday brand
/// blues so the state reads as "infrastructure work, not a school problem".
/// The Retry button re-runs the ops check; when it succeeds the gate swaps
/// back into the app.
class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key, this.message, this.onRetry});

  static const Color primary = Color(0xFF0E3B2E);
  static const Color accent = Color(0xFFC5F4DD);
  static const Color background = Color(0xFFF7F5F0);

  /// Server-provided maintenance message (may be null/empty → fallback copy).
  final String? message;

  /// Re-runs the ops check. Success is signalled by the gate swapping the
  /// screen out — this widget does not navigate on its own.
  final Future<void> Function()? onRetry;

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  bool _checking = false;

  Future<void> _retry() async {
    if (_checking) return;
    setState(() => _checking = true);
    try {
      await widget.onRetry?.call();
    } catch (_) {
      // A failed retry keeps this screen up; never bubble the error.
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final serverMessage = widget.message?.trim() ?? '';
    return Scaffold(
      backgroundColor: MaintenanceScreen.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: const BoxDecoration(
                    color: MaintenanceScreen.accent,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.engineering_rounded,
                    size: 52,
                    color: MaintenanceScreen.primary,
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  "We'll be back soon",
                  textAlign: TextAlign.center,
                  style: Theme.of(context)
                      .textTheme
                      .headlineMedium
                      ?.copyWith(
                        color: MaintenanceScreen.primary,
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 12),
                Text(
                  serverMessage.isEmpty
                      ? 'ASchool is undergoing scheduled maintenance. '
                          'Please try again shortly.'
                      : serverMessage,
                  textAlign: TextAlign.center,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(
                        color: MaintenanceScreen.primary.withAlpha(185),
                        height: 1.5,
                      ),
                ),
                const SizedBox(height: 36),
                FilledButton.icon(
                  onPressed: _checking ? null : _retry,
                  icon: _checking
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: MaintenanceScreen.accent,
                          ),
                        )
                      : const Icon(Icons.refresh_rounded),
                  label: Text(_checking ? 'Checking…' : 'Retry'),
                  style: FilledButton.styleFrom(
                    backgroundColor: MaintenanceScreen.primary,
                    foregroundColor: MaintenanceScreen.accent,
                    disabledBackgroundColor:
                        MaintenanceScreen.primary.withAlpha(150),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 28, vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
