import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Parent Portfolio — View child's learning portfolio entries
class ParentPortfolioScreen extends ConsumerStatefulWidget {
  const ParentPortfolioScreen({super.key});

  @override
  ConsumerState<ParentPortfolioScreen> createState() =>
      _ParentPortfolioScreenState();
}

class _ParentPortfolioScreenState extends ConsumerState<ParentPortfolioScreen> {
  List<dynamic> _entries = [];
  Map<String, dynamic>? _summary;
  bool _loading = true;
  String _selectedCategory = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/parent/portfolio',
          queryParameters: _selectedCategory.isNotEmpty
              ? {'category': _selectedCategory}
              : null);
      final payload = res.data;
      setState(() {
        _entries = (payload?['entries'] as List?) ?? [];
        _summary = (payload?['summary'] as Map?)?.cast<String, dynamic>();
      });
    } catch (_) {}
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final categories = [
      '',
      'academic',
      'creative',
      'sports',
      'community',
      'project'
    ];

    return PluginGate(
      pluginSlug: 'student_portfolio',
      child: Scaffold(
        appBar: const CustomAppBar(title: "Child's Portfolio"),
        body: _loading
            ? const LoadingShimmer()
            : CustomScrollView(
                slivers: [
                  // Summary header
                  if (_summary != null)
                    SliverToBoxAdapter(
                      child: Container(
                        margin: const EdgeInsets.all(16),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.primary.withAlpha(10),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: theme.colorScheme.primary.withAlpha(30)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _SummaryStat(
                              icon: Icons.folder_open_rounded,
                              label: 'Total',
                              value: '${_summary?['total_entries'] ?? 0}',
                            ),
                            _SummaryStat(
                              icon: Icons.star_rounded,
                              label: 'Featured',
                              value: '${_summary?['featured'] ?? 0}',
                            ),
                            _SummaryStat(
                              icon: Icons.category_rounded,
                              label: 'Categories',
                              value: '${_summary?['categories'] ?? 0}',
                            ),
                          ],
                        ),
                      ),
                    ),
                  // Category filter chips
                  SliverToBoxAdapter(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: categories.map((cat) {
                          final label = cat.isEmpty
                              ? 'All'
                              : cat[0].toUpperCase() + cat.substring(1);
                          final selected = _selectedCategory == cat;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: FilterChip(
                              label: Text(label),
                              selected: selected,
                              onSelected: (_) {
                                setState(() => _selectedCategory = cat);
                                _load();
                              },
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 8)),
                  // Entries
                  _entries.isEmpty
                      ? SliverFillRemaining(
                          child: NoDataContainer(
                            title: 'No portfolio entries',
                            subtitle:
                                'Portfolio entries will appear here once added',
                            icon: Icons.folder_special_rounded,
                          ),
                        )
                      : SliverPadding(
                          padding: const EdgeInsets.all(12),
                          sliver: SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) {
                                final e = _entries[index];
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      if (e['thumbnail_url'] != null)
                                        ClipRRect(
                                          borderRadius:
                                              const BorderRadius.vertical(
                                                  top: Radius.circular(12)),
                                          child: Image.network(
                                            e['thumbnail_url'],
                                            height: 160,
                                            width: double.infinity,
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) =>
                                                const SizedBox.shrink(),
                                          ),
                                        ),
                                      Padding(
                                        padding: const EdgeInsets.all(14),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Expanded(
                                                    child: Text(
                                                  e['title'] ?? '—',
                                                  style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      fontSize: 15),
                                                )),
                                                if (e['is_featured'] == true)
                                                  const Icon(Icons.star_rounded,
                                                      color: Colors.amber,
                                                      size: 18),
                                              ],
                                            ),
                                            if (e['description'] != null)
                                              Padding(
                                                padding: const EdgeInsets.only(
                                                    top: 4),
                                                child: Text(
                                                  e['description'],
                                                  style: TextStyle(
                                                      fontSize: 13,
                                                      color: Colors.grey[600]),
                                                  maxLines: 2,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                              ),
                                            const SizedBox(height: 8),
                                            Row(
                                              children: [
                                                if (e['category'] != null)
                                                  Chip(
                                                    label: Text(
                                                      e['category'],
                                                      style: const TextStyle(
                                                          fontSize: 11),
                                                    ),
                                                    padding: EdgeInsets.zero,
                                                    visualDensity:
                                                        VisualDensity.compact,
                                                  ),
                                                const Spacer(),
                                                Text(
                                                  e['created_at'] ?? '—',
                                                  style: TextStyle(
                                                      fontSize: 11,
                                                      color: Colors.grey[500]),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                              childCount: _entries.length,
                            ),
                          ),
                        ),
                ],
              ),
      ),
    );
  }
}

class _SummaryStat extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _SummaryStat({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 4),
        Text(value,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
      ],
    );
  }
}
