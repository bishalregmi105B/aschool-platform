import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class GuardiansScreen extends StatefulWidget {
  const GuardiansScreen({super.key});

  @override
  State<GuardiansScreen> createState() => _GuardiansScreenState();
}

class _GuardiansScreenState extends State<GuardiansScreen> {
  List<Map<String, dynamic>> _guardians = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await ApiClient.instance.get(
        '/users',
        queryParameters: {'role': 'parent', 'per_page': 100},
      );
      final data = (response.data is Map<String, dynamic>)
          ? response.data['data']
          : null;
      _guardians = (data is List)
          ? data
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
          : [];
    } catch (e, st) {
      debugPrint('GuardiansScreen load failed: $e\n$st');
      _guardians = [];
      _error = 'Could not load guardians.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();
    if (_error != null) {
      return ErrorContainer(errorMessage: _error!, onRetry: _load);
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: _guardians.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 160),
                NoDataContainer(
                  title: 'No guardians found',
                  icon: Icons.family_restroom_outlined,
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _guardians.length,
              itemBuilder: (_, index) => _guardianTile(_guardians[index]),
            ),
    );
  }

  Widget _guardianTile(Map<String, dynamic> guardian) {
    final children = safeList(guardian['children']);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          child: Text(_initial(guardian['full_name']?.toString())),
        ),
        title: Text(guardian['full_name']?.toString() ?? 'Guardian'),
        subtitle: Text(guardian['phone']?.toString() ?? ''),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${children.length}',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const Text('children', style: TextStyle(fontSize: 11)),
          ],
        ),
        onTap: () => _showGuardianDetails(guardian),
      ),
    );
  }

  void _showGuardianDetails(Map<String, dynamic> guardian) {
    final children = safeList(guardian['children']);
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                guardian['full_name']?.toString() ?? 'Guardian',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 8),
              _detailRow(Icons.phone_rounded, guardian['phone']?.toString()),
              _detailRow(Icons.email_rounded, guardian['email']?.toString()),
              const SizedBox(height: 16),
              const Text(
                'Linked Students',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              if (children.isEmpty)
                Text('No linked students',
                    style: TextStyle(color: Colors.grey.shade600))
              else
                for (final child in children.whereType<Map>())
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.school_rounded),
                    title: Text(child['name']?.toString() ?? 'Student'),
                    subtitle: Text(
                      [
                        child['class_name']?.toString(),
                        child['section_name']?.toString(),
                        child['student_id']?.toString(),
                      ]
                          .where((part) => part != null && part.isNotEmpty)
                          .join(' - '),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailRow(IconData icon, String? value) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: ASchoolTheme.primary),
          const SizedBox(width: 8),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  String _initial(String? value) {
    final text = value?.trim();
    if (text == null || text.isEmpty) return '?';
    return text.substring(0, 1).toUpperCase();
  }
}
