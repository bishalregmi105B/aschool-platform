import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Teacher Library — catalog, active issues, and overdue books.
///
/// Backed by GET /api/v1/library/teacher/library, which returns
/// `{success, data: {books: [...], issues: [...], overdue: [...], summary: {...}}}`.
/// - book rows: {id,title,author,isbn,category,total_copies,available_copies,shelf_location}
/// - issue rows: {id,book_title,student_name,issued_date,due_date,status,overdue_days,fine_amount}
///   (`status` may be "overdue" for issued-and-past-due books)
/// - `summary` may be absent on older backends; parsing stays null-safe.
class TeacherLibraryScreen extends ConsumerStatefulWidget {
  const TeacherLibraryScreen({super.key});

  @override
  ConsumerState<TeacherLibraryScreen> createState() =>
      _TeacherLibraryScreenState();
}

class _TeacherLibraryScreenState extends ConsumerState<TeacherLibraryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Map<String, dynamic>> _books = [];
  List<Map<String, dynamic>> _issues = [];
  List<Map<String, dynamic>> _overdue = [];
  Map<String, dynamic> _summary = {};
  bool _loading = true;
  String _search = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.get('/library/teacher/library');
      // Unwrap the {success, data, error} envelope; tolerant of a payload
      // delivered without the envelope (falls back to the raw map).
      final payload = envelopeObject(res.data, source: 'TeacherLibraryScreen');
      setState(() {
        _books = safeMapList(payload?['books']);
        _issues = safeMapList(payload?['issues']);
        _overdue = safeMapList(payload?['overdue']);
        _summary = safeMap(payload?['summary']);
      });
    } catch (e, st) {
      debugPrint('TeacherLibraryScreen load failed: $e\n$st');
      _error = 'Could not load the library.';
    }
    if (mounted) setState(() => _loading = false);
  }

  /// The endpoint has no server-side search — filter the loaded catalog.
  List<Map<String, dynamic>> get _filteredBooks {
    final q = _search.trim().toLowerCase();
    if (q.isEmpty) return _books;
    return _books.where((b) {
      final title = safeString(b['title']).toLowerCase();
      final author = safeString(b['author']).toLowerCase();
      final category = safeString(b['category']).toLowerCase();
      return title.contains(q) || author.contains(q) || category.contains(q);
    }).toList();
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
                          onChanged: (v) => setState(() => _search = v),
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
                      if (_summary.isNotEmpty) _SummaryBar(summary: _summary),
                      TabBar(
                        controller: _tabController,
                        tabs: const [
                          Tab(text: 'Catalog'),
                          Tab(text: 'Issued'),
                          Tab(text: 'Overdue'),
                        ],
                      ),
                      Expanded(
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            _BookList(books: _filteredBooks),
                            _IssueList(
                                issues: _issues, overdueMode: false),
                            _IssueList(
                                issues: _overdue, overdueMode: true),
                          ],
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }
}

/// Compact summary strip from the endpoint's optional `summary` object.
class _SummaryBar extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _SummaryBar({required this.summary});

  @override
  Widget build(BuildContext context) {
    final stats = [
      ('Titles', safeInt(summary['total_books'])),
      ('Copies', safeInt(summary['total_copies'])),
      ('Available', safeInt(summary['available_copies'])),
      ('Issued', safeInt(summary['active_issues'])),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Row(
        children: [
          for (final (label, value) in stats)
            Expanded(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 3),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.brown.withAlpha(15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('$value',
                        style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Colors.brown)),
                    Text(label,
                        style: TextStyle(
                            fontSize: 11, color: Colors.grey[600])),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _BookList extends StatelessWidget {
  final List<Map<String, dynamic>> books;
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
    return RefreshIndicator(
      onRefresh: () async {},
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: books.length,
        itemBuilder: (context, index) {
          final b = books[index];
          final available = safeInt(b['available_copies']) > 0;
          final shelf = safeStringOrNull(b['shelf_location']);
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: Colors.brown.withAlpha(20),
              child: const Icon(Icons.menu_book_rounded, color: Colors.brown),
            ),
            title: Text(safeStringOrNull(b['title']) ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w500)),
            subtitle: Text(
              [
                safeStringOrNull(b['author']) ?? '—',
                if (shelf != null && shelf.isNotEmpty) 'Shelf: $shelf',
              ].join(' • '),
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
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
      ),
    );
  }
}

class _IssueList extends StatelessWidget {
  final List<Map<String, dynamic>> issues;
  final bool overdueMode;
  const _IssueList({required this.issues, required this.overdueMode});

  @override
  Widget build(BuildContext context) {
    if (issues.isEmpty) {
      return NoDataContainer(
        title: overdueMode ? 'No overdue books' : 'No active issues',
        subtitle: overdueMode
            ? 'Issued books past their due date will appear here'
            : 'Issued books will appear here',
        icon: overdueMode
            ? Icons.warning_rounded
            : Icons.library_add_check_rounded,
      );
    }
    return RefreshIndicator(
      onRefresh: () async {},
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: issues.length,
        itemBuilder: (context, index) {
          final i = issues[index];
          final status = safeStringOrNull(i['status']);
          final overdueDays = safeInt(i['overdue_days']);
          final isOverdue =
              overdueMode || status == 'overdue' || overdueDays > 0;
          final fine = safeDouble(i['fine_amount']);
          final dueDate = safeStringOrNull(i['due_date']) ?? '—';
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor:
                    (isOverdue ? Colors.red : Colors.blue).withAlpha(20),
                child: Icon(
                  isOverdue ? Icons.warning_rounded : Icons.library_books_rounded,
                  color: isOverdue ? Colors.red : Colors.blue,
                ),
              ),
              title: Text(safeStringOrNull(i['book_title']) ?? '—',
                  style: const TextStyle(fontWeight: FontWeight.w500)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    safeStringOrNull(i['student_name']) ?? 'Unknown borrower',
                    style: TextStyle(
                        fontSize: 12, color: Colors.grey[600]),
                  ),
                  Text(
                    'Due: $dueDate',
                    style: TextStyle(
                        fontSize: 12,
                        color: isOverdue ? Colors.red : Colors.grey[600]),
                  ),
                  if (fine > 0)
                    Text(
                      'Fine: Rs. ${_formatFine(fine)}',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.deepOrange),
                    ),
                ],
              ),
              trailing: isOverdue
                  ? Chip(
                      label: Text(
                        overdueDays > 0 ? 'OVERDUE • ${overdueDays}d' : 'OVERDUE',
                        style: const TextStyle(
                            fontSize: 10,
                            color: Colors.red,
                            fontWeight: FontWeight.bold),
                      ),
                      backgroundColor: const Color(0x1AFF0000),
                    )
                  : (status == 'returned'
                      ? const Chip(
                          label: Text('RETURNED',
                              style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.grey,
                                  fontWeight: FontWeight.bold)),
                          backgroundColor: Color(0x149E9E9E),
                        )
                      : null),
            ),
          );
        },
      ),
    );
  }

  static String _formatFine(double fine) =>
      fine == fine.roundToDouble() ? fine.toInt().toString() : fine.toStringAsFixed(2);
}
