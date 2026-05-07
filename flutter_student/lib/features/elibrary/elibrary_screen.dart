import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// E-Library — E-books, past papers, resources
class ELibraryScreen extends ConsumerStatefulWidget {
  const ELibraryScreen({super.key});

  @override
  ConsumerState<ELibraryScreen> createState() => _ELibraryScreenState();
}

class _ELibraryScreenState extends ConsumerState<ELibraryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _ebooks = [];
  List<dynamic> _pastPapers = [];
  List<dynamic> _resources = [];
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/student/elibrary');
      setState(() {
        _ebooks = (res.data?['ebooks'] as List?) ?? [];
        _pastPapers = (res.data?['past_papers'] as List?) ?? [];
        _resources = (res.data?['resources'] as List?) ?? [];
      });
    } catch (_) {}
    setState(() => _loading = false);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'elibrary',
      child: Column(
        children: [
          // Search
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search resources...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16),
              ),
              onChanged: (v) => setState(() => _search = v.toLowerCase()),
            ),
          ),
          TabBar(
            controller: _tabController,
            tabs: const [
              Tab(text: 'E-Books'),
              Tab(text: 'Past Papers'),
              Tab(text: 'Resources'),
            ],
          ),
          Expanded(
            child: _loading
                ? const LoadingShimmer()
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildList(_filterList(_ebooks), Icons.book, Colors.blue),
                      _buildList(_filterList(_pastPapers),
                          Icons.description, Colors.orange),
                      _buildList(_filterList(_resources),
                          Icons.folder_open, Colors.teal),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  List<dynamic> _filterList(List<dynamic> items) {
    if (_search.isEmpty) return items;
    return items.where((item) {
      final title = (item['title'] ?? '').toString().toLowerCase();
      final subject = (item['subject'] ?? '').toString().toLowerCase();
      return title.contains(_search) || subject.contains(_search);
    }).toList();
  }

  Widget _buildList(List<dynamic> items, IconData icon, Color color) {
    if (items.isEmpty) {
      return const Center(child: Text('Nothing found'));
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withAlpha(25),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              title: Text(item['title'] ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (item['subject'] != null)
                    Text(item['subject'],
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey[600])),
                  if (item['file_size'] != null)
                    Text(item['file_size'],
                        style: TextStyle(
                            fontSize: 11, color: Colors.grey[400])),
                ],
              ),
              trailing: IconButton(
                icon: const Icon(Icons.download_outlined),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text(
                            'Downloading "${item['title']}"...')),
                  );
                },
              ),
              isThreeLine: item['subject'] != null,
            ),
          );
        },
      ),
    );
  }
}
