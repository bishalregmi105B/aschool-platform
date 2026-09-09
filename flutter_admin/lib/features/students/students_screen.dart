import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Students list with search, class filter, infinite scroll, and full CRUD:
/// tap → detail sheet (edit/delete), FAB → enroll (AI-assistable via the
/// shared /ai-tools/form-assist sheet).
class StudentsScreen extends ConsumerStatefulWidget {
  const StudentsScreen({super.key});

  @override
  ConsumerState<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends ConsumerState<StudentsScreen> {
  List<Map<String, dynamic>> _students = [];
  bool _loading = true;
  String? _error;
  String _search = '';
  String? _classFilter;
  List<Map<String, dynamic>> _classes = [];
  int _page = 1;
  bool _hasMore = true;
  final _scrollController = ScrollController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _loadStudents();
    _loadClasses();
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
              _scrollController.position.maxScrollExtent - 200 &&
          _hasMore &&
          !_loading) {
        _loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadClasses() async {
    try {
      final response =
          await ApiClient.instance.get('/academics/classes');
      setState(() {
        _classes = List<Map<String, dynamic>>.from(
            response.data['data'] ?? []);
      });
    } catch (_) {
      // Filter simply stays empty if classes can't load.
    }
  }

  Future<void> _loadStudents() async {
    setState(() {
      _loading = true;
      _error = null;
    });
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
    } catch (e, st) {
      debugPrint('StudentsScreen load failed: $e\n$st');
      setState(() {
        _error = 'Could not load students.';
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    _page++;
    try {
      final params = <String, dynamic>{'page': _page, 'per_page': 30};
      if (_search.isNotEmpty) params['search'] = _search;
      if (_classFilter != null) params['class_id'] = _classFilter;
      final response = await ApiClient.instance
          .get('/students', queryParameters: params);
      setState(() {
        _students.addAll(
            List<Map<String, dynamic>>.from(response.data['data'] ?? []));
        _hasMore = (response.data['meta']?['pagination']?['has_next'] ?? false);
      });
    } catch (e, st) {
      // Pagination failure keeps the already-loaded list usable.
      debugPrint('StudentsScreen loadMore failed: $e\n$st');
    }
  }

  Future<void> _openDetail(Map<String, dynamic> student) async {
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    child: Text('${student['roll_number'] ?? '?'}'),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${student['first_name'] ?? ''} ${student['last_name'] ?? ''}',
                          style: Theme.of(sheetContext)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          'Class ${student['class_name'] ?? '—'}'
                          '${student['section_name'] != null ? ' - ${student['section_name']}' : ''}'
                          ' · ${student['enrollment_number'] ?? student['student_id'] ?? 'No ID'}',
                          style: Theme.of(sheetContext).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              if (student['phone'] != null)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.phone_outlined, size: 18),
                  title: Text('${student['phone']}'),
                ),
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.edit_outlined, size: 18),
                title: const Text('Edit student'),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _showEditSheet(student);
                },
              ),
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.delete_outline,
                    size: 18, color: Theme.of(sheetContext).colorScheme.error),
                title: Text('Delete student',
                    style: TextStyle(
                        color: Theme.of(sheetContext).colorScheme.error)),
                onTap: () async {
                  Navigator.of(sheetContext).pop();
                  final ok = await _confirmDelete(
                      '${student['first_name'] ?? 'this student'}');
                  if (ok) await _deleteStudent(student['id'] as String);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<bool> _confirmDelete(String name) async {
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text('Delete $name?'),
            content: const Text(
                'Their login and guardian links are removed. This cannot be undone.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(dialogContext).colorScheme.error,
                ),
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _deleteStudent(String id) async {
    try {
      await ApiClient.instance.delete('/students/$id');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Student deleted')),
      );
      _loadStudents();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to delete student')),
      );
    }
  }

  void _showEditSheet(Map<String, dynamic> student) {
    final nameCtrl = TextEditingController(
      text:
          '${student['first_name'] ?? ''} ${student['last_name'] ?? ''}'.trim(),
    );
    final phoneCtrl = TextEditingController(text: '${student['phone'] ?? ''}');
    String? classId = student['class_id'];
    String? sectionId = student['section_id'];
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 14,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 14,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Edit Student',
                    style: Theme.of(sheetContext).textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                TextField(
                  controller: nameCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Full Name'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration:
                      const InputDecoration(labelText: 'Phone'),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  key: ValueKey('edit-class-$classId'),
                  initialValue: classId,
                  decoration: const InputDecoration(labelText: 'Class'),
                  items: [
                    for (final c in _classes)
                      DropdownMenuItem(
                        value: c['id'] as String,
                        child: Text('${c['name']}'),
                      ),
                  ],
                  onChanged: (v) {
                    setSheetState(() {
                      classId = v;
                      sectionId = null;
                    });
                  },
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () async {
                    final parts = nameCtrl.text.trim().split(' ');
                    try {
                      await ApiClient.instance.put(
                        '/students/${student['id']}',
                        data: {
                          'first_name':
                              parts.isNotEmpty ? parts.first : '',
                          if (parts.length > 1)
                            'last_name': parts.sublist(1).join(' '),
                          if (phoneCtrl.text.trim().isNotEmpty)
                            'phone': phoneCtrl.text.trim(),
                          if (classId != null) 'class_id': classId,
                          if (sectionId != null) 'section_id': sectionId,
                        },
                      );
                      if (!sheetContext.mounted) return;
                      Navigator.of(sheetContext).pop();
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Student updated')),
                      );
                      _loadStudents();
                    } catch (_) {
                      if (!sheetContext.mounted) return;
                      ScaffoldMessenger.of(sheetContext).showSnackBar(
                        const SnackBar(
                            content: Text('Failed to update student')),
                      );
                    }
                  },
                  child: const Text('Save Changes'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showEnrollSheet() {
    final firstCtrl = TextEditingController();
    final lastCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    String? classId;
    String gender = 'male';

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 14,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 14,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Enroll Student',
                    style: Theme.of(sheetContext).textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: firstCtrl,
                      decoration: const InputDecoration(
                          labelText: 'First Name *'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: lastCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Last Name'),
                    ),
                  ),
                ]),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: classId,
                      decoration:
                          const InputDecoration(labelText: 'Class *'),
                      items: [
                        for (final c in _classes)
                          DropdownMenuItem(
                            value: c['id'] as String,
                            child: Text('${c['name']}'),
                          ),
                      ],
                      onChanged: (v) => setSheetState(() => classId = v),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: gender,
                      decoration:
                          const InputDecoration(labelText: 'Gender'),
                      items: const [
                        DropdownMenuItem(value: 'male', child: Text('Male')),
                        DropdownMenuItem(
                            value: 'female', child: Text('Female')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: (v) => setSheetState(() => gender = v ?? 'male'),
                    ),
                  ),
                ]),
                const SizedBox(height: 10),
                TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration:
                      const InputDecoration(labelText: 'Guardian Phone'),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () async {
                    if (firstCtrl.text.trim().isEmpty || classId == null) {
                      ScaffoldMessenger.of(sheetContext).showSnackBar(
                        const SnackBar(
                            content: Text('First name and class are required')),
                      );
                      return;
                    }
                    try {
                      await ApiClient.instance.post('/students', data: {
                        'first_name': firstCtrl.text.trim(),
                        if (lastCtrl.text.trim().isNotEmpty)
                          'last_name': lastCtrl.text.trim(),
                        'gender': gender,
                        'class_id': classId,
                        if (phoneCtrl.text.trim().isNotEmpty)
                          'guardian_phone': phoneCtrl.text.trim(),
                        'guardians': [
                          if (phoneCtrl.text.trim().isNotEmpty)
                            {'phone': phoneCtrl.text.trim(), 'relation': 'guardian'},
                        ],
                      });
                      if (!sheetContext.mounted) return;
                      Navigator.of(sheetContext).pop();
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Student enrolled — enrollment number auto-assigned')),
                      );
                      _loadStudents();
                    } catch (_) {
                      if (!sheetContext.mounted) return;
                      ScaffoldMessenger.of(sheetContext).showSnackBar(
                        const SnackBar(
                            content: Text('Failed to enroll student')),
                      );
                    }
                  },
                  child: const Text('Enroll Student'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18nService.instance;
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showEnrollSheet,
        icon: const Icon(Icons.person_add_alt_1),
        label: Text(i18n.t('Enroll', 'भर्ना')),
      ),
      body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: InputDecoration(
                    hintText: i18n.t('Search students...', 'विद्यार्थी खोज्नुहोस्...'),
                    prefixIcon: const Icon(Icons.search),
                  ),
                  onChanged: (val) {
                    _debounce?.cancel();
                    _debounce = Timer(const Duration(milliseconds: 350), () {
                      _search = val;
                      _loadStudents();
                    });
                  },
                ),
              ),
              if (_classes.isNotEmpty)
                DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    hint: Text(i18n.t('Class', 'कक्षा')),
                    value: _classFilter,
                    items: [
                      DropdownMenuItem(
                        value: null,
                        child: Text(i18n.t('All', 'सबै')),
                      ),
                      for (final c in _classes)
                        DropdownMenuItem(
                          value: c['id'] as String,
                          child: Text('${c['name']}'),
                        ),
                    ],
                    onChanged: (v) {
                      setState(() => _classFilter = v);
                      _loadStudents();
                    },
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const LoadingShimmer()
              : (_error != null && _students.isEmpty)
                  ? ErrorContainer(errorMessage: _error!, onRetry: _loadStudents)
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
                        onTap: () => _openDetail(s),
                      );
                    },
                  ),
                ),
        ),
      ],
      ),
    );
  }
}

