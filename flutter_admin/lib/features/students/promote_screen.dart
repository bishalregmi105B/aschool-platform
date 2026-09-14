import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Admin → Promote Students (R7.2b) — REAL promotion flow.
///
/// Was GET-only: listed active students with no action (mobile audit: "no
/// promote action — promotion cannot be performed"). Now:
///   1. pick source + target class (GET /academics/classes)
///   2. preview who moves (GET /students/promote/preview — promotable count,
///      skipped, roll clashes)
///   3. confirm → POST /students/promote {from_class_id, to_class_id,
///      roll_strategy} — the same single-transaction endpoint the web uses.
class PromoteScreen extends StatefulWidget {
  const PromoteScreen({super.key});

  @override
  State<PromoteScreen> createState() => _PromoteScreenState();
}

class _PromoteScreenState extends State<PromoteScreen> {
  List<Map<String, dynamic>> _classes = [];
  String? _fromClassId;
  String? _toClassId;
  String _rollStrategy = 'keep';

  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _preview;
  bool _promoting = false;

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await ApiClient.instance.get('/academics/classes',
          queryParameters: {'per_page': '100'});
      final data = r.data['data'];
      final rows = data is List
          ? data
          : (data is Map ? (data['classes'] ?? <dynamic>[]) : <dynamic>[]);
      setState(() {
        _classes = rows
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Could not load classes: $e';
        _loading = false;
      });
    }
  }

  Future<void> _loadPreview() async {
    if (_fromClassId == null || _toClassId == null || _fromClassId == _toClassId) {
      return;
    }
    setState(() {
      _preview = null;
      _error = null;
    });
    try {
      final r = await ApiClient.instance.get('/students/promote/preview',
          queryParameters: {
            'from_class_id': _fromClassId!,
            'to_class_id': _toClassId!,
          });
      setState(() => _preview = Map<String, dynamic>.from(r.data['data']));
    } catch (e) {
      setState(() => _error = 'Could not load preview: $e');
    }
  }

  Future<void> _promote() async {
    final promotedCount =
        (_preview?['promotable_count'] ?? _preview?['promote_count'] ?? 0) as int;
    final fromName = _className(_fromClassId);
    final toName = _className(_toClassId);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Promote $promotedCount student(s)?'),
        content: Text(
          'Every eligible student of $fromName moves to $toName in a single '
          'transaction. Roll strategy: ${_rollStrategy == 'keep' ? 'keep current roll numbers (clashes reported)' : 'renumber 1..N per section'}.\n\n'
          'This cannot be undone from the app.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Promote'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _promoting = true);
    try {
      final r = await ApiClient.instance.post('/students/promote', data: {
        'from_class_id': _fromClassId,
        'to_class_id': _toClassId,
        'roll_strategy': _rollStrategy,
      });
      final result = r.data['data'];
      final count =
          result is Map ? (result['promoted'] ?? result['promoted_count'] ?? 0) : 0;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$count student(s) promoted to $toName'),
            backgroundColor: ASchoolTheme.success,
          ),
        );
      }
      await _loadPreview();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Promotion failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _promoting = false);
    }
  }

  String _className(String? id) => _classes
      .where((c) => c['id'].toString() == id)
      .map((c) => c['name'].toString())
      .firstOrNull ??
      '—';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(
        title: 'Promote Students',
        showUtilities: true,
      ),
      body: AsyncScreenScaffold(
        loading: _loading,
        error: _error,
        onRetry: _loadClasses,
        isEmpty: _classes.length < 2,
        emptyTitle: 'Promotion needs at least two classes',
        emptySubtitle:
            'Create the school\'s classes first (source and target must differ).',
        emptyIcon: Icons.school_outlined,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    final canPromote =
        _fromClassId != null && _toClassId != null && _fromClassId != _toClassId;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ESchoolCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Move a whole class into the next grade',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(height: 4),
              Text(
                'Eligible students (active / transferred-in / on-leave) move in one transaction. Graduated and transferred-out students stay.',
                style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _fromClassId,
                decoration: const InputDecoration(
                  labelText: 'From class',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.logout),
                ),
                items: _classes
                    .map((c) => DropdownMenuItem(
                          value: c['id'].toString(),
                          child: Text(c['name'].toString()),
                        ))
                    .toList(),
                onChanged: (v) {
                  setState(() => _fromClassId = v);
                  _loadPreview();
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _toClassId,
                decoration: const InputDecoration(
                  labelText: 'To class',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.login),
                ),
                items: _classes
                    .map((c) => DropdownMenuItem(
                          value: c['id'].toString(),
                          child: Text(c['name'].toString()),
                        ))
                    .toList(),
                onChanged: (v) {
                  setState(() => _toClassId = v);
                  _loadPreview();
                },
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Text('Roll numbers:',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  const SizedBox(width: 12),
                  ChoiceChip(
                    label: const Text('Keep'),
                    selected: _rollStrategy == 'keep',
                    onSelected: (_) => setState(() => _rollStrategy = 'keep'),
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: const Text('Renumber'),
                    selected: _rollStrategy == 'renumber',
                    onSelected: (_) => setState(() => _rollStrategy = 'renumber'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (!canPromote)
          const NoDataContainer(
            title: 'Pick two different classes',
            subtitle:
                'Choose the source and target class above to preview the promotion.',
            icon: Icons.swap_vert,
          )
        else if (_preview == null)
          const LoadingShimmer(itemCount: 3)
        else ...[
          _buildPreviewCards(),
          const SizedBox(height: 16),
          SizedBox(
            height: 52,
            child: FilledButton.icon(
              onPressed: _promoting ? null : _promote,
              icon: _promoting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.trending_up),
              label: Text(_promoting ? 'Promoting…' : 'Promote now'),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPreviewCards() {
    final p = _preview!;
    final promotable = (p['promotable_count'] ?? p['promote_count'] ?? 0) as int;
    final skipped = (p['skipped_count'] ?? p['skip_count'] ?? 0) as int;
    final clashes = (p['roll_clash_count'] ?? p['clash_count'] ?? 0) as int;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: ESchoolCard(
                child: _previewStat('Will move', promotable, ASchoolTheme.success),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ESchoolCard(
                child: _previewStat('Skipped', skipped, Theme.of(context).hintColor),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ESchoolCard(
                child: _previewStat('Roll clashes', clashes,
                    clashes > 0 ? ASchoolTheme.danger : ASchoolTheme.success),
              ),
            ),
          ],
        ),
        if (clashes > 0 && _rollStrategy == 'keep') ...[
          const SizedBox(height: 8),
          Text(
            '$clashes roll number(s) clash in the target class — keep will report them, renumber resolves them.',
            style: const TextStyle(fontSize: 12, color: ASchoolTheme.warning),
          ),
        ],
      ],
    );
  }

  Widget _previewStat(String label, int value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text('$value',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
      ],
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
