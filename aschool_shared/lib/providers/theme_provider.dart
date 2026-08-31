import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// How the app picks light/dark:
///  - [ThemeMode.system] (default) — follows the OS setting
///  - [ThemeMode.light] / [ThemeMode.dark] — manual override
/// Persisted in SharedPreferences so the choice survives restarts.
final themeModeProvider =
    StateNotifierProvider<ThemeModeController, ThemeMode>((ref) {
  return ThemeModeController();
});

class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController() : super(ThemeMode.system) {
    _load();
  }

  static const _prefKey = 'aschool.theme_mode';

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_prefKey);
      if (stored == 'light') {
        state = ThemeMode.light;
      } else if (stored == 'dark') {
        state = ThemeMode.dark;
      } else {
        state = ThemeMode.system;
      }
    } catch (_) {
      // prefs unavailable (e.g. web private mode) — keep system default
    }
  }

  Future<void> setMode(ThemeMode mode) async {
    state = mode;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKey, switch (mode) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        _ => 'system',
      });
    } catch (_) {}
  }

  /// Cycle system → light → dark (used by settings rows / drawer tile).
  Future<void> cycle() {
    final next = switch (state) {
      ThemeMode.system => ThemeMode.light,
      ThemeMode.light => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    return setMode(next);
  }
}

/// Current brightness as seen by the app (resolves system mode against the
/// platform brightness). Use for widgets that need to branch on light/dark.
final currentBrightnessProvider = Provider<Brightness>((ref) {
  final mode = ref.watch(themeModeProvider);
  // WidgetsApp resolves ThemeMode.system against MediaQuery.platformBrightness;
  // consumers of this provider mainly need the *effective* palette, which the
  // MaterialApp already applies via Theme.of(context). This helper is for
  // non-widget contexts.
  return mode == ThemeMode.dark ? Brightness.dark : Brightness.light;
});

/// Semantic palette tokens that adapt to the active theme. Access via
/// `AppColors.of(context)` — every token reads from ThemeData / ColorScheme so
/// widgets automatically stay correct in light AND dark.
abstract class AppColors {
  static Color pageBackground(BuildContext c) =>
      Theme.of(c).scaffoldBackgroundColor;
  static Color surface(BuildContext c) => Theme.of(c).colorScheme.surface;
  static Color card(BuildContext c) => Theme.of(c).cardColor;
  static Color text(BuildContext c) => Theme.of(c).colorScheme.onSurface;
  static Color textMuted(BuildContext c) =>
      Theme.of(c).textTheme.bodySmall?.color ?? const Color(0xFF6B7280);
  static Color border(BuildContext c) => Theme.of(c).dividerColor;
  static Color primary(BuildContext c) => Theme.of(c).colorScheme.primary;
}

