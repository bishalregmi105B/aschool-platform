import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Parent E-Library — Browse digital content resources for children
class ParentELibraryScreen extends ConsumerStatefulWidget {
  const ParentELibraryScreen({super.key});

  @override
  ConsumerState<ParentELibraryScreen> createState() =>
      _ParentELibraryScreenState();
}

class _ParentELibraryScreenState extends ConsumerState<ParentELibraryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _resources = [];
  List<dynamic> _pastPapers = [];
  bool _loading = true;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/parent/elibrary');
      final payload = res.data;
      setState(() {
        _resources = (payload?['resources'] as List?) ?? [];
        _pastPapers = (payload?['past_papers'] as List?) ?? [];
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
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Digital Library'),
        body: _loading
            ? const LoadingShimmer()
            : Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: TextField(
                      onChanged: (v) => setState(() => _searchQuery = v),
                      decoration: InputDecoration(
                        hintText: 'Search resources...',
                        prefixIcon: const Icon(Icons.search_rounded),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                      ),
                    ),
                  ),
                  TabBar(
                    controller: _tabController,
                    tabs: const [
                      Tab(text: 'Resources'),
                      Tab(text: 'Past Papers'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _ResourceList(
                          resources: _resources
                              .where((r) =>
                                  _searchQuery.isEmpty ||
                                  (r['title'] as String? ?? '')
                                      .toLowerCase()
                                      .contains(_searchQuery.toLowerCase()))
                              .toList(),
                        ),
                        _ResourceList(
                          resources: _pastPapers
                              .where((r) =>
                                  _searchQuery.isEmpty ||
                                  (r['title'] as String? ?? '')
                                      .toLowerCase()
                                      .contains(_searchQuery.toLowerCase()))
                              .toList(),
                          isPastPaper: true,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _ResourceList extends StatelessWidget {
  final List<dynamic> resources;
  final bool isPastPaper;

  const _ResourceList({required this.resources, this.isPastPaper = false});

  @override
  Widget build(BuildContext context) {
    if (resources.isEmpty) {
      return NoDataContainer(
        title: isPastPaper ? 'No past papers' : 'No resources',
        subtitle: isPastPaper
            ? 'Past papers will appear here'
            : 'Resources will appear here',
        icon: isPastPaper ? Icons.quiz_rounded : Icons.library_books_rounded,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: resources.length,
      itemBuilder: (context, index) {
        final r = resources[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: Colors.blue.withAlpha(20),
              child: Icon(
                isPastPaper ? Icons.quiz_rounded : Icons.description_rounded,
                color: Colors.blue,
              ),
            ),
            title: Text(r['title'] ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w500)),
            subtitle: Text(
              [r['subject'], r['class_name']]
                  .where((v) => v != null)
                  .join(' • '),
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
            trailing: r['file_url'] != null
                ? IconButton(
                    icon:
                        const Icon(Icons.download_rounded, color: Colors.blue),
                    onPressed: () {/* open url */},
                  )
                : null,
          ),
        );
      },
    );
  }
}
