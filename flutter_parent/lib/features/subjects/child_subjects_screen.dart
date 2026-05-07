import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ChildSubjectsScreen extends ConsumerStatefulWidget {
  const ChildSubjectsScreen({super.key});

  @override
  ConsumerState<ChildSubjectsScreen> createState() =>
      _ChildSubjectsScreenState();
}

class _ChildSubjectsScreenState extends ConsumerState<ChildSubjectsScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _childBundles = [];

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
      _childBundles =
          await AcademicDataService.fetchChildSubjectsForCurrentParent();
    } catch (_) {
      _error = 'Unable to load child subjects right now.';
    }
    if (mounted) {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const LoadingShimmer();
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: _buildContent(context),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (_error != null) {
      return ListView(
        children: [
          const SizedBox(height: 120),
          ErrorContainer(
            errorMessage: _error!,
            onRetry: _load,
          ),
        ],
      );
    }
    if (_childBundles.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          NoDataContainer(
            title: 'No linked students or subjects found',
            subtitle: 'Subjects will appear after student linking is complete.',
            icon: Icons.subject_rounded,
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: _childBundles.asMap().entries.map((entry) {
        final bundle = entry.value;
        final studentName = bundle['student_name']?.toString() ?? 'Student';
        final className = bundle['class_name']?.toString() ?? '-';
        final subjects = (bundle['subjects'] as List?) ?? const [];

        return ESchoolAnimatedEntry(
          index: entry.key,
          child: ESchoolCard(
            margin: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  studentName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 4),
                ESchoolInfoPill(
                  icon: Icons.class_rounded,
                  label: 'Class: $className',
                ),
                const SizedBox(height: 12),
                if (subjects.isEmpty)
                  const Text('No subjects assigned yet.')
                else
                  ...subjects.map((item) {
                    final subject = (item as Map).cast<String, dynamic>();
                    final name =
                        subject['subject_name'] ?? subject['name'] ?? 'Subject';
                    final teacher = subject['teacher_name'] ?? 'Not assigned';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(top: 2),
                            child: Icon(Icons.circle,
                                size: 8, color: ASchoolTheme.primary),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text('$name (Teacher: $teacher)'),
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}
