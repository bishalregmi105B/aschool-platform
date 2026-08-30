import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/plugin_manifest.dart';
import '../utils/constants.dart';
import '../utils/safe_parse.dart';
import 'api_client.dart';

/// Plugin state — tracks installed plugins for the current school
class PluginState {
  final List<InstalledPlugin> plugins;
  final Set<String> visibleModules;
  final Map<String, dynamic> visibility;
  final bool isLoading;

  const PluginState({
    this.plugins = const [],
    this.visibleModules = const <String>{},
    this.visibility = const <String, dynamic>{},
    this.isLoading = false,
  });

  /// Check if a plugin is installed by slug
  bool isInstalled(String slug) {
    return plugins.any((p) => p.slug == slug && p.isActive);
  }

  /// Check whether a module is visible for this role.
  /// If no visibility payload is present yet, default to visible.
  bool isModuleVisible(String moduleKey) {
    if (moduleKey.isEmpty) return true;
    if (visibleModules.isEmpty) return true;
    return visibleModules.contains(moduleKey);
  }

  bool canAccess({required String moduleKey, String? pluginSlug}) {
    if (!isModuleVisible(moduleKey)) return false;
    if (pluginSlug == null || pluginSlug.isEmpty) return true;
    return isInstalled(pluginSlug);
  }

  /// Get plugin config by slug.
  ///
  /// Config comes from the backend `GET /plugins/installed` response (each
  /// row carries the school's `SchoolPlugin.config` JSON — see
  /// backend/app/api/v1/plugins.py). It is cached with the plugin list in
  /// secure storage, so it survives restarts and offline starts. Returns
  /// null when the plugin is not installed/known; an installed plugin with
  /// no stored config yields the empty map the API sends.
  Map<String, dynamic>? getConfig(String slug) {
    final plugin = plugins.where((p) => p.slug == slug).firstOrNull;
    if (plugin == null) return null;
    return plugin.config ?? const {};
  }

  PluginState copyWith({
    List<InstalledPlugin>? plugins,
    Set<String>? visibleModules,
    Map<String, dynamic>? visibility,
    bool? isLoading,
  }) {
    return PluginState(
      plugins: plugins ?? this.plugins,
      visibleModules: visibleModules ?? this.visibleModules,
      visibility: visibility ?? this.visibility,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class PluginNotifier extends StateNotifier<PluginState> {
  static const _storage = FlutterSecureStorage();

  PluginNotifier(Ref ref) : super(const PluginState()) {
    _init();
  }

  Future<void> _init() async {
    // 1. Load cached plugins first (offline support)
    await _loadCached();

    // 2. Fetch fresh from API
    await fetchPlugins();

    // Socket listeners removed for now
  }

  Future<void> _loadCached() async {
    try {
      final cached = await _storage.read(key: AppConstants.pluginsKey);
      if (cached != null) {
        final list = safeMapList(jsonDecode(cached))
            .map(InstalledPlugin.fromJson)
            .toList();
        state = state.copyWith(plugins: list);
      }
    } catch (e, st) {
      debugPrint('PluginProvider.loadCached plugins failed: $e\n$st');
    }

    try {
      final cachedVisibility =
          await _storage.read(key: AppConstants.visibilityKey);
      if (cachedVisibility == null) return;

      final decoded = jsonDecode(cachedVisibility);
      if (decoded is! Map) return;

      final visibility = safeMap(decoded['visibility']);
      final modules = safeStringList(decoded['modules']).toSet();

      state = state.copyWith(visibility: visibility, visibleModules: modules);
    } catch (e, st) {
      debugPrint('PluginProvider.loadCached visibility failed: $e\n$st');
    }
  }

  /// Fetch installed plugins from API
  Future<void> fetchPlugins() async {
    state = state.copyWith(isLoading: true);
    var nextPlugins = state.plugins;
    var nextVisibility = state.visibility;
    var nextVisibleModules = state.visibleModules;

    try {
      final response = await ApiClient.instance.get('/plugins/installed');
      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = response.data['data'];
        final rawPlugins =
            data is List ? data : safeMapOrNull(data)?['plugins'];
        nextPlugins = safeMapList(rawPlugins)
            .map(InstalledPlugin.fromJson)
            .toList();
      }
    } catch (e, st) {
      // Keep cached data on error
      debugPrint('PluginProvider.fetchPlugins failed: $e\n$st');
    }

    try {
      final response = await ApiClient.instance.get('/mobile/bootstrap');
      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = safeMap(response.data['data']);
        nextVisibility = safeMap(data['visibility']);
        nextVisibleModules = safeStringList(nextVisibility['modules']).toSet();

        if (nextPlugins.isEmpty) {
          final installedSlugs = safeStringList(data['installed_plugins']);
          nextPlugins = installedSlugs
              .map((slug) => InstalledPlugin(slug: slug, name: slug))
              .toList();
        }
      }
    } catch (e, st) {
      // Keep existing visibility cache if bootstrap fails.
      debugPrint('PluginProvider.bootstrap visibility failed: $e\n$st');
    }

    state = state.copyWith(
      plugins: nextPlugins,
      visibility: nextVisibility,
      visibleModules: nextVisibleModules,
      isLoading: false,
    );

    await _storage.write(
      key: AppConstants.pluginsKey,
      value: jsonEncode(nextPlugins.map((p) => p.toJson()).toList()),
    );
    await _storage.write(
      key: AppConstants.visibilityKey,
      value: jsonEncode(
        {
          'modules': nextVisibleModules.toList(),
          'visibility': nextVisibility,
        },
      ),
    );
  }

  // Socket events removed
  Future<void> persistCache(List<InstalledPlugin> plugins) async {
    await _storage.write(
      key: AppConstants.pluginsKey,
      value: jsonEncode(plugins.map((p) => p.toJson()).toList()),
    );
  }
}

final pluginProvider =
    StateNotifierProvider<PluginNotifier, PluginState>((ref) {
  return PluginNotifier(ref);
});
