import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Student Wellbeing — Mood check-in, counselor chat, mindfulness
class StudentWellbeing extends ConsumerStatefulWidget {
  const StudentWellbeing({super.key});

  @override
  ConsumerState<StudentWellbeing> createState() => _StudentWellbeingState();
}

class _StudentWellbeingState extends ConsumerState<StudentWellbeing> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  bool _requestingCounselor = false;

  static const _moods = [
    ('😊', 'Happy', Colors.green),
    ('😐', 'Okay', Colors.amber),
    ('😢', 'Sad', Colors.blue),
    ('😤', 'Angry', Colors.red),
    ('😰', 'Anxious', Colors.purple),
    ('🤩', 'Excited', Colors.orange),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/student/wellbeing');
      final payload = res.data;
      setState(() {
        _data = payload is Map<String, dynamic>
            ? (payload['data'] as Map?)?.cast<String, dynamic>() ?? payload
            : null;
      });
    } catch (_) {}
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return PluginGate(
      pluginSlug: 'wellbeing',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Wellbeing'),
        body: _loading
            ? const LoadingShimmer()
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // Mood check-in card
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          children: [
                            Text('How are you feeling today?',
                                style: theme.textTheme.titleMedium
                                    ?.copyWith(fontWeight: FontWeight.bold)),
                            const SizedBox(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: _moods.map((mood) {
                                final todayMood = _data?['today_mood'];
                                final isSelected = todayMood == mood.$2;
                                return GestureDetector(
                                  onTap: () => _submitMood(mood.$2),
                                  child: Column(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: isSelected
                                              ? mood.$3.withAlpha(40)
                                              : null,
                                          border: isSelected
                                              ? Border.all(
                                                  color: mood.$3, width: 2)
                                              : null,
                                          borderRadius:
                                              BorderRadius.circular(12),
                                        ),
                                        child: Text(mood.$1,
                                            style:
                                                const TextStyle(fontSize: 28)),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(mood.$2,
                                          style: TextStyle(
                                              fontSize: 10,
                                              color: isSelected
                                                  ? mood.$3
                                                  : Colors.grey[600])),
                                    ],
                                  ),
                                );
                              }).toList(),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Weekly mood trend
                    if ((_data?['weekly_moods'] as List?)?.isNotEmpty ??
                        false) ...[
                      Text('This Week',
                          style: theme.textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              for (final entry
                                  in (_data!['weekly_moods'] as List))
                                Column(
                                  children: [
                                    Text(_moodEmoji(entry['mood'] ?? ''),
                                        style: const TextStyle(fontSize: 24)),
                                    const SizedBox(height: 4),
                                    Text(entry['day'] ?? '',
                                        style: TextStyle(
                                            fontSize: 11,
                                            color: Colors.grey[600])),
                                  ],
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Mindfulness suggestions
                    Text('Mindfulness Activities',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    const _MindfulnessCard(
                      icon: Icons.self_improvement,
                      title: 'Breathing Exercise',
                      subtitle: '5 minutes • Calming',
                      color: Colors.teal,
                    ),
                    const _MindfulnessCard(
                      icon: Icons.music_note,
                      title: 'Focus Music',
                      subtitle: '15 minutes • Concentration',
                      color: Colors.blue,
                    ),
                    const _MindfulnessCard(
                      icon: Icons.wb_sunny,
                      title: 'Gratitude Journal',
                      subtitle: '3 things you\'re grateful for',
                      color: Colors.orange,
                    ),
                    const SizedBox(height: 16),

                    // Counselor section
                    Card(
                      color: Colors.blue.withAlpha(15),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.psychology,
                                    color: Colors.blue),
                                const SizedBox(width: 8),
                                Text('Talk to Counselor',
                                    style: theme.textTheme.titleSmall?.copyWith(
                                        fontWeight: FontWeight.bold)),
                              ],
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Need someone to talk to? Our school counselor is here to help. All conversations are confidential.',
                              style: TextStyle(height: 1.4),
                            ),
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              onPressed: _requestingCounselor
                                  ? null
                                  : _requestCounselorSupport,
                              icon: const Icon(Icons.chat),
                              label: Text(_requestingCounselor
                                  ? 'Sending...'
                                  : 'Request Counselor'),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Previous check-ins
                    if ((_data?['recent_entries'] as List?)?.isNotEmpty ??
                        false) ...[
                      const SizedBox(height: 16),
                      Text('Recent Check-ins',
                          style: theme.textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      ...(_data!['recent_entries'] as List).map((entry) {
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: Text(_moodEmoji(entry['mood'] ?? ''),
                                style: const TextStyle(fontSize: 24)),
                            title: Text(entry['mood'] ?? ''),
                            subtitle: Text(entry['note'] ?? '',
                                maxLines: 2, overflow: TextOverflow.ellipsis),
                            trailing: Text((entry['date'] ?? '').isNotEmpty ? adToBsString(DateTime.tryParse(entry['date']!) ?? DateTime.now()) : '',
                                style: TextStyle(
                                    fontSize: 11, color: Colors.grey[500])),
                          ),
                        );
                      }),
                    ],

                    const SizedBox(height: 32),
                  ],
                ),
              ),
      ),
    );
  }

  String _moodEmoji(String mood) {
    for (final m in _moods) {
      if (m.$2.toLowerCase() == mood.toLowerCase()) return m.$1;
    }
    return '😐';
  }

  Future<void> _submitMood(String mood) async {
    try {
      await ApiClient.instance.post(
        '/student/wellbeing/mood',
        data: {'mood': mood},
      );
      setState(() => _data?['today_mood'] = mood);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Mood recorded: ${_moodEmoji(mood)} $mood'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _requestCounselorSupport() async {
    setState(() => _requestingCounselor = true);
    try {
      await ApiClient.instance.post(
        '/student/wellbeing/mood',
        data: {
          'mood': _data?['today_mood'] ?? 'Okay',
          'note': 'Counselor support requested by student.',
        },
      );
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Counselor request recorded'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _requestingCounselor = false);
      }
    }
  }
}

class _MindfulnessCard extends StatelessWidget {
  final IconData icon;
  final String title, subtitle;
  final Color color;
  const _MindfulnessCard(
      {required this.icon,
      required this.title,
      required this.subtitle,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withAlpha(25),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: color, size: 22),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.play_arrow),
      ),
    );
  }
}
