import 'package:flutter/foundation.dart' show debugPrint;

import 'api_client.dart';
import '../utils/safe_parse.dart';

class MobileVersionPolicy {
  final bool forceUpdate;
  final String message;
  final Map<String, String?> storeUrls;
  final Map<String, String> minimumVersions;

  const MobileVersionPolicy({
    required this.forceUpdate,
    required this.message,
    required this.storeUrls,
    required this.minimumVersions,
  });

  factory MobileVersionPolicy.fromJson(Map<String, dynamic> json) {
    return MobileVersionPolicy(
      forceUpdate: json['force_update'] == true,
      message: safeString(json['message'],
          fallback: 'A newer ASchool app version is available.'),
      storeUrls: {
        'student': safeStringOrNull(json['student_store_url']),
        'teacher': safeStringOrNull(json['teacher_store_url']),
        'parent': safeStringOrNull(json['parent_store_url']),
        'admin': safeStringOrNull(json['admin_store_url']),
      },
      minimumVersions: {
        'student': safeString(json['student_min_version'], fallback: '1.0.0'),
        'teacher': safeString(json['teacher_min_version'], fallback: '1.0.0'),
        'parent': safeString(json['parent_min_version'], fallback: '1.0.0'),
        'admin': safeString(json['admin_min_version'], fallback: '1.0.0'),
      },
    );
  }

  String? storeUrlFor(String app) => storeUrls[app];
}

/// A-07: resolved server-driven ops state for a single app.
///
/// [error] is non-null when the check itself failed (offline, unauthenticated,
/// malformed payload). Fail-open contract: both blocking flags stay false so
/// an offline user is never trapped behind the gate.
class AppOpsState {
  final bool forceUpdate;
  final bool maintenance;
  final String maintenanceMessage;
  final String? storeUrl;
  final String message;
  final String? error;

  const AppOpsState({
    required this.forceUpdate,
    required this.maintenance,
    this.maintenanceMessage = '',
    this.storeUrl,
    this.message = '',
    this.error,
  });

  const AppOpsState.failOpen({this.error})
      : forceUpdate = false,
        maintenance = false,
        maintenanceMessage = '',
        storeUrl = null,
        message = '';

  bool get hasError => error != null;
}

class MobileVersionService {
  const MobileVersionService._();

  /// A-07: fetch the server-driven ops flags (force update + maintenance) for
  /// one app. Must be called through the app's authed [ApiClient] — the
  /// endpoint requires JWT + school context. Never throws: on any failure it
  /// returns an [AppOpsState.failOpen] (both flags false, `error` recorded).
  static Future<AppOpsState> checkOps({
    required String appName,
    String? currentVersion,
  }) async {
    try {
      final response = await ApiClient.instance.get(
        '/mobile/version',
        queryParameters: {
          'app': appName,
          if (currentVersion != null && currentVersion.isNotEmpty)
            'version': currentVersion,
        },
      );
      final data = safeMap(envelopeData(response.data));
      return AppOpsState(
        forceUpdate: safeBool(data['force_update']),
        maintenance: safeBool(data['maintenance']),
        maintenanceMessage: safeString(data['maintenance_message']),
        storeUrl: safeStringOrNull(data['${appName}_store_url']),
        message: safeString(data['message']),
      );
    } catch (e) {
      debugPrint(
          'MobileVersionService.checkOps($appName) failed — failing open: $e');
      return AppOpsState.failOpen(error: e.toString());
    }
  }

  static Future<MobileVersionPolicy> fetchPolicy({
    required String app,
    required String currentVersion,
  }) async {
    final response = await ApiClient.instance.get(
      '/mobile/version',
      queryParameters: {
        'app': app,
        'version': currentVersion,
      },
    );
    return MobileVersionPolicy.fromJson(
      safeMap(envelopeData(response.data)),
    );
  }
}
