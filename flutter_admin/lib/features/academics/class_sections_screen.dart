import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ClassSectionsScreen extends StatefulWidget {
  const ClassSectionsScreen({super.key});

  @override
  State<ClassSectionsScreen> createState() => _ClassSectionsScreenState();
}

class _ClassSectionsScreenState extends State<ClassSectionsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _classes = [];
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
      _classes = await AcademicDataService.fetchClasses();
    } catch (_) {
      _error = 'Unable to load classes right now.';
    }
    if (mounted) {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Class Sections')),
      body: _loading
          ? const LoadingShimmer()
          : RefreshIndicator(
              onRefresh: _load,
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

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _classes.length,
      itemBuilder: (context, index) {
        final klass = _classes[index];
        final sections = (klass['sections'] as List?) ?? const [];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  klass['name']?.toString() ?? 'Unnamed Class',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                if (sections.isEmpty)
                  const Text('No sections assigned')
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: sections.map((item) {
                      final section = (item as Map).cast<String, dynamic>();
                      final capacity = section['capacity']?.toString() ?? '-';
                      return Chip(
                        label:
                            Text('Section ${section['name']} (Cap: $capacity)'),
                      );
                    }).toList(),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
