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

class MobileVersionService {
  const MobileVersionService._();

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
