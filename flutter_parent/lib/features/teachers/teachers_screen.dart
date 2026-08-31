import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ParentTeachersScreen extends ConsumerStatefulWidget {
  const ParentTeachersScreen({super.key});

  @override
  ConsumerState<ParentTeachersScreen> createState() =>
      _ParentTeachersScreenState();
}

class _ParentTeachersScreenState extends ConsumerState<ParentTeachersScreen> {
  List<Map<String, dynamic>> _teachers = [];
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
      // Parents may not list raw users (403) — the chat contacts endpoint
      // returns the same teachers with proper role-matrix filtering.
      dynamic data;
      try {
        final r = await ApiClient.instance
            .get('/users', queryParameters: {'role': 'teacher', 'per_page': 100});
        data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
        // normalize pagination wrapper
        if (data is Map<String, dynamic> && data['items'] is List) {
          data = data['items'];
        }
      } catch (_) {
        data = null;
      }
      data ??= await ApiClient.instance.get('/communications/contacts').then(
            (r) => (r.data is Map<String, dynamic>) ? r.data['data'] : null,
          );
      _teachers = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (e, st) {
      debugPrint('ParentTeachersScreen load failed: $e\n$st');
      _teachers = [];
      _error = 'Could not load teachers.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();
    if (_error != null) {
      return ErrorContainer(errorMessage: _error!, onRetry: _load);
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: _teachers.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                NoDataContainer(
                  title: 'No teachers found',
                  subtitle: 'Teacher profiles will appear here.',
                  icon: Icons.person_search_rounded,
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _teachers.length,
              itemBuilder: (_, i) {
                final t = _teachers[i];
                return ESchoolAnimatedEntry(
                  index: i,
                  child: ESchoolCard(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: EdgeInsets.zero,
                    child: ListTile(
                      leading: const Icon(Icons.person_outline),
                      title: Text(
                          (t['full_name'] ?? t['name'])?.toString() ??
                              'Teacher'),
                      subtitle: Text(
                        t['email']?.toString() ??
                            t['phone']?.toString() ??
                            t['role']?.toString() ??
                            '',
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
