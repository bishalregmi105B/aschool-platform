import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class TeachersScreen extends ConsumerStatefulWidget {
  const TeachersScreen({super.key});

  @override
  ConsumerState<TeachersScreen> createState() => _TeachersScreenState();
}

class _TeachersScreenState extends ConsumerState<TeachersScreen> {
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
      final r = await ApiClient.instance.get('/users', queryParameters: {
        'role': 'teacher',
        'per_page': 100,
      });
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _teachers = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (e, st) {
      debugPrint('TeachersScreen load failed: $e\n$st');
      _teachers = [];
      _error = 'Could not load teachers.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingShimmer());
    if (_error != null) {
      return Scaffold(
        body: ErrorContainer(errorMessage: _error!, onRetry: _load),
      );
    }

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: _teachers.length,
          itemBuilder: (_, i) {
            final t = _teachers[i];
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                leading: const Icon(Icons.supervisor_account_outlined),
                title: Text(t['full_name']?.toString() ?? 'Teacher'),
                subtitle: Text(
                    t['email']?.toString() ?? t['phone']?.toString() ?? ''),
                trailing: Icon(
                  Icons.chevron_right,
                  color: Theme.of(context).colorScheme.outline,
                ),
                onTap: () => _showTeacherActions(t),
              ),
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateDialog,
        icon: const Icon(Icons.add),
        label: const Text('Add Teacher'),
      ),
    );
  }

  /// Manage sheet for one teacher: activate/deactivate, delete.
  void _showTeacherActions(Map<String, dynamic> t) {
    final userId = t['id']?.toString();
    final isActive = t['is_active'] == true;
    final name = t['full_name']?.toString() ?? 'Teacher';
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(name,
                  style: Theme.of(sheetContext).textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(
                t['email']?.toString() ?? t['phone']?.toString() ?? '',
                style: Theme.of(sheetContext).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  isActive
                      ? Icons.block_outlined
                      : Icons.check_circle_outline,
                  size: 20,
                ),
                title: Text(isActive ? 'Deactivate account' : 'Activate account'),
                onTap: () async {
                  Navigator.of(sheetContext).pop();
                  try {
                    await ApiClient.instance
                        .post('/users/$userId/toggle-active');
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(isActive
                            ? 'Teacher deactivated'
                            : 'Teacher activated')));
                    _load();
                  } catch (_) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Failed to update teacher')));
                  }
                },
              ),
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.delete_outline,
                    size: 20, color: Theme.of(sheetContext).colorScheme.error),
                title: Text('Delete teacher',
                    style: TextStyle(
                        color: Theme.of(sheetContext).colorScheme.error)),
                onTap: () async {
                  Navigator.of(sheetContext).pop();
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (dialogContext) => AlertDialog(
                      title: Text('Delete $name?'),
                      content: const Text(
                          'Their login is removed. Class assignments need a new teacher afterwards.'),
                      actions: [
                        TextButton(
                          onPressed: () =>
                              Navigator.of(dialogContext).pop(false),
                          child: const Text('Cancel'),
                        ),
                        FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor:
                                Theme.of(dialogContext).colorScheme.error,
                          ),
                          onPressed: () =>
                              Navigator.of(dialogContext).pop(true),
                          child: const Text('Delete'),
                        ),
                      ],
                    ),
                  );
                  if (ok != true) return;
                  try {
                    await ApiClient.instance.delete('/users/$userId');
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Teacher deleted')));
                    _load();
                  } catch (_) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text(
                            'Failed to delete — the teacher may have class assignments')));
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showCreateDialog() async {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Teacher'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Full name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              final phone = phoneCtrl.text.trim();
              if (name.isEmpty || phone.isEmpty) return;
              try {
                await ApiClient.instance.post('/users', data: {
                  'full_name': name,
                  'phone': phone,
                  'email': emailCtrl.text.trim().isEmpty
                      ? null
                      : emailCtrl.text.trim(),
                  'role': 'teacher',
                });
              } catch (e) {
                debugPrint('TeachersScreen create failed: $e');
                if (!context.mounted) return;
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('Could not create teacher. Please retry.')),
                );
                return;
              }
              if (!context.mounted) return;
              Navigator.pop(context);
              await _load();
              if (!mounted) return;
              ScaffoldMessenger.of(this.context).showSnackBar(
                const SnackBar(content: Text('Teacher created')),
              );
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    nameCtrl.dispose();
    phoneCtrl.dispose();
    emailCtrl.dispose();
  }
}
