import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Teacher Library — Browse and borrow books from school library
class TeacherLibraryScreen extends ConsumerStatefulWidget {
  const TeacherLibraryScreen({super.key});

  @override
  ConsumerState<TeacherLibraryScreen> createState() =>
      _TeacherLibraryScreenState();
}

class _TeacherLibraryScreenState extends ConsumerState<TeacherLibraryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _books = [];
  List<dynamic> _borrowed = [];
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
      final res = await ApiClient.instance.get('/teacher/library',
          queryParameters: _search.isNotEmpty ? {'search': _search} : null);
      final payload = res.data;
      setState(() {
        _books = safeList(payload?['books']);
        _borrowed = safeList(payload?['borrowed']);
      });
    } catch (e, st) {
      debugPrint('TeacherLibraryScreen load failed: $e\n$st');
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
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: TextField(
                      onChanged: (v) {
                        setState(() => _search = v);
                        _load();
                      },
                      decoration: InputDecoration(
                        hintText: 'Search books...',
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
                      Tab(text: 'Catalog'),
                      Tab(text: 'My Borrowed'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _BookList(books: _books),
                        _BorrowedList(borrowed: _borrowed),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _BookList extends StatelessWidget {
  final List<dynamic> books;
  const _BookList({required this.books});

  @override
  Widget build(BuildContext context) {
    if (books.isEmpty) {
      return const NoDataContainer(
        title: 'No books found',
        subtitle: 'Library catalog will appear here',
        icon: Icons.menu_book_rounded,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: books.length,
      itemBuilder: (context, index) {
        final b = books[index];
        final available = (b['available_copies'] ?? b['available'] ?? 0) > 0;
        return ListTile(
          leading: CircleAvatar(
            backgroundColor: Colors.brown.withAlpha(20),
            child: const Icon(Icons.menu_book_rounded, color: Colors.brown),
          ),
          title: Text(b['title'] ?? '—',
              style: const TextStyle(fontWeight: FontWeight.w500)),
          subtitle: Text(b['author'] ?? '—',
              style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: (available ? Colors.green : Colors.grey).withAlpha(20),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              available ? 'Available' : 'Checked Out',
              style: TextStyle(
                  fontSize: 11,
                  color: available ? Colors.green[700] : Colors.grey[600],
                  fontWeight: FontWeight.w600),
            ),
          ),
        );
      },
    );
  }
}

class _BorrowedList extends StatelessWidget {
  final List<dynamic> borrowed;
  const _BorrowedList({required this.borrowed});

  @override
  Widget build(BuildContext context) {
    if (borrowed.isEmpty) {
      return const NoDataContainer(
        title: 'No borrowed books',
        subtitle: 'Books you borrow will appear here',
        icon: Icons.library_add_check_rounded,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: borrowed.length,
      itemBuilder: (context, index) {
        final b = borrowed[index];
        final overdue = b['is_overdue'] == true;
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor:
                  (overdue ? Colors.red : Colors.blue).withAlpha(20),
              child: Icon(
                overdue ? Icons.warning_rounded : Icons.library_books_rounded,
                color: overdue ? Colors.red : Colors.blue,
              ),
            ),
            title: Text(b['title'] ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w500)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Due: ${b['due_date'] ?? '—'}',
                    style: TextStyle(
                        fontSize: 12,
                        color: overdue ? Colors.red : Colors.grey[600])),
              ],
            ),
            trailing: overdue
                ? const Chip(
                    label: Text('OVERDUE',
                        style: TextStyle(
                            fontSize: 10,
                            color: Colors.red,
                            fontWeight: FontWeight.bold)),
                    backgroundColor: Color(0x1AFF0000),
                  )
                : null,
          ),
        );
      },
    );
  }
}
