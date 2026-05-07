import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Design Studio — browse templates, trigger bulk generation jobs
/// Full canvas editing lives on the web dashboard; this provides
/// mobile access for browsing templates and viewing documents.
class DesignStudioScreen extends ConsumerStatefulWidget {
  const DesignStudioScreen({super.key});

  @override
  ConsumerState<DesignStudioScreen> createState() =>
      _DesignStudioScreenState();
}

class _DesignStudioScreenState extends ConsumerState<DesignStudioScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _templates = [];
  List<Map<String, dynamic>> _documents = [];
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
        ApiClient.instance.get('/design-studio/templates'),
        ApiClient.instance.get('/design-studio/documents?per_page=20'),
      ]);
      setState(() {
        _templates =
            List<Map<String, dynamic>>.from(results[0].data['data'] ?? []);
        _documents =
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
      pluginSlug: 'design_studio',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Design Studio'),
          bottom: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Templates'),
              Tab(text: 'My Documents'),
            ],
          ),
        ),
        body: _loading
            ? const LoadingShimmer()
            : TabBarView(
                controller: _tabCtrl,
                children: [_buildTemplates(), _buildDocuments()],
              ),
      ),
    );
  }

  // ── Templates Tab ─────────────────────────────────────────────────────────

  Widget _buildTemplates() {
    if (_templates.isEmpty) {
      return NoDataContainer(
        title: 'No templates yet',
        subtitle: 'Use the web dashboard to create templates',
        icon: Icons.palette_rounded,
        // Refresh action via the shared component's "action" concept isn't
        // supported by NoDataContainer directly — add a button below it.
      );
    }

    // Group templates by category
    final Map<String, List<Map<String, dynamic>>> grouped = {};
    for (final t in _templates) {
      final cat = t['category'] as String? ?? 'Other';
      grouped.putIfAbsent(cat, () => []).add(t);
    }

    return PullToRefresh(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: grouped.entries.map((entry) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionHeader(title: entry.key),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.4,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                children: entry.value.asMap().entries.map((e) {
                  return ESchoolAnimatedEntry(
                    index: e.key,
                    child: _templateCard(e.value),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _templateCard(Map<String, dynamic> template) {
    return InkWell(
      onTap: () => _showTemplateActions(template),
      borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
      child: ESchoolCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 48,
              decoration: BoxDecoration(
                color: ASchoolTheme.primary.withAlpha(12),
                borderRadius: BorderRadius.circular(ASchoolTheme.radiusSm),
              ),
              child: const Center(
                child: Icon(
                  Icons.description_rounded,
                  color: ASchoolTheme.primary,
                  size: 26,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              template['name'] as String? ?? '',
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  // ── Documents Tab ─────────────────────────────────────────────────────────

  Widget _buildDocuments() {
    if (_documents.isEmpty) {
      return const NoDataContainer(
        title: 'No documents yet',
        subtitle: 'Generated documents will appear here',
        icon: Icons.folder_open_rounded,
      );
    }
    return PullToRefresh(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _documents.length,
        itemBuilder: (_, i) {
          final doc = _documents[i];
          return ESchoolAnimatedEntry(
            index: i,
            child: ESchoolCard(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: const Color(0xFF6366F1).withAlpha(20),
                  child: const Icon(
                    Icons.description_rounded,
                    color: Color(0xFF6366F1),
                  ),
                ),
                title: Text(
                  doc['name'] as String? ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  '${doc['template_type'] ?? ''} • ${doc['created_at'] ?? ''}',
                  style: const TextStyle(
                      fontSize: 12, color: ASchoolTheme.mutedText),
                ),
                trailing: const Icon(
                  Icons.download_rounded,
                  color: ASchoolTheme.primary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Template Actions Bottom Sheet ─────────────────────────────────────────

  void _showTemplateActions(Map<String, dynamic> template) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              template['name'] as String? ?? '',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.people_rounded,
                  color: ASchoolTheme.primary),
              title: const Text('Bulk Generate — All Students'),
              subtitle: const Text('Generate for all active students'),
              onTap: () => Navigator.of(context).pop(),
            ),
            ListTile(
              leading:
                  const Icon(Icons.class_rounded, color: ASchoolTheme.primary),
              title: const Text('Bulk Generate — By Class'),
              subtitle: const Text('Choose a class to generate for'),
              onTap: () => Navigator.of(context).pop(),
            ),
            ListTile(
              leading: const Icon(Icons.open_in_browser_rounded,
                  color: ASchoolTheme.mutedText),
              title: const Text('Full Editor'),
              subtitle: const Text('Open web dashboard for full design'),
              onTap: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }
}
