import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Inventory & Assets — asset register CRUD against /inventory/assets.
///
/// FC-MOB: this screen previously called /inventory (a path that never
/// existed) and was written against a consumable-stock model (quantity /
/// min_quantity / unit) that the Asset backend does not have. Rewritten to
/// the real asset model: name, category, location, condition.
class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String _search = '';
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
      final res = await ApiClient.instance.get('/inventory/assets?per_page=50');
      setState(() {
        _items = List<Map<String, dynamic>>.from(res.data['data'] ?? []);
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('InventoryScreen load failed: $e\n$st');
      setState(() {
        _error = 'Could not load inventory.';
        _loading = false;
      });
    }
  }

  /// Manage sheet: edit asset fields, delete asset.
  void _showItemActions(Map<String, dynamic> item) {
    final itemId = item['id']?.toString();
    final nameCtrl = TextEditingController(text: safeStringOrNull(item['name']) ?? '');
    final categoryCtrl = TextEditingController(text: safeStringOrNull(item['category']) ?? '');
    final locationCtrl = TextEditingController(text: safeStringOrNull(item['location']) ?? '');
    String condition = safeStringOrNull(item['condition']) ?? 'good';
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 14,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 14,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                safeStringOrNull(item['name']) ?? 'Asset',
                style: Theme.of(sheetContext).textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Asset Name'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: categoryCtrl,
                decoration: const InputDecoration(labelText: 'Category'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: locationCtrl,
                decoration: const InputDecoration(labelText: 'Location'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: condition,
                decoration: const InputDecoration(labelText: 'Condition'),
                items: const [
                  DropdownMenuItem(value: 'new', child: Text('New')),
                  DropdownMenuItem(value: 'good', child: Text('Good')),
                  DropdownMenuItem(value: 'fair', child: Text('Fair')),
                  DropdownMenuItem(value: 'poor', child: Text('Poor')),
                  DropdownMenuItem(value: 'damaged', child: Text('Damaged')),
                ],
                onChanged: (v) => condition = v ?? condition,
              ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: () async {
                  try {
                    await ApiClient.instance.put('/inventory/assets/$itemId', data: {
                      'name': nameCtrl.text.trim(),
                      'category': categoryCtrl.text.trim(),
                      'location': locationCtrl.text.trim(),
                      'condition': condition,
                    });
                    if (!sheetContext.mounted) return;
                    Navigator.of(sheetContext).pop();
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Asset updated')));
                    _load();
                  } catch (_) {
                    if (!sheetContext.mounted) return;
                    ScaffoldMessenger.of(sheetContext).showSnackBar(
                        const SnackBar(content: Text('Failed to update asset')));
                  }
                },
                child: const Text('Save Changes'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Theme.of(sheetContext).colorScheme.error,
                  side: BorderSide(
                      color: Theme.of(sheetContext)
                          .colorScheme
                          .error
                          .withValues(alpha: 0.4)),
                ),
                icon: const Icon(Icons.delete_outline, size: 18),
                label: const Text('Delete asset'),
                onPressed: () async {
                  Navigator.of(sheetContext).pop();
                  try {
                    await ApiClient.instance.delete('/inventory/assets/$itemId');
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Asset deleted')));
                    _load();
                  } catch (_) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Failed to delete asset')));
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

@override
  Widget build(BuildContext context) {
    final filtered = _items
        .where(
          (i) =>
              _search.isEmpty ||
              (safeStringOrNull(i['name']) ?? '')
                  .toLowerCase()
                  .contains(_search.toLowerCase()),
        )
        .toList();

    return PluginGate(
      pluginSlug: 'inventory',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Inventory & Assets'),
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: () => _showAddItemDialog(context),
          tooltip: 'Add Asset',
          child: const Icon(Icons.add_rounded),
        ),
        body: Column(
          children: [
            // Search bar
            Padding(
              padding: const EdgeInsets.all(12),
              child: SearchBarWidget(
                hintText: 'Search assets...',
                onChanged: (v) => setState(() => _search = v),
              ),
            ),
            Expanded(
              child: _loading
                  ? const LoadingShimmer()
                  : _error != null
                      ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                      : filtered.isEmpty
                      ? const NoDataContainer(
                          title: 'No assets',
                          subtitle:
                              'Add assets to track school property',
                          icon: Icons.inventory_2_rounded,
                        )
                      : PullToRefresh(
                          onRefresh: _load,
                          child: ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            itemCount: filtered.length,
                            itemBuilder: (_, i) {
                              final item = filtered[i];
                              final condition =
                                  safeStringOrNull(item['condition']) ?? 'good';
                              final needsAttention =
                                  condition == 'poor' || condition == 'damaged';

                              return ESchoolAnimatedEntry(
                                index: i,
                                child: ESchoolCard(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  onTap: () => _showItemActions(item),
                                  child: ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    leading: CircleAvatar(
                                      backgroundColor: (needsAttention
                                              ? ASchoolTheme.danger
                                              : ASchoolTheme.primary)
                                          .withAlpha(20),
                                      child: Icon(
                                        Icons.inventory_2_rounded,
                                        color: needsAttention
                                            ? ASchoolTheme.danger
                                            : ASchoolTheme.primary,
                                        size: 20,
                                      ),
                                    ),
                                    title: Text(
                                      safeStringOrNull(item['name']) ?? '',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600),
                                    ),
                                    subtitle: Text(
                                      '${safeStringOrNull(item['category']) ?? 'Uncategorised'} • ${safeStringOrNull(item['location']) ?? 'No location'}',
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: ASchoolTheme.mutedText),
                                    ),
                                    trailing: Text(
                                      condition,
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: needsAttention
                                            ? ASchoolTheme.danger
                                            : ASchoolTheme.secondary,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddItemDialog(BuildContext context) {
    final nameCtrl = TextEditingController();
    final categoryCtrl = TextEditingController();
    final locationCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Asset'),
        content: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Asset Name *'),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: categoryCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Category (furniture, IT, sports…)'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: locationCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Location'),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              Navigator.pop(context);
              try {
                await ApiClient.instance.post('/inventory/assets', data: {
                  'name': nameCtrl.text.trim(),
                  'category': categoryCtrl.text.trim(),
                  'location': locationCtrl.text.trim(),
                });
                _load();
              } catch (e, st) {
                debugPrint('InventoryScreen addItem failed: $e\n$st');
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Failed to add asset')),
                  );
                }
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }
}
