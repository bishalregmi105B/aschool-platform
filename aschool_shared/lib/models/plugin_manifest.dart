/// Plugin manifest model — represents an installed/available plugin
import '../utils/safe_parse.dart';

/// Coerce a JSON price (int, double — backend serializes via float() —
/// numeric string, null) to int without throwing.
int _priceToInt(dynamic v) => safeInt(v);

class PluginManifest {
  final String slug;
  final String name;
  final String? description;
  final String tier; // free, starter, growth, premium
  final int priceMonthly;
  final int priceYearly;
  final String? icon;
  final String? category;
  final bool isInstalled;
  final Map<String, dynamic>? config;

  const PluginManifest({
    required this.slug,
    required this.name,
    this.description,
    this.tier = 'free',
    this.priceMonthly = 0,
    this.priceYearly = 0,
    this.icon,
    this.category,
    this.isInstalled = false,
    this.config,
  });

  factory PluginManifest.fromJson(Map<String, dynamic> json) {
    return PluginManifest(
      slug: safeString(json['slug']),
      name: safeString(json['name']),
      description: safeStringOrNull(json['description']),
      tier: safeString(json['tier'], fallback: 'free'),
      priceMonthly: _priceToInt(json['price_monthly']),
      priceYearly: _priceToInt(json['price_yearly']),
      icon: safeStringOrNull(json['icon']),
      category: safeStringOrNull(json['category']),
      isInstalled: safeBool(json['is_installed']),
      config: safeMapOrNull(json['config']),
    );
  }

  Map<String, dynamic> toJson() => {
        'slug': slug,
        'name': name,
        'description': description,
        'tier': tier,
        'price_monthly': priceMonthly,
        'price_yearly': priceYearly,
        'icon': icon,
        'category': category,
        'is_installed': isInstalled,
        'config': config,
      };
}

/// Represents a plugin installed for a specific school
class InstalledPlugin {
  final String slug;
  final String name;
  final String? category;
  final String tier;
  final bool isActive;
  final DateTime? installedAt;
  final DateTime? expiresAt;

  /// Per-school plugin configuration as stored on SchoolPlugin.config
  /// (backend: GET /plugins/installed returns `config` per row; admins edit
  /// it via PUT /plugins/<slug>/config, e.g. the `last_payment` audit trail
  /// written on subscribe). Null when the API didn't include one.
  final Map<String, dynamic>? config;

  const InstalledPlugin({
    required this.slug,
    required this.name,
    this.category,
    this.tier = 'free',
    this.isActive = true,
    this.installedAt,
    this.expiresAt,
    this.config,
  });

  factory InstalledPlugin.fromJson(Map<String, dynamic> json) {
    return InstalledPlugin(
      slug: safeString(json['slug'] ?? json['plugin_slug']),
      name: safeString(json['name'] ?? json['plugin_slug']),
      category: safeStringOrNull(json['category']),
      tier: safeString(json['tier'], fallback: 'free'),
      isActive: safeBool(json['is_active'] ?? json['active'], fallback: true),
      installedAt: safeDateTime(json['installed_at']),
      expiresAt: safeDateTime(json['expires_at'] ?? json['trial_ends_at']),
      config: safeMapOrNull(json['config']),
    );
  }

  Map<String, dynamic> toJson() => {
        'slug': slug,
        'name': name,
        'category': category,
        'tier': tier,
        'is_active': isActive,
        'installed_at': installedAt?.toIso8601String(),
        'expires_at': expiresAt?.toIso8601String(),
        'config': config,
      };
}
