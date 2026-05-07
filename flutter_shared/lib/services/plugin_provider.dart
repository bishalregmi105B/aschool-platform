import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/plugin_manifest.dart';
import '../utils/constants.dart';
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

  /// Get plugin config by slug
  Map<String, dynamic>? getConfig(String slug) {
    final plugin = plugins.where((p) => p.slug == slug).firstOrNull;
    if (plugin == null) return null;
    return const {};
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
        final list = (jsonDecode(cached) as List)
            .map((e) => InstalledPlugin.fromJson(e))
            .toList();
        state = state.copyWith(plugins: list);
      }
    } catch (_) {}

    try {
      final cachedVisibility =
          await _storage.read(key: AppConstants.visibilityKey);
      if (cachedVisibility == null) return;

      final decoded = jsonDecode(cachedVisibility);
      if (decoded is! Map) return;

      final visibility =
          Map<String, dynamic>.from(decoded['visibility'] as Map? ?? const {});
      final modules =
          (decoded['modules'] as List? ?? const []).whereType<String>().toSet();

      state = state.copyWith(visibility: visibility, visibleModules: modules);
    } catch (_) {}
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
            data is List ? data : (data['plugins'] as List? ?? []);
        nextPlugins = rawPlugins
            .map((e) => InstalledPlugin.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {
      // Keep cached data on error
    }

    try {
      final response = await ApiClient.instance.get('/mobile/bootstrap');
      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = Map<String, dynamic>.from(
            response.data['data'] as Map? ?? const {});
        nextVisibility = Map<String, dynamic>.from(
            data['visibility'] as Map? ?? const <String, dynamic>{});
        nextVisibleModules = (nextVisibility['modules'] as List? ?? const [])
            .whereType<String>()
            .toSet();

        if (nextPlugins.isEmpty) {
          final installedSlugs =
              (data['installed_plugins'] as List? ?? const [])
                  .whereType<String>()
                  .toList();
          nextPlugins = installedSlugs
              .map((slug) => InstalledPlugin(slug: slug, name: slug))
              .toList();
        }
      }
    } catch (_) {
      // Keep existing visibility cache if bootstrap fails.
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
