import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Plugin marketplace — browse, install, uninstall plugins
class MarketplaceScreen extends ConsumerStatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  ConsumerState<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends ConsumerState<MarketplaceScreen> {
  final PluginRepository _repo = PluginRepository();
  List<PluginManifest> _plugins = [];
  String _filter = 'all';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final plugins = await _repo.loadMarketplace();
      setState(() {
        _plugins = plugins;
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('MarketplaceScreen load failed: $e\n$st');
      setState(() {
        _error = 'Could not load the marketplace.';
        _loading = false;
      });
    }
  }

  List<PluginManifest> get _filtered {
    if (_filter == 'all') return _plugins;
    if (_filter == 'installed') {
      return _plugins.where((p) => p.isInstalled).toList();
    }
    return _plugins.where((p) => p.tier == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              _chip('All', 'all'),
              _chip('Installed', 'installed'),
              _chip('Free', 'free'),
              _chip('Starter', 'starter'),
              _chip('Growth', 'growth'),
              _chip('Premium', 'premium'),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? LoadingShimmer.cards()
              : _error != null
                  ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                  : RefreshIndicator(
                  onRefresh: _load,
                  child: GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.85,
                    ),
                    itemCount: _filtered.length,
                    itemBuilder: (_, i) => _pluginCard(_filtered[i]),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _chip(String label, String value) {
    final active = _filter == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: active,
        onSelected: (_) => setState(() => _filter = value),
      ),
    );
  }

  Widget _pluginCard(PluginManifest p) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _showDetail(p),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: ASchoolTheme.primary.withAlpha(20),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(_iconFor(p.icon), color: ASchoolTheme.primary),
              ),
              const SizedBox(height: 10),
              Text(p.name,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
              const SizedBox(height: 4),
              _tierBadge(p.tier),
              const SizedBox(height: 4),
              if (p.priceMonthly > 0)
                Text('Rs ${p.priceMonthly}/mo',
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]))
              else
                const Text('Free',
                    style:
                        TextStyle(fontSize: 12, color: ASchoolTheme.success)),
              const Spacer(),
              if (p.isInstalled)
                const Icon(Icons.check_circle,
                    color: ASchoolTheme.success, size: 20)
              else
                const Icon(Icons.add_circle_outline,
                    color: ASchoolTheme.primary, size: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tierBadge(String tier) {
    Color color;
    switch (tier) {
      case 'free':
        color = ASchoolTheme.success;
        break;
      case 'starter':
        color = ASchoolTheme.primary;
        break;
      case 'growth':
        color = ASchoolTheme.warning;
        break;
      case 'premium':
        color = const Color(0xFF8B5CF6);
        break;
      default:
        color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
          color: color.withAlpha(20), borderRadius: BorderRadius.circular(8)),
      child: Text(tier.toUpperCase(),
          style: TextStyle(
              fontSize: 9, fontWeight: FontWeight.w600, color: color)),
    );
  }

  IconData _iconFor(String? icon) {
    switch (icon) {
      case 'school':
        return Icons.school;
      case 'calendar_today':
        return Icons.calendar_today;
      case 'payment':
        return Icons.payment;
      case 'library_books':
        return Icons.library_books;
      case 'analytics':
        return Icons.analytics;
      case 'chat':
        return Icons.chat;
      case 'bus_alert':
        return Icons.bus_alert;
      case 'health_and_safety':
        return Icons.health_and_safety;
      case 'psychology':
        return Icons.psychology;
      case 'auto_awesome':
        return Icons.auto_awesome;
      default:
        return Icons.extension;
    }
  }

  void _showDetail(PluginManifest p) {
    // Per-school plugin config fetched/cached via pluginProvider
    // (SchoolPlugin.config on the backend).
    final config = ref.read(pluginProvider).getConfig(p.slug);
    final lastPayment = config?['last_payment'];
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: ASchoolTheme.primary.withAlpha(20),
                borderRadius: BorderRadius.circular(16),
              ),
              child:
                  Icon(_iconFor(p.icon), color: ASchoolTheme.primary, size: 32),
            ),
            const SizedBox(height: 16),
            Text(p.name, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            _tierBadge(p.tier),
            const SizedBox(height: 8),
            Text(p.category ?? '', style: TextStyle(color: Colors.grey[600])),
            const SizedBox(height: 4),
            if (p.priceMonthly > 0)
              Text('Rs ${p.priceMonthly}/month',
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.bold))
            else
              const Text('Free',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: ASchoolTheme.success)),
            if (lastPayment is Map) ...[
              const SizedBox(height: 12),
              Text(
                'Paid via ${lastPayment['provider'] ?? 'unknown'}'
                ' · txn ${lastPayment['transaction_id'] ?? '-'}',
                style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                    fontStyle: FontStyle.italic),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: p.isInstalled
                  ? OutlinedButton(
                      onPressed: () => _togglePlugin(p, false),
                      style: OutlinedButton.styleFrom(
                          foregroundColor: ASchoolTheme.danger),
                      child: const Text('Uninstall'),
                    )
                  : FilledButton(
                      onPressed: () => _togglePlugin(p, true),
                      child: Text(p.priceMonthly > 0
                          ? 'Subscribe & Install'
                          : 'Install'),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  /// Backend contract (`api/v1/plugins.py`): POST /plugins/install and
  /// POST /plugins/uninstall both take {"plugin_slug": ...} in the body —
  /// there is no /plugins/{slug}/install or DELETE .../uninstall.
  Future<void> _togglePlugin(PluginManifest p, bool install) async {
    Navigator.pop(context);
    try {
      if (install) {
        await _repo.install(p.slug);
      } else {
        await _repo.uninstall(p.slug);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content:
                Text(install ? '${p.name} installed' : '${p.name} uninstalled')));
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (e, st) {
      debugPrint('MarketplaceScreen ${install ? 'install' : 'uninstall'}(${p.slug}) failed: $e\n$st');
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Operation failed')));
      }
    }
  }
}
