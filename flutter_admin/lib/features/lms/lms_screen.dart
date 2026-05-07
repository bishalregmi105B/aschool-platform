import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Learning Management System — courses, live classes, recordings
class LmsScreen extends ConsumerStatefulWidget {
  const LmsScreen({super.key});

  @override
  ConsumerState<LmsScreen> createState() => _LmsScreenState();
}

class _LmsScreenState extends ConsumerState<LmsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _courses = [];
  List<Map<String, dynamic>> _liveClasses = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/lms/courses?per_page=20'),
        ApiClient.instance.get('/lms/live-classes?status=upcoming&per_page=10'),
      ]);
      setState(() {
        _courses =
            List<Map<String, dynamic>>.from(results[0].data['data'] ?? []);
        _liveClasses =
            List<Map<String, dynamic>>.from(results[1].data['data'] ?? []);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'lms',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Learning Management'),
          actions: [
            IconButton(
              icon: const Icon(Icons.add_rounded),
              tooltip: 'New Course',
              onPressed: _showCreateCourseInfo,
            ),
          ],
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Courses'),
              Tab(text: 'Live Classes'),
              Tab(text: 'Recordings'),
            ],
          ),
        ),
        body: _loading
            ? const LoadingShimmer()
            : TabBarView(
                controller: _tabCtrl,
                children: [
                  _buildCourses(),
                  _buildLiveClasses(),
                  _buildRecordings(),
                ],
              ),
      ),
    );
  }

  // ── Courses Tab ───────────────────────────────────────────────────────────

  Widget _buildCourses() {
    if (_courses.isEmpty) {
      return const NoDataContainer(
        title: 'No courses yet',
        subtitle: 'Create your first course to get started',
        icon: Icons.play_circle_outline_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _courses.length,
        itemBuilder: (context, i) {
          final c = _courses[i];
          final status = c['status'] as String? ?? 'active';

          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: ASchoolTheme.primary.withAlpha(20),
                  child: Text(
                    (c['title'] as String? ?? 'C')
                        .substring(0, 1)
                        .toUpperCase(),
                    style: const TextStyle(
                      color: ASchoolTheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                title: Text(
                  c['title'] as String? ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  '${c['class_name'] ?? ''} • ${c['subject_name'] ?? ''} • ${c['lesson_count'] ?? 0} lessons',
                  style: const TextStyle(
                      fontSize: 12, color: ASchoolTheme.mutedText),
                ),
                trailing: ESchoolInfoPill(
                  icon: Icons.circle,
                  label: status,
                  color: status == 'active'
                      ? ASchoolTheme.success
                      : ASchoolTheme.mutedText,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Live Classes Tab ──────────────────────────────────────────────────────

  Widget _buildLiveClasses() {
    if (_liveClasses.isEmpty) {
      return const NoDataContainer(
        title: 'No upcoming live classes',
        subtitle: 'Schedule a live class via teacher app or web dashboard',
        icon: Icons.video_call_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _liveClasses.length,
        itemBuilder: (context, i) {
          final lc = _liveClasses[i];
          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: const Color(0xFF0EA5E9).withAlpha(20),
                  child: const Icon(
                    Icons.video_call_rounded,
                    color: Color(0xFF0EA5E9),
                  ),
                ),
                title: Text(
                  lc['title'] as String? ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  '${lc['teacher_name'] ?? ''} • ${lc['scheduled_at'] ?? ''}',
                  style: const TextStyle(
                      fontSize: 12, color: ASchoolTheme.mutedText),
                ),
                trailing: FilledButton(
                  onPressed: null,
                  style: FilledButton.styleFrom(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 32),
                  ),
                  child: const Text('Join', style: TextStyle(fontSize: 12)),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Recordings Tab ────────────────────────────────────────────────────────

  Widget _buildRecordings() {
    return const NoDataContainer(
      title: 'No recordings yet',
      subtitle: 'Recordings will appear here after live classes end',
      icon: Icons.videocam_off_rounded,
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  void _showCreateCourseInfo() {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Create Course'),
        content: const Text(
          'Use the web dashboard to create full courses with lessons, '
          'materials, assignments and quizzes.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }
}
