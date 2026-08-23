/// Plugin manifest model — represents an installed/available plugin
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
      slug: json['slug'] as String,
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      tier: json['tier'] as String? ?? 'free',
      priceMonthly: json['price_monthly'] as int? ?? 0,
      priceYearly: json['price_yearly'] as int? ?? 0,
      icon: json['icon'] as String?,
      category: json['category'] as String?,
      isInstalled: json['is_installed'] as bool? ?? false,
      config: json['config'] as Map<String, dynamic>?,
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

  const InstalledPlugin({
    required this.slug,
    required this.name,
    this.category,
    this.tier = 'free',
    this.isActive = true,
    this.installedAt,
    this.expiresAt,
  });

  factory InstalledPlugin.fromJson(Map<String, dynamic> json) {
    return InstalledPlugin(
      slug: json['slug'] as String? ?? json['plugin_slug'] as String? ?? '',
      name: json['name'] as String? ?? json['plugin_slug'] as String? ?? '',
      category: json['category'] as String?,
      tier: json['tier'] as String? ?? 'free',
      isActive: json['is_active'] as bool? ?? json['active'] as bool? ?? true,
      installedAt: json['installed_at'] != null
          ? DateTime.tryParse(json['installed_at'] as String)
          : null,
      expiresAt: json['expires_at'] != null
          ? DateTime.tryParse(json['expires_at'] as String)
          : json['trial_ends_at'] != null
              ? DateTime.tryParse(json['trial_ends_at'] as String)
              : null,
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
      };
}
