import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Admission Management — applications, leads, merit list
class AdmissionScreen extends ConsumerStatefulWidget {
  const AdmissionScreen({super.key});

  @override
  ConsumerState<AdmissionScreen> createState() => _AdmissionScreenState();
}

class _AdmissionScreenState extends ConsumerState<AdmissionScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _applications = [];
  List<Map<String, dynamic>> _leads = [];
  Map<String, dynamic> _stats = {};
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
        ApiClient.instance.get('/admission/applications?per_page=20'),
        ApiClient.instance.get('/admission/leads?per_page=20'),
        ApiClient.instance.get('/admission/stats'),
      ]);
      setState(() {
        _applications =
            List<Map<String, dynamic>>.from(results[0].data['data'] ?? []);
        _leads =
            List<Map<String, dynamic>>.from(results[1].data['data'] ?? []);
        _stats =
            Map<String, dynamic>.from(results[2].data['data'] ?? {});
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'admission',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Admission'),
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Dashboard'),
              Tab(text: 'Applications'),
              Tab(text: 'Leads'),
            ],
          ),
        ),
        body: _loading
            ? const LoadingShimmer()
            : TabBarView(
                controller: _tabCtrl,
                children: [
                  _buildDashboard(),
                  _buildApplications(),
                  _buildLeads(),
                ],
              ),
      ),
    );
  }

  // ── Dashboard Tab ─────────────────────────────────────────────────────────

  Widget _buildDashboard() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // KPI grid
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 2,
            children: [
              StatCard(
                title: 'Applications',
                value: '${_stats['total_applications'] ?? 0}',
                icon: Icons.description_rounded,
                color: ASchoolTheme.primary,
              ),
              StatCard(
                title: 'Leads',
                value: '${_stats['total_leads'] ?? 0}',
                icon: Icons.people_rounded,
                color: ASchoolTheme.warning,
              ),
              StatCard(
                title: 'Accepted',
                value: '${_stats['accepted'] ?? 0}',
                icon: Icons.check_circle_rounded,
                color: ASchoolTheme.success,
              ),
              StatCard(
                title: 'Pending',
                value: '${_stats['pending'] ?? 0}',
                icon: Icons.pending_rounded,
                color: ASchoolTheme.accent,
              ),
            ],
          ),
          const SizedBox(height: 20),
          SectionHeader(
            title: 'Recent Applications',
            actionText: 'See All',
            onActionTap: () => _tabCtrl.animateTo(1),
          ),
          ..._applications.take(5).map(_buildAppTile),
        ],
      ),
    );
  }

  // ── Applications Tab ──────────────────────────────────────────────────────

  Widget _buildApplications() {
    if (_applications.isEmpty) {
      return const NoDataContainer(
        title: 'No applications yet',
        subtitle: 'Share your admission form link with prospective students',
        icon: Icons.description_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _applications.length,
        itemBuilder: (_, i) => _buildAppTile(_applications[i]),
      ),
    );
  }

  // ── Leads Tab ─────────────────────────────────────────────────────────────

  Widget _buildLeads() {
    if (_leads.isEmpty) {
      return const NoDataContainer(
        title: 'No leads yet',
        subtitle: 'Leads from social media and inquiry forms appear here',
        icon: Icons.person_search_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _leads.length,
        itemBuilder: (context, i) {
          final lead = _leads[i];
          final aiScore = (lead['ai_score'] as num?)?.toInt() ?? 0;

          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: ASchoolTheme.warning.withAlpha(20),
                  child: const Icon(
                    Icons.person_rounded,
                    color: ASchoolTheme.warning,
                  ),
                ),
                title: Text(
                  lead['name'] as String? ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  '${lead['phone'] ?? ''} • ${lead['source'] ?? 'direct'}',
                  style: const TextStyle(
                      fontSize: 12, color: ASchoolTheme.mutedText),
                ),
                trailing: ESchoolInfoPill(
                  icon: Icons.auto_awesome_rounded,
                  label: '$aiScore% match',
                  color: ASchoolTheme.warning,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _buildAppTile(Map<String, dynamic> app) {
    final status = app['status'] as String? ?? 'pending';
    final statusColor = switch (status) {
      'accepted' => ASchoolTheme.success,
      'rejected' => ASchoolTheme.danger,
      _ => ASchoolTheme.warning,
    };

    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(
          app['applicant_name'] as String? ?? '',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          '${app['applied_for_class'] ?? ''} • ${app['submitted_at'] ?? ''}',
          style:
              const TextStyle(fontSize: 12, color: ASchoolTheme.mutedText),
        ),
        trailing: ESchoolInfoPill(
          icon: Icons.circle,
          label: status.toUpperCase(),
          color: statusColor,
        ),
      ),
    );
  }
}
