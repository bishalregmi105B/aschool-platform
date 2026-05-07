import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  List<Map<String, dynamic>> _books = [];
  List<Map<String, dynamic>> _issues = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/library/books'),
        ApiClient.instance.get('/library/issues'),
      ]);
      if (!mounted) return;
      setState(() {
        _books = List<Map<String, dynamic>>.from(results[0].data['data'] ?? []);
        _issues = List<Map<String, dynamic>>.from(
          results[1].data['data'] ?? [],
        );
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();

    final issued = _issues.where((item) => item['status'] == 'issued').toList();
    final overdue = _issues.where((item) {
      final status = item['status']?.toString();
      if (status == 'overdue') return true;
      final due = DateTime.tryParse(item['due_date']?.toString() ?? '');
      return status == 'issued' && due != null && due.isBefore(DateTime.now());
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Library')),
      body: DefaultTabController(
        length: 3,
        child: Column(
          children: [
            const TabBar(
              tabs: [
                Tab(text: 'Catalog'),
                Tab(text: 'Issued'),
                Tab(text: 'Overdue'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _BookCatalog(books: _books, onRefresh: _load),
                  _IssueList(
                    items: issued,
                    overdueMode: false,
                    onRefresh: _load,
                  ),
                  _IssueList(
                    items: overdue,
                    overdueMode: true,
                    onRefresh: _load,
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

class _BookCatalog extends StatelessWidget {
  final List<Map<String, dynamic>> books;
  final Future<void> Function() onRefresh;

  const _BookCatalog({required this.books, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: books.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 160),
                Center(child: Text('No books in the catalog yet')),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: books.length,
              itemBuilder: (context, index) {
                final book = books[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Container(
                      width: 40,
                      height: 50,
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Icon(Icons.book, color: Colors.blue),
                    ),
                    title: Text(book['title']?.toString() ?? 'Untitled'),
                    subtitle: Text(
                      [
                        book['author']?.toString() ?? 'Unknown author',
                        if ((book['isbn'] ?? '').toString().isNotEmpty)
                          'ISBN: ${book['isbn']}',
                      ].join(' • '),
                    ),
                    trailing: Chip(
                      label: Text(
                        '${book['available_copies'] ?? 0}/${book['total_copies'] ?? 0}',
                      ),
                      backgroundColor: Colors.green.shade50,
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class _IssueList extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final bool overdueMode;
  final Future<void> Function() onRefresh;

  const _IssueList({
    required this.items,
    required this.overdueMode,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: items.isEmpty
          ? ListView(
              children: [
                const SizedBox(height: 160),
                Center(
                  child: Text(
                    overdueMode ? 'No overdue books' : 'No active issues',
                  ),
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final issue = items[index];
                final dueText =
                    issue['due_date']?.toString().split(' ').first ?? '';
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  color: overdueMode ? Colors.red.shade50 : null,
                  child: ListTile(
                    leading: Icon(
                      overdueMode ? Icons.warning : Icons.menu_book,
                      color: overdueMode ? Colors.red : Colors.orange,
                    ),
                    title: Text(
                      issue['book_title']?.toString() ?? 'Issued book',
                    ),
                    subtitle: Text(
                      [
                        issue['student_name']?.toString() ?? 'Unknown borrower',
                        if (dueText.isNotEmpty) 'Due: $dueText',
                      ].join(' • '),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
