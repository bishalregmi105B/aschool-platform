import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Student Portfolio — Digital achievement portfolio
class PortfolioScreen extends ConsumerStatefulWidget {
  const PortfolioScreen({super.key});

  @override
  ConsumerState<PortfolioScreen> createState() => _PortfolioScreenState();
}

class _PortfolioScreenState extends ConsumerState<PortfolioScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get('/student/portfolio');
      final payload = res.data;
      setState(() {
        _data = payload is Map<String, dynamic>
            ? (payload['data'] as Map?)?.cast<String, dynamic>() ?? payload
            : null;
      });
    } catch (_) {}
    setState(() => _loading = false);
  }

  String _portfolioSummary(String studentName) {
    final badges = (_data?['badges'] as List?)?.length ?? 0;
    final awards = (_data?['awards'] as List?)?.length ?? 0;
    final records = (_data?['academic_records'] as List? ?? [])
        .map((record) =>
            '${record['exam_name'] ?? 'Exam'}: ${record['percentage'] ?? '--'}%, GPA ${record['gpa'] ?? '--'}')
        .join('\n');

    return [
      '$studentName - Student Portfolio',
      if ((_data?['class_name'] ?? '').toString().isNotEmpty)
        'Class: ${_data?['class_name']}',
      'GPA: ${_data?['overall_gpa'] ?? '--'}',
      'Attendance: ${_data?['attendance_pct'] ?? '--'}%',
      'Badges: $badges',
      'Awards: $awards',
      if ((_data?['ai_summary'] ?? '').toString().isNotEmpty)
        '\nSummary:\n${_data?['ai_summary']}',
      if (records.isNotEmpty) '\nAcademic Records:\n$records',
    ].join('\n');
  }

  Future<void> _sharePortfolio(String studentName) {
    return Share.share(
      _portfolioSummary(studentName),
      subject: '$studentName Portfolio',
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = ref.watch(authProvider).user;
    final fullName = (user?.fullName ?? '').trim();
    final firstInitial = fullName.isNotEmpty ? fullName[0].toUpperCase() : 'S';

    return PluginGate(
      pluginSlug: 'student_portfolio',
      child: _loading
          ? const LoadingShimmer()
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Profile header
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 40,
                            backgroundColor: theme.colorScheme.primaryContainer,
                            child: Text(
                              firstInitial,
                              style: const TextStyle(fontSize: 36),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(user?.fullName ?? 'Student',
                              style: theme.textTheme.titleLarge
                                  ?.copyWith(fontWeight: FontWeight.bold)),
                          Text(
                            _data?['class_name'] ?? '',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                          const SizedBox(height: 16),
                          // Stats row
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              _PortfolioStat(
                                  label: 'GPA',
                                  value: '${_data?['overall_gpa'] ?? '--'}'),
                              _PortfolioStat(
                                  label: 'Attendance',
                                  value:
                                      '${_data?['attendance_pct'] ?? '--'}%'),
                              _PortfolioStat(
                                  label: 'Badges',
                                  value:
                                      '${(_data?['badges'] as List?)?.length ?? 0}'),
                              _PortfolioStat(
                                  label: 'Awards',
                                  value:
                                      '${(_data?['awards'] as List?)?.length ?? 0}'),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // AI Summary
                  if (_data?['ai_summary'] != null)
                    Card(
                      color: Colors.purple.withAlpha(15),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.smart_toy,
                                    size: 18, color: Colors.purple),
                                const SizedBox(width: 8),
                                Text('AI Summary',
                                    style: theme.textTheme.titleSmall?.copyWith(
                                        fontWeight: FontWeight.bold)),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(_data!['ai_summary'],
                                style: const TextStyle(height: 1.5)),
                          ],
                        ),
                      ),
                    ),
                  if (_data?['ai_summary'] != null) const SizedBox(height: 16),

                  // Skill Badges
                  if ((_data?['badges'] as List?)?.isNotEmpty ?? false) ...[
                    Text('Skill Badges',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final badge in _data!['badges'])
                          Chip(
                            avatar: Text(badge['emoji'] ?? '🏅',
                                style: const TextStyle(fontSize: 16)),
                            label: Text(badge['name'] ?? ''),
                            backgroundColor: Colors.amber.withAlpha(25),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Academic Records
                  Text('Academic Records',
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  ...(_data?['academic_records'] as List? ?? []).map((rec) {
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: theme.colorScheme.primaryContainer,
                          child: Text('${rec['percentage'] ?? '--'}%',
                              style: const TextStyle(
                                  fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                        title: Text(rec['exam_name'] ?? ''),
                        subtitle: Text(rec['term'] ?? ''),
                        trailing: Text(
                          'GPA: ${rec['gpa'] ?? '--'}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 16),

                  // Awards & Achievements
                  if ((_data?['awards'] as List?)?.isNotEmpty ?? false) ...[
                    Text('Awards & Achievements',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...(_data!['awards'] as List).map((award) {
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: Colors.amber.withAlpha(25),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.emoji_events,
                                color: Colors.amber),
                          ),
                          title: Text(award['title'] ?? ''),
                          subtitle: Text((award['date'] ?? '').isNotEmpty ? adToBsString(DateTime.tryParse(award['date']!) ?? DateTime.now()) : ''),
                          trailing: Text(award['category'] ?? '',
                              style: TextStyle(
                                  fontSize: 11, color: Colors.grey[600])),
                        ),
                      );
                    }),
                    const SizedBox(height: 16),
                  ],

                  // Extracurricular Activities
                  if ((_data?['activities'] as List?)?.isNotEmpty ?? false) ...[
                    Text('Extracurricular Activities',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...(_data!['activities'] as List).map((act) {
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: Colors.teal.withAlpha(25),
                            child: const Icon(Icons.sports_soccer,
                                color: Colors.teal, size: 20),
                          ),
                          title: Text(act['name'] ?? ''),
                          subtitle: Text(act['description'] ?? ''),
                        ),
                      );
                    }),
                    const SizedBox(height: 16),
                  ],

                  // Teacher Endorsements
                  if ((_data?['endorsements'] as List?)?.isNotEmpty ??
                      false) ...[
                    Text('Teacher Endorsements',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...(_data!['endorsements'] as List).map((end) {
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.format_quote,
                                      size: 18, color: Colors.blue),
                                  const SizedBox(width: 8),
                                  Text(end['teacher'] ?? '',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600)),
                                  const Spacer(),
                                  Text(end['subject'] ?? '',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey[600])),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(end['remark'] ?? '',
                                  style: const TextStyle(
                                      fontStyle: FontStyle.italic)),
                            ],
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 16),
                  ],

                  // Export / Share
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () =>
                              _sharePortfolio(user?.fullName ?? 'Student'),
                          icon: const Icon(Icons.description),
                          label: const Text('Export Summary'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () =>
                              _sharePortfolio(user?.fullName ?? 'Student'),
                          icon: const Icon(Icons.share),
                          label: const Text('Share'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }
}

class _PortfolioStat extends StatelessWidget {
  final String label, value;
  const _PortfolioStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      ],
    );
  }
}
