import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

/// Teacher LMS hub — courses, live classes, and video library
class TeacherLmsOverviewScreen extends StatefulWidget {
  const TeacherLmsOverviewScreen({super.key});

  @override
  State<TeacherLmsOverviewScreen> createState() =>
      _TeacherLmsOverviewScreenState();
}

class _TeacherLmsOverviewScreenState extends State<TeacherLmsOverviewScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _courses = [];
  List<Map<String, dynamic>> _liveClasses = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
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
        ApiClient.instance.get('/lms/courses?created_by=me&per_page=30'),
        ApiClient.instance.get('/lms/live-classes?created_by=me&per_page=20'),
      ]);
      if (!mounted) return;
      final coursesRaw = results[0].data;
      final liveRaw = results[1].data;
      setState(() {
        _courses = List<Map<String, dynamic>>.from(
          coursesRaw['data'] ?? coursesRaw['items'] ?? [],
        );
        _liveClasses = List<Map<String, dynamic>>.from(
          liveRaw['data'] ?? liveRaw['items'] ?? [],
        );
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'lms',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('My LMS'),
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'My Courses'),
              Tab(text: 'Live Classes'),
            ],
          ),
          actions: [
            IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
          ],
        ),
        body: _loading
            ? const LoadingShimmer()
            : TabBarView(
                controller: _tabCtrl,
                children: [
                  _CoursesTab(courses: _courses, onRefresh: _load),
                  _LiveClassesTab(liveClasses: _liveClasses, onRefresh: _load),
                ],
              ),
      ),
    );
  }
}

// ─── Courses Tab ──────────────────────────────────────────────────────────────

class _CoursesTab extends StatelessWidget {
  final List<Map<String, dynamic>> courses;
  final VoidCallback onRefresh;

  const _CoursesTab({required this.courses, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (courses.isEmpty) {
      return const NoDataContainer(
        title: 'No Courses Yet',
        subtitle: 'Your LMS courses and lessons will appear here.',
        icon: Icons.menu_book_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: courses.length,
        itemBuilder: (context, i) => _CourseCard(course: courses[i]),
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  final Map<String, dynamic> course;

  const _CourseCard({required this.course});

  @override
  Widget build(BuildContext context) {
    final title = course['title'] ?? course['name'] ?? 'Untitled Course';
    final subject = course['subject_name'] ?? course['subject'] ?? '';
    final className = course['class_name'] ?? course['grade'] ?? '';
    final topicCount = course['topic_count'] ?? course['topics_count'] ?? 0;
    final lessonCount = course['lesson_count'] ?? course['lessons_count'] ?? 0;
    final status = (course['status'] ?? 'draft').toString();
    final isPublished = status == 'published';
    final thumbnailUrl = course['thumbnail_url']?.toString() ?? '';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {},
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (thumbnailUrl.isNotEmpty)
              Container(
                height: 120,
                width: double.infinity,
                color: Colors.teal.shade100,
                child: const Icon(Icons.play_circle_outline,
                    size: 48, color: Colors.teal),
              )
            else
              Container(
                height: 80,
                width: double.infinity,
                color: Colors.teal.shade50,
                child: const Icon(Icons.menu_book_outlined,
                    size: 40, color: Colors.teal),
              ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isPublished
                              ? Colors.green.shade100
                              : Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          status.toUpperCase(),
                          style: TextStyle(
                            fontSize: 10,
                            color: isPublished
                                ? Colors.green.shade700
                                : Colors.grey.shade600,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (subject.isNotEmpty || className.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      [subject, className]
                          .where((s) => s.isNotEmpty)
                          .join(' • '),
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _CountChip(
                          icon: Icons.book_outlined,
                          count: lessonCount,
                          label: 'lessons'),
                      const SizedBox(width: 8),
                      _CountChip(
                          icon: Icons.topic_outlined,
                          count: topicCount,
                          label: 'topics'),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CountChip extends StatelessWidget {
  final IconData icon;
  final int count;
  final String label;

  const _CountChip(
      {required this.icon, required this.count, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.grey.shade500),
        const SizedBox(width: 3),
        Text('$count $label',
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
      ],
    );
  }
}

// ─── Live Classes Tab ─────────────────────────────────────────────────────────

class _LiveClassesTab extends StatelessWidget {
  final List<Map<String, dynamic>> liveClasses;
  final VoidCallback onRefresh;

  const _LiveClassesTab({required this.liveClasses, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (liveClasses.isEmpty) {
      return const NoDataContainer(
        title: 'No Live Classes',
        subtitle: 'Scheduled live classes will appear here.',
        icon: Icons.videocam_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: liveClasses.length,
        itemBuilder: (context, i) => _LiveClassCard(liveClass: liveClasses[i]),
      ),
    );
  }
}

class _LiveClassCard extends StatelessWidget {
  final Map<String, dynamic> liveClass;

  const _LiveClassCard({required this.liveClass});

  @override
  Widget build(BuildContext context) {
    final title = liveClass['title'] ?? 'Live Class';
    final subject = liveClass['subject_name'] ?? '';
    final scheduledAt = liveClass['scheduled_at']?.toString() ?? '';
    final status = (liveClass['status'] ?? 'scheduled').toString();
    final isLive = status == 'live';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isLive ? Colors.red.shade100 : Colors.teal.shade100,
          child: Icon(
            isLive ? Icons.radio_button_checked : Icons.videocam_outlined,
            color: isLive ? Colors.red : Colors.teal,
            size: 22,
          ),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
          [subject, if (scheduledAt.isNotEmpty) _formatDate(scheduledAt)]
              .where((s) => s.isNotEmpty)
              .join(' • '),
        ),
        trailing: isLive
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.red,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'LIVE',
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 11),
                ),
              )
            : Text(
                status.toUpperCase(),
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              ),
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}
