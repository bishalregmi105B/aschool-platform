import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ClassSubjectsScreen extends StatefulWidget {
  const ClassSubjectsScreen({super.key});

  @override
  State<ClassSubjectsScreen> createState() => _ClassSubjectsScreenState();
}

class _ClassSubjectsScreenState extends State<ClassSubjectsScreen> {
  bool _loading = true;
  String? _error;
  String? _selectedClassId;
  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _subjects = [];

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _classes = await AcademicDataService.fetchClasses();
      if (_classes.isNotEmpty) {
        _selectedClassId = _classes.first['id']?.toString();
        await _loadSubjects();
      }
    } catch (_) {
      _error = 'Unable to load class subjects right now.';
    }
    if (mounted) {
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _loadSubjects() async {
    final classId = _selectedClassId;
    if (classId == null || classId.isEmpty) {
      _subjects = [];
      return;
    }
    _subjects = await AcademicDataService.fetchSubjectsForClass(classId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Class Subjects')),
      body: _loading
          ? const LoadingShimmer()
          : RefreshIndicator(
              onRefresh: _loadClasses,
              child: _buildContent(context),
            ),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(_error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error))
        ],
      );
    }
    if (_classes.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: const [Text('No classes found yet.')],
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        DropdownButtonFormField<String>(
          initialValue: _selectedClassId,
          decoration: const InputDecoration(labelText: 'Class'),
          items: _classes
              .map(
                (klass) => DropdownMenuItem<String>(
                  value: klass['id']?.toString(),
                  child: Text(klass['name']?.toString() ?? 'Unknown Class'),
                ),
              )
              .toList(),
          onChanged: (value) async {
            if (value == null) {
              return;
            }
            setState(() {
              _selectedClassId = value;
              _loading = true;
            });
            try {
              await _loadSubjects();
            } finally {
              if (mounted) {
                setState(() {
                  _loading = false;
                });
              }
            }
          },
        ),
        const SizedBox(height: 16),
        if (_subjects.isEmpty)
          const Text('No subjects assigned to this class yet.')
        else
          ..._subjects.map((subject) {
            final subjectName =
                subject['subject_name'] ?? subject['name'] ?? 'Unknown Subject';
            final code = subject['code'] ?? '-';
            final teacher = subject['teacher_name'] ?? 'Not assigned';
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                title: Text(subjectName.toString()),
                subtitle: Text('Code: $code | Teacher: $teacher'),
              ),
            );
          }),
      ],
    );
  }
}
