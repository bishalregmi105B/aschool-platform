import 'package:aschool_shared/aschool_shared.dart';
import 'package:flutter/material.dart';

/// Parent read-only view of child's health records (mirrors student health screen)
class ChildHealthScreen extends StatefulWidget {
  const ChildHealthScreen({super.key});

  @override
  State<ChildHealthScreen> createState() => _ChildHealthScreenState();
}

class _ChildHealthScreenState extends State<ChildHealthScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _records = [];
  List<Map<String, dynamic>> _vaccinations = [];
  List<Map<String, dynamic>> _allergies = [];
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
        ApiClient.instance.get('/parent/child-health?type=records'),
        ApiClient.instance.get('/parent/child-health?type=vaccinations'),
        ApiClient.instance.get('/parent/child-health?type=allergies'),
      ]);
      if (!mounted) return;
      setState(() {
        _records = _toList(results[0].data);
        _vaccinations = _toList(results[1].data);
        _allergies = _toList(results[2].data);
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> _toList(dynamic raw) {
    if (raw == null) return [];
    if (raw is List) return raw.cast<Map<String, dynamic>>();
    if (raw is Map) {
      final inner = raw['data'] ?? raw['items'] ?? raw['records'];
      if (inner is List) return inner.cast<Map<String, dynamic>>();
    }
    return [];
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'health_records',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Child Health'),
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Records'),
              Tab(text: 'Vaccinations'),
              Tab(text: 'Allergies'),
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
                  _RecordsTab(records: _records, onRefresh: _load),
                  _VaccinationsTab(
                      vaccinations: _vaccinations, onRefresh: _load),
                  _AllergiesTab(allergies: _allergies, onRefresh: _load),
                ],
              ),
      ),
    );
  }
}

// ─── Records Tab ──────────────────────────────────────────────────────────────

class _RecordsTab extends StatelessWidget {
  final List<Map<String, dynamic>> records;
  final VoidCallback onRefresh;

  const _RecordsTab({required this.records, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) {
      return const NoDataContainer(
        title: 'No Health Records',
        subtitle: "Your child's health records will appear here.",
        icon: Icons.health_and_safety_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: records.length,
        itemBuilder: (context, i) {
          final r = records[i];
          final title =
              r['title'] ?? r['condition'] ?? r['diagnosis'] ?? 'Health Record';
          final date = r['record_date'] ?? r['checked_at'] ?? r['date'] ?? '';
          final notes = r['notes'] ?? r['description'] ?? '';
          final doctor = r['doctor_name'] ?? '';

          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: const CircleAvatar(
                  child: Icon(Icons.medical_services_outlined)),
              title: Text(title,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text([
                if (doctor.isNotEmpty) doctor,
                if (date.isNotEmpty) _fmtDate(date),
                if (notes.isNotEmpty) notes,
              ].join('\n')),
              isThreeLine: notes.isNotEmpty,
            ),
          );
        },
      ),
    );
  }

  String _fmtDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}

// ─── Vaccinations Tab ─────────────────────────────────────────────────────────

class _VaccinationsTab extends StatelessWidget {
  final List<Map<String, dynamic>> vaccinations;
  final VoidCallback onRefresh;

  const _VaccinationsTab({required this.vaccinations, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (vaccinations.isEmpty) {
      return const NoDataContainer(
        title: 'No Vaccination Records',
        subtitle: "Vaccination history will appear here.",
        icon: Icons.vaccines_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: vaccinations.length,
        itemBuilder: (context, i) {
          final v = vaccinations[i];
          final name = v['vaccine_name'] ?? v['name'] ?? 'Vaccine';
          final date =
              v['date_given'] ?? v['administered_at'] ?? v['date'] ?? '';
          final dose = v['dose_number']?.toString() ?? '';
          final provider = v['healthcare_provider'] ?? v['provider'] ?? '';
          final nextDue = v['next_due_date'] ?? '';

          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: CircleAvatar(
                  backgroundColor: Colors.green.shade100,
                  child:
                      const Icon(Icons.vaccines_outlined, color: Colors.green)),
              title: Text(name,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text([
                if (dose.isNotEmpty) 'Dose $dose',
                if (provider.isNotEmpty) provider,
                if (date.isNotEmpty) _fmtDate(date),
              ].join(' • ')),
              trailing: nextDue.isNotEmpty
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Next', style: TextStyle(fontSize: 10)),
                        Text(_fmtDate(nextDue),
                            style: const TextStyle(fontSize: 11)),
                      ],
                    )
                  : null,
            ),
          );
        },
      ),
    );
  }

  String _fmtDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}

// ─── Allergies Tab ────────────────────────────────────────────────────────────

class _AllergiesTab extends StatelessWidget {
  final List<Map<String, dynamic>> allergies;
  final VoidCallback onRefresh;

  const _AllergiesTab({required this.allergies, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    if (allergies.isEmpty) {
      return const NoDataContainer(
        title: 'No Allergies Recorded',
        subtitle: "Allergy information will appear here.",
        icon: Icons.warning_amber_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: allergies.length,
        itemBuilder: (context, i) {
          final a = allergies[i];
          final name = a['allergen'] ?? a['name'] ?? 'Allergen';
          final severity = (a['severity'] ?? 'unknown').toString();
          final reaction = a['reaction'] ?? a['symptoms'] ?? '';
          final isHigh = severity == 'severe' ||
              severity == 'high' ||
              severity == 'critical';

          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            color: isHigh ? Colors.red.shade50 : null,
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor:
                    isHigh ? Colors.red.shade100 : Colors.amber.shade100,
                child: Icon(Icons.warning_amber_outlined,
                    color: isHigh ? Colors.red : Colors.amber),
              ),
              title: Text(name,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: reaction.isNotEmpty ? Text(reaction) : null,
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isHigh ? Colors.red.shade100 : Colors.amber.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  severity.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: isHigh ? Colors.red.shade700 : Colors.amber.shade700,
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
