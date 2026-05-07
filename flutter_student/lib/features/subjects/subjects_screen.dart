import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class SubjectsScreen extends ConsumerStatefulWidget {
  const SubjectsScreen({super.key});

  @override
  ConsumerState<SubjectsScreen> createState() => _SubjectsScreenState();
}

class _SubjectsScreenState extends ConsumerState<SubjectsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _subjects = [];
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
      _subjects = await AcademicDataService.fetchSubjectsForCurrentStudent();
    } catch (e) {
      _error = 'Unable to load subjects right now.';
    }
    if (mounted) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'My Subjects'),
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
      return ErrorContainer(
        errorMessage: _error!,
        onRetry: _load,
      );
    }

    if (_subjects.isEmpty) {
      return const NoDataContainer(
        title: 'No subjects found',
        subtitle: 'Your class subjects will appear once assigned.',
        icon: Icons.subject_outlined,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _subjects.length,
      itemBuilder: (context, index) {
        final subject = _subjects[index];
        final subjectName =
            subject['subject_name'] ?? subject['name'] ?? 'Unknown Subject';
        final code = subject['code'] ?? '-';
        final teacher = subject['teacher_name'] ?? 'Not assigned';
        final creditHours = subject['credit_hours'];

        return ESchoolAnimatedEntry(
          index: index,
          child: ESchoolCard(
            margin: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        subjectName.toString(),
                        style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w700),
                      ),
                    ),
                    ESchoolInfoPill(
                      icon: Icons.badge_outlined,
                      label: code.toString(),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Icon(Icons.person_rounded,
                        size: 16, color: ASchoolTheme.mutedText),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Teacher: ${teacher.toString()}',
                        style: const TextStyle(color: ASchoolTheme.mutedText),
                      ),
                    ),
                  ],
                ),
                if (creditHours != null) ...[
                  const SizedBox(height: 10),
                  ESchoolInfoPill(
                    icon: Icons.timer_outlined,
                    label: 'Credit Hours: $creditHours',
                    color: ASchoolTheme.warning,
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
