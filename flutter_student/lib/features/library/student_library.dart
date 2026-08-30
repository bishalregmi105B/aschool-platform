import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Library — Book catalog, issued books, search
class StudentLibrary extends ConsumerStatefulWidget {
  const StudentLibrary({super.key});

  @override
  ConsumerState<StudentLibrary> createState() => _StudentLibraryState();
}

class _StudentLibraryState extends ConsumerState<StudentLibrary>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _catalog = [];
  List<dynamic> _issued = [];
  bool _loading = true;
  String _search = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.get('/student/library');
      setState(() {
        final payload = safeMapOrNull(res.data?['data']);
        _catalog = safeList(payload?['catalog']);
        _issued = safeList(payload?['issued']);
      });
    } catch (e, st) {
      debugPrint('StudentLibrary load failed: $e\n$st');
      _error = 'Could not load the library.';
    }
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
      pluginSlug: 'library_management',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Library'),
        body: _loading
            ? const LoadingShimmer()
            : _error != null
                ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                : Column(
          children: [
            // Search bar
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                decoration: InputDecoration(
                  hintText: 'Search books...',
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
              tabs: [
                const Tab(text: 'Catalog'),
                Tab(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('My Books'),
                      if (_issued.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.blue,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text('${_issued.length}',
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 11)),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            Expanded(
              child: _loading
                  ? const LoadingShimmer()
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _buildCatalog(),
                        _buildIssued(),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCatalog() {
    final filtered = _search.isEmpty
        ? _catalog
        : _catalog.where((b) {
            final title = (b['title'] ?? '').toString().toLowerCase();
            final author = (b['author'] ?? '').toString().toLowerCase();
            return title.contains(_search) || author.contains(_search);
          }).toList();

    if (filtered.isEmpty) {
      return const NoDataContainer(
        title: 'No books found',
        subtitle: 'Try another title, author, or category.',
        icon: Icons.search_off_rounded,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: filtered.length,
        itemBuilder: (context, index) {
          final book = filtered[index];
          final available = safeIntOrNull(book['available_copies']) ?? 0;

          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading: Container(
                width: 44,
                height: 58,
                decoration: BoxDecoration(
                  color: Colors.primaries[index % Colors.primaries.length]
                      .withAlpha(30),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Icon(Icons.menu_book, size: 24),
              ),
              title: Text(book['title'] ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(book['author'] ?? '',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (book['category'] != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.blue.withAlpha(20),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(book['category'],
                              style: const TextStyle(fontSize: 10)),
                        ),
                      const SizedBox(width: 8),
                      Icon(
                        available > 0 ? Icons.check_circle : Icons.cancel,
                        size: 14,
                        color: available > 0 ? Colors.green : Colors.red,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        available > 0
                            ? '$available available'
                            : 'Not available',
                        style: TextStyle(
                          fontSize: 11,
                          color: available > 0 ? Colors.green : Colors.red,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              isThreeLine: true,
              trailing: available > 0
                  ? IconButton(
                      icon: const Icon(Icons.bookmark_add_outlined),
                      onPressed: () => _requestBook(book),
                    )
                  : null,
            ),
          );
        },
      ),
    );
  }

  Widget _buildIssued() {
    if (_issued.isEmpty) {
      return const NoDataContainer(
        title: 'No books issued',
        subtitle: 'Issued books will appear here.',
        icon: Icons.local_library_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _issued.length,
        itemBuilder: (context, index) {
          final book = _issued[index];
          final dueDate = book['due_date'] ?? '';
          final isOverdue = book['is_overdue'] == true;

          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading: Container(
                width: 44,
                height: 58,
                decoration: BoxDecoration(
                  color: isOverdue
                      ? Colors.red.withAlpha(30)
                      : Colors.green.withAlpha(30),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Icon(Icons.book,
                    color: isOverdue ? Colors.red : Colors.green, size: 24),
              ),
              title: Text(book['title'] ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(book['author'] ?? '',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                  const SizedBox(height: 4),
                  Text(
                    'Due: $dueDate',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isOverdue ? Colors.red : Colors.grey[700],
                    ),
                  ),
                ],
              ),
              trailing: isOverdue
                  ? const Chip(
                      label: Text('OVERDUE', style: TextStyle(fontSize: 10)),
                      backgroundColor: Color(0x30F44336),
                      labelStyle: TextStyle(color: Colors.red),
                    )
                  : null,
              isThreeLine: true,
            ),
          );
        },
      ),
    );
  }

  Future<void> _requestBook(Map<String, dynamic> book) async {
    try {
      await ApiClient.instance.post(
        '/student/library/request',
        data: {'book_id': book['id']},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Book request sent! 📚'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }
}
