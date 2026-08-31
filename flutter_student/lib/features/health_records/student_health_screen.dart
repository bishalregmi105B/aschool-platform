import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Student Health Records — View own health records and vaccination history
///
/// Backed by real endpoints (there is no /student/health route):
/// - GET /health-records/students/{studentId}      → profile (allergies list, conditions)
/// - GET /health-records/visits?student_id=...     → medical visits
/// - GET /health-records/immunizations?student_id= → vaccination history
/// Rows are mapped into the shapes the tab UIs below already render.
class StudentHealthScreen extends ConsumerStatefulWidget {
  const StudentHealthScreen({super.key});

  @override
  ConsumerState<StudentHealthScreen> createState() =>
      _StudentHealthScreenState();
}

class _StudentHealthScreenState extends ConsumerState<StudentHealthScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _records = [];
  List<dynamic> _vaccinations = [];
  List<dynamic> _allergies = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Resolve the student profile first — health-records routes are keyed
      // by student id, not by the logged-in user id.
      final student = await ref.read(currentStudentProvider.future);
      final studentId = student?.id;
      if (studentId == null || studentId.isEmpty) {
        setState(() => _error = 'Could not find your student profile.');
        setState(() => _loading = false);
        return;
      }
      final profileRes = await ApiClient.instance
          .get('/health-records/students/$studentId');
      final visitsRes = await ApiClient.instance.get('/health-records/visits',
          queryParameters: {'student_id': studentId});
      final immRes = await ApiClient.instance.get(
          '/health-records/immunizations',
          queryParameters: {'student_id': studentId});
      final profile = safeMap(envelopeData(profileRes.data));
      final visits = safeList(envelopeData(visitsRes.data));
      final immunizations = safeList(envelopeData(immRes.data));
      setState(() {
        // Medical visits render as "records" (condition → reason, date).
        _records = visits
            .map((v) => {
                  'condition': v['reason'] ?? v['diagnosis'] ?? 'Health Visit',
                  'notes': v['treatment'] ?? v['notes'],
                  'date': v['visit_date'],
                })
            .toList();
        // Allergies are plain strings on the health profile.
        _allergies = safeList(profile['allergies'])
            .map((a) => {
                  'allergen':
                      a is Map ? (a['allergen'] ?? a['name']) : a?.toString(),
                  'reaction': a is Map ? a['reaction'] : null,
                  'severity': a is Map ? a['severity'] : null,
                })
            .toList();
        // Immunizations render as vaccinations (vaccine_name + date).
        // Only date_administered counts as "Given" — next_due_date is a
        // schedule, not a completed dose.
        _vaccinations = immunizations
            .map((i) => {
                  'vaccine_name': i['vaccine_name'],
                  'date': i['date_administered'],
                })
            .toList();
      });
    } catch (e, st) {
      debugPrint('StudentHealthScreen load failed: $e\n$st');
      _error = 'Could not load your health records.';
    }
    setState(() => _loading = false);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'health_records',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Health Records'),
        body: _loading
            ? const LoadingShimmer()
            : _error != null
                ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                : Column(
                children: [
                  TabBar(
                    controller: _tabController,
                    tabs: const [
                      Tab(text: 'Records'),
                      Tab(text: 'Vaccinations'),
                      Tab(text: 'Allergies'),
                    ],
                  ),
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _RecordsList(records: _records),
                        _VaccinationsList(vaccinations: _vaccinations),
                        _AllergiesList(allergies: _allergies),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _RecordsList extends StatelessWidget {
  final List<dynamic> records;
  const _RecordsList({required this.records});

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) {
      return const NoDataContainer(
        title: 'No health records',
        subtitle: 'Your health records will appear here',
        icon: Icons.health_and_safety_rounded,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: records.length,
      itemBuilder: (context, index) {
        final r = records[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: const CircleAvatar(
              child: Icon(Icons.medical_services_rounded),
            ),
            title: Text(r['condition'] ?? r['title'] ?? 'Health Record',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(r['notes'] ?? r['description'] ?? '—',
                maxLines: 2, overflow: TextOverflow.ellipsis),
            trailing:
                Text(r['date'] ?? '—', style: const TextStyle(fontSize: 12)),
          ),
        );
      },
    );
  }
}

class _VaccinationsList extends StatelessWidget {
  final List<dynamic> vaccinations;
  const _VaccinationsList({required this.vaccinations});

  @override
  Widget build(BuildContext context) {
    if (vaccinations.isEmpty) {
      return const NoDataContainer(
        title: 'No vaccination records',
        subtitle: 'Vaccination history will appear here',
        icon: Icons.vaccines_rounded,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: vaccinations.length,
      itemBuilder: (context, index) {
        final v = vaccinations[index];
        final bool isGiven = v['status'] == 'given' || v['date'] != null;
        return ListTile(
          leading: CircleAvatar(
            backgroundColor:
                (isGiven ? Colors.green : Colors.orange).withAlpha(25),
            child: Icon(
              isGiven ? Icons.check_circle_rounded : Icons.schedule_rounded,
              color: isGiven ? Colors.green : Colors.orange,
            ),
          ),
          title: Text(v['vaccine_name'] ?? v['name'] ?? '—',
              style: const TextStyle(fontWeight: FontWeight.w500)),
          subtitle: v['date'] != null ? Text('Given: ${v['date']}') : null,
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: (isGiven ? Colors.green : Colors.orange).withAlpha(25),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              isGiven ? 'Given' : 'Pending',
              style: TextStyle(
                fontSize: 12,
                color: isGiven ? Colors.green[700] : Colors.orange[700],
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        );
      },
    );
  }
}

class _AllergiesList extends StatelessWidget {
  final List<dynamic> allergies;
  const _AllergiesList({required this.allergies});

  @override
  Widget build(BuildContext context) {
    if (allergies.isEmpty) {
      return const NoDataContainer(
        title: 'No allergies recorded',
        subtitle: 'Allergy information will appear here',
        icon: Icons.warning_rounded,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: allergies.length,
      itemBuilder: (context, index) {
        final a = allergies[index];
        final severity = safeStringOrNull(a['severity']) ?? 'mild';
        final severityColor = severity == 'severe'
            ? Colors.red
            : severity == 'moderate'
                ? Colors.orange
                : Colors.yellow[700]!;
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: severityColor.withAlpha(25),
              child: Icon(Icons.warning_amber_rounded, color: severityColor),
            ),
            title: Text(a['allergen'] ?? a['name'] ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: a['reaction'] != null ? Text(a['reaction']) : null,
            trailing: Chip(
              label: Text(severity.toUpperCase(),
                  style: const TextStyle(fontSize: 11)),
              backgroundColor: severityColor.withAlpha(25),
            ),
          ),
        );
      },
    );
  }
}
