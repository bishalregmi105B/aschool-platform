import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Students list with search, filter, CRUD
class StudentsScreen extends ConsumerStatefulWidget {
  const StudentsScreen({super.key});

  @override
  ConsumerState<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends ConsumerState<StudentsScreen> {
  List<Map<String, dynamic>> _students = [];
  bool _loading = true;
  String _search = '';
  String? _classFilter;
  int _page = 1;
  bool _hasMore = true;
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadStudents();
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
              _scrollController.position.maxScrollExtent - 200 &&
          _hasMore &&
          !_loading) {
        _loadMore();
      }
    });
  }

  Future<void> _loadStudents() async {
    setState(() => _loading = true);
    try {
      final params = <String, dynamic>{'page': 1, 'per_page': 30};
      if (_search.isNotEmpty) params['search'] = _search;
      if (_classFilter != null) params['class_id'] = _classFilter;

      final response = await ApiClient.instance
          .get('/students', queryParameters: params);
      setState(() {
        _students = List<Map<String, dynamic>>.from(response.data['data'] ?? []);
        _page = 1;
        _hasMore = (response.data['meta']?['pagination']?['has_next'] ?? false);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    _page++;
    try {
      final params = <String, dynamic>{'page': _page, 'per_page': 30};
      if (_search.isNotEmpty) params['search'] = _search;
      final response = await ApiClient.instance
          .get('/students', queryParameters: params);
      setState(() {
        _students.addAll(
            List<Map<String, dynamic>>.from(response.data['data'] ?? []));
        _hasMore = (response.data['meta']?['pagination']?['has_next'] ?? false);
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            decoration: const InputDecoration(
              hintText: 'Search students...',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (val) {
              _search = val;
              _loadStudents();
            },
          ),
        ),
        Expanded(
          child: _loading
              ? const LoadingShimmer()
              : RefreshIndicator(
                  onRefresh: _loadStudents,
                  child: ListView.builder(
                    controller: _scrollController,
                    itemCount: _students.length,
                    itemBuilder: (context, index) {
                      final s = _students[index];
                      return ListTile(
                        leading: CircleAvatar(
                          child: Text('${s['roll_number'] ?? index + 1}'),
                        ),
                        title: Text(
                            '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'),
                        subtitle: Text(
                            'Class ${s['class_name'] ?? ''} | ${s['section_name'] ?? ''}'),
                        trailing: Text(s['phone'] ?? ''),
                        onTap: () {
                          // Navigate to student detail
                        },
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
}
