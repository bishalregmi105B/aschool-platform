import 'api_client.dart';

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
      message: json['message'] as String? ??
          'A newer ASchool app version is available.',
      storeUrls: {
        'student': json['student_store_url'] as String?,
        'teacher': json['teacher_store_url'] as String?,
        'parent': json['parent_store_url'] as String?,
        'admin': json['admin_store_url'] as String?,
      },
      minimumVersions: {
        'student': json['student_min_version'] as String? ?? '1.0.0',
        'teacher': json['teacher_min_version'] as String? ?? '1.0.0',
        'parent': json['parent_min_version'] as String? ?? '1.0.0',
        'admin': json['admin_min_version'] as String? ?? '1.0.0',
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
      Map<String, dynamic>.from(response.data['data'] ?? {}),
    );
  }
}
