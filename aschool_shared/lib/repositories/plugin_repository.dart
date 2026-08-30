import 'package:dio/dio.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import 'exceptions.dart';

/// Plugin marketplace / install repository.
///
/// Backend routes (`backend/app/api/v1/plugins.py`, prefix `/plugins`):
/// - GET  /plugins/marketplace
/// - POST /plugins/install   body {"plugin_slug": ..., "billing_cycle": ...}
/// - POST /plugins/uninstall body {"plugin_slug": ...}
///
/// Note: install/uninstall take the slug in the body — there is no
/// POST /plugins/{slug}/install or DELETE /plugins/{slug}/uninstall.
class PluginRepository {
  /// Browse the published plugin catalog; entries carry `is_installed`
  /// for the current school.
  Future<List<PluginManifest>> loadMarketplace() async {
    try {
      final response = await ApiClient.instance.get('/plugins/marketplace');
      final data = _unwrap(response, 'Failed to load marketplace');
      return (data is List ? data : const [])
          .whereType<Map>()
          .map((e) => PluginManifest.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw _fromDio(e, 'Failed to load marketplace');
    }
  }

  /// Install a plugin for the current school (201 on success).
  /// Server-side restricted to superadmin/school_admin.
  Future<void> install(String slug, {String billingCycle = 'monthly'}) async {
    try {
      await ApiClient.instance.post('/plugins/install', data: {
        'plugin_slug': slug,
        'billing_cycle': billingCycle,
      });
    } on DioException catch (e) {
      throw _fromDio(e, 'Install failed');
    }
  }

  /// Soft-uninstall a plugin for the current school.
  /// Server-side restricted to superadmin/school_admin.
  Future<void> uninstall(String slug) async {
    try {
      await ApiClient.instance.post('/plugins/uninstall',
          data: {'plugin_slug': slug});
    } on DioException catch (e) {
      throw _fromDio(e, 'Uninstall failed');
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────

  /// Validate the {success, data, error} envelope and return `data`.
  dynamic _unwrap(dynamic response, String fallback) {
    final payload = response.data;
    if (payload is Map && payload['success'] == true) return payload['data'];
    throw ApiException(
      payload is Map && payload['error'] != null
          ? payload['error'].toString()
          : fallback,
      statusCode: response.statusCode,
    );
  }

  ApiException _fromDio(DioException e, String fallback) {
    final data = e.response?.data;
    final message = (data is Map && data['error'] != null)
        ? data['error'].toString()
        : fallback;
    return ApiException(message, statusCode: e.response?.statusCode);
  }
}
