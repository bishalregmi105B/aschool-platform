import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ClassmatesScreen extends ConsumerStatefulWidget {
  const ClassmatesScreen({super.key});

  @override
  ConsumerState<ClassmatesScreen> createState() => _ClassmatesScreenState();
}

class _ClassmatesScreenState extends ConsumerState<ClassmatesScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _classmates = [];
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
      final res = await ApiClient.instance
          .get('/students', queryParameters: {'per_page': 100});
      if (res.data != null && res.data['data'] != null) {
        _classmates = List<Map<String, dynamic>>.from(res.data['data']);
      }
    } catch (e, st) {
      debugPrint('ClassmatesScreen load failed: $e\n$st');
      _classmates = [];
      _error = 'Could not load your classmates.';
    }
    if (mounted) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'My Classmates'),
      body: _loading
          ? const LoadingShimmer()
          : _error != null
              ? ErrorContainer(errorMessage: _error!, onRetry: _load)
              : RefreshIndicator(
              onRefresh: _load,
              child: _classmates.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        NoDataContainer(
                          title: 'No classmates found',
                          subtitle: 'Your class roster will appear here.',
                          icon: Icons.groups_rounded,
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _classmates.length,
                      itemBuilder: (context, index) {
                        final student = _classmates[index];
                        final name = student['full_name'] ??
                            student['first_name'] ??
                            'Student';
                        final initial = name.toString().isNotEmpty
                            ? name.toString()[0].toUpperCase()
                            : 'S';

                        return ESchoolAnimatedEntry(
                          index: index,
                          child: ESchoolCard(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: CircleAvatar(
                                backgroundColor:
                                    ASchoolTheme.primary.withAlpha(20),
                                child: Text(initial,
                                    style: const TextStyle(
                                        color: ASchoolTheme.primary,
                                        fontWeight: FontWeight.w700)),
                              ),
                              title: Text(name,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              subtitle: Text(student['gender'] ?? 'Classmate'),
                              trailing: IconButton(
                                icon:
                                    const Icon(Icons.person_add_alt_1_outlined),
                                onPressed: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content: Text('Friend request sent!')),
                                  );
                                },
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
