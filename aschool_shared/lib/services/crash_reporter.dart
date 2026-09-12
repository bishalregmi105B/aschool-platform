import 'dart:async';
import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../utils/constants.dart';
import 'api_client.dart';

/// A-30: crash reporting for the five Flutter apps.
///
/// Call [init] once in each app's `main()` before [runApp]. It installs:
///  - `FlutterError.onError`   → Flutter framework errors
///  - `PlatformDispatcher.instance.onError` → uncaught async/zone errors
/// and forwards both to `POST /mobile/crash` (auth-optional endpoint) via a
/// bare Dio instance so reporting works even when the authed client is broken.
///
/// Guarantees: identical errors are deduped per session, at most
/// [_maxReportsPerSession] reports per session, and every path here swallows
/// its own exceptions — crash reporting must never crash (or slow down) the
/// app. All POSTs are fire-and-forget.
class CrashReporter {
  CrashReporter._();

  static String? _appName;
  static String? _appVersion;
  static String? get appName => _appName;
  static String? get appVersion => _appVersion;

  static final Set<String> _reportedSignatures = <String>{};
  static int _reportCount = 0;
  static const int _maxReportsPerSession = 20;

  /// Bare Dio (no auth interceptors) — /mobile/crash needs no JWT, and the
  /// auth interceptor's refresh flow must never be triggered by a crash.
  static Dio? _bareDio;

  static void init({required String appName, String? appVersion}) {
    try {
      _appName = appName;
      _appVersion = appVersion;

      final previousFlutterHandler = FlutterError.onError;
      FlutterError.onError = (FlutterErrorDetails details) {
        // Preserve the default console rendering for local debugging.
        try {
          if (previousFlutterHandler != null) {
            previousFlutterHandler(details);
          } else {
            FlutterError.presentError(details);
          }
        } catch (_) {}
        report(
          details.exception,
          details.stack,
          context: {
            'source': details.library ?? 'flutter_framework',
            if (details.context != null)
              'flutter_context': details.context.toString(),
          },
          handled: false,
        );
      };

      PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
        report(error, stack, context: {
          'source': 'platform_dispatcher',
        }, handled: false);
        return true; // handled — keep the app alive where Flutter allows it
      };
    } catch (_) {
      // Never fail app startup because of crash-report wiring.
    }
  }

  /// Manually record a handled (or unhandled) error. Safe to call from
  /// anywhere; never throws and never blocks.
  static void report(
    Object? error,
    StackTrace? stack, {
    Map<String, Object?>? context,
    bool handled = true,
  }) {
    try {
      final name = _appName;
      if (name == null) return; // init() not called — do nothing
      if (_reportCount >= _maxReportsPerSession) return;

      final signature = error?.toString() ?? 'unknown error';
      if (!_reportedSignatures.add(signature)) return; // dedupe per session
      _reportCount++;

      final payload = <String, Object?>{
        'app': name,
        if (_appVersion != null && _appVersion!.isNotEmpty)
          'app_version': _appVersion,
        'platform': _safe(() => Platform.operatingSystem),
        'os_version': _safe(() => Platform.operatingSystemVersion),
        'error': signature,
        if (stack != null) 'stack': stack.toString(),
        if (context != null && context.isNotEmpty) 'context': context,
        if (_schoolSlug() case final slug?) 'school_slug': slug,
        'handled': handled,
      };
      unawaited(_post(payload));
    } catch (_) {
      // Swallow everything — reporting must be invisible to the app.
    }
  }

  static Future<void> _post(Map<String, Object?> payload) async {
    try {
      final dio = _bareDio ??= Dio(BaseOptions(
        baseUrl: AppConstants.baseUrl + AppConstants.apiVersion,
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
        headers: {'Content-Type': 'application/json'},
      ));
      await dio.post<void>('/mobile/crash', data: payload);
    } catch (_) {
      // Offline / 5xx / parse issues: drop the report silently.
    }
  }

  static String _safe(String Function() read) {
    try {
      return read();
    } catch (_) {
      return '';
    }
  }

  /// The school tenancy header the app may have set after login; used only
  /// for best-effort grouping on the backend. Never throws.
  static String? _schoolSlug() {
    try {
      final slug = ApiClient.instance.options.headers['X-School-Slug'];
      if (slug is String && slug.isNotEmpty) return slug;
    } catch (_) {}
    return null;
  }
}
