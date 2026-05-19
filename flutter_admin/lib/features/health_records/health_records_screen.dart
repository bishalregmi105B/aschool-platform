import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Student Health Records — medical records, vaccinations, allergy alerts
class HealthRecordsScreen extends ConsumerStatefulWidget {
  const HealthRecordsScreen({super.key});

  @override
  ConsumerState<HealthRecordsScreen> createState() =>
      _HealthRecordsScreenState();
}

class _HealthRecordsScreenState extends ConsumerState<HealthRecordsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _records = [];
  List<Map<String, dynamic>> _vaccinations = [];
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
      final res = await ApiClient.instance.get('/health/records?per_page=30');
      setState(() {
        _records = List<Map<String, dynamic>>.from(res.data['data'] ?? []);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
    _loadVaccinations();
  }

  Future<void> _loadVaccinations() async {
    try {
      final res =
          await ApiClient.instance.get('/health/vaccinations?per_page=50');
      setState(() {
        _vaccinations = List<Map<String, dynamic>>.from(res.data['data'] ?? []);
      });
    } catch (_) {
      // silent fail — vaccination endpoint may not exist yet
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'health_records',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Health Records'),
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Records'),
              Tab(text: 'Allergies'),
              Tab(text: 'Vaccinations'),
            ],
          ),
        ),
        body: _loading
            ? const LoadingShimmer()
            : TabBarView(
                controller: _tabCtrl,
                children: [
                  _buildRecords(),
                  _buildAllergies(),
                  _buildVaccinations(),
                ],
              ),
      ),
    );
  }

  Widget _buildRecords() {
    if (_records.isEmpty) {
      return const NoDataContainer(
        title: 'No health records',
        subtitle: 'Student health records will appear here',
        icon: Icons.local_hospital_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _records.length,
        itemBuilder: (_, i) {
          final r = _records[i];
          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: ASchoolTheme.danger.withAlpha(20),
                  child: const Icon(
                    Icons.favorite_rounded,
                    color: ASchoolTheme.danger,
                    size: 20,
                  ),
                ),
                title: Text(
                  r['student_name'] as String? ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  '${r['type'] ?? ''} • ${r['date'] ?? ''}',
                  style: const TextStyle(
                      fontSize: 12, color: ASchoolTheme.mutedText),
                ),
                trailing: const Icon(
                  Icons.chevron_right_rounded,
                  color: ASchoolTheme.mutedText,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildAllergies() {
    final allergies = _records.where((r) => r['type'] == 'allergy').toList();
    if (allergies.isEmpty) {
      return const NoDataContainer(
        title: 'No allergy records',
        subtitle: 'Critical allergy information will be shown here',
        icon: Icons.warning_amber_rounded,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: allergies.length,
      itemBuilder: (_, i) {
        final a = allergies[i];
        return ESchoolAnimatedEntry(
          index: i,
          child: ESchoolCard(
            margin: const EdgeInsets.only(bottom: 10),
            color: const Color(0xFFFFF3F3),
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(
                Icons.warning_amber_rounded,
                color: ASchoolTheme.danger,
              ),
              title: Text(
                a['student_name'] as String? ?? '',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Text(
                a['description'] as String? ?? '',
                style: const TextStyle(
                    fontSize: 12, color: ASchoolTheme.mutedText),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildVaccinations() {
    return RefreshIndicator(
      onRefresh: _loadVaccinations,
      child: _vaccinations.isEmpty
          ? const NoDataContainer(message: 'No vaccination records found')
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _vaccinations.length,
              itemBuilder: (context, i) {
                final v = _vaccinations[i];
                final dueDate = v['due_date'] as String?;
                final givenDate = v['given_date'] as String?;
                final isOverdue = dueDate != null &&
                    givenDate == null &&
                    DateTime.tryParse(dueDate)?.isBefore(DateTime.now()) ==
                        true;
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: givenDate != null
                          ? Colors.green.withOpacity(0.15)
                          : isOverdue
                              ? Colors.red.withOpacity(0.15)
                              : Colors.orange.withOpacity(0.15),
                      child: Icon(
                        givenDate != null
                            ? Icons.check_circle
                            : isOverdue
                                ? Icons.warning
                                : Icons.schedule,
                        color: givenDate != null
                            ? Colors.green
                            : isOverdue
                                ? Colors.red
                                : Colors.orange,
                        size: 20,
                      ),
                    ),
                    title: Text(
                      v['vaccine_name'] as String? ?? 'Unknown Vaccine',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (v['student_name'] != null)
                          Text('Student: ${v['student_name']}',
                              style: const TextStyle(fontSize: 12)),
                        if (dueDate != null)
                          Text('Due: $dueDate',
                              style: TextStyle(
                                fontSize: 12,
                                color: isOverdue
                                    ? Colors.red
                                    : ASchoolTheme.mutedText,
                              )),
                        if (givenDate != null)
                          Text('Given: $givenDate',
                              style: const TextStyle(
                                  fontSize: 12, color: Colors.green)),
                      ],
                    ),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: givenDate != null
                            ? Colors.green.withOpacity(0.1)
                            : isOverdue
                                ? Colors.red.withOpacity(0.1)
                                : Colors.orange.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        givenDate != null
                            ? 'Done'
                            : isOverdue
                                ? 'Overdue'
                                : 'Pending',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: givenDate != null
                              ? Colors.green
                              : isOverdue
                                  ? Colors.red
                                  : Colors.orange,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
