import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class TeachersListScreen extends ConsumerStatefulWidget {
  const TeachersListScreen({super.key});

  @override
  ConsumerState<TeachersListScreen> createState() => _TeachersListScreenState();
}

class _TeachersListScreenState extends ConsumerState<TeachersListScreen> {
  List<Map<String, dynamic>> _teachers = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await ApiClient.instance
          .get('/users', queryParameters: {'role': 'teacher', 'per_page': 100});
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _teachers = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (_) {
      _teachers = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Teachers'),
      body: _loading
          ? const LoadingShimmer()
          : RefreshIndicator(
              onRefresh: _load,
              child: _teachers.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        NoDataContainer(
                          title: 'No teachers found',
                          subtitle:
                              'Teacher directory information will appear here.',
                          icon: Icons.person_outline,
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
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.person_outline),
                              title:
                                  Text(t['full_name']?.toString() ?? 'Teacher'),
                              subtitle: Text(t['email']?.toString() ??
                                  t['phone']?.toString() ??
                                  ''),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
