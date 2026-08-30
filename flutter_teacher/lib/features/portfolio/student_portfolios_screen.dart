import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Teacher Portfolio Review — Browse and review student portfolio entries
class StudentPortfoliosScreen extends ConsumerStatefulWidget {
  const StudentPortfoliosScreen({super.key});

  @override
  ConsumerState<StudentPortfoliosScreen> createState() =>
      _StudentPortfoliosScreenState();
}

class _StudentPortfoliosScreenState
    extends ConsumerState<StudentPortfoliosScreen> {
  List<dynamic> _entries = [];
  bool _loading = true;
  String _search = '';
  String _category = '';
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
      final res =
          await ApiClient.instance.get('/teacher/portfolios', queryParameters: {
        if (_search.isNotEmpty) 'search': _search,
        if (_category.isNotEmpty) 'category': _category,
      });
      final payload = res.data;
      setState(() {
        _entries = safeList(payload?['entries']);
      });
    } catch (e, st) {
      debugPrint('StudentPortfoliosScreen load failed: $e\n$st');
      _error = 'Could not load student portfolios.';
    }
    setState(() => _loading = false);
  }

  Future<void> _addFeedback(dynamic entry) async {
    final controller = TextEditingController();
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Add Feedback',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Write your feedback...',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context, controller.text),
                child: const Text('Submit Feedback'),
              ),
            ),
          ],
        ),
      ),
    );

    if (result != null && result.isNotEmpty) {
      try {
        await ApiClient.instance.post(
          '/teacher/portfolios/${entry['id']}/feedback',
          data: {'feedback': result},
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Feedback added successfully')));
        }
      } catch (e, st) {
        debugPrint('StudentPortfoliosScreen feedback(${entry['id']}) failed: $e\n$st');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Failed to add feedback')));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = [
      '',
      'academic',
      'creative',
      'sports',
      'community',
      'project'
    ];

    return PluginGate(
      pluginSlug: 'student_portfolio',
      child: Scaffold(
        appBar: const CustomAppBar(title: 'Student Portfolios'),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: TextField(
                onChanged: (v) {
                  setState(() => _search = v);
                  _load();
                },
                decoration: InputDecoration(
                  hintText: 'Search students or titles...',
                  prefixIcon: const Icon(Icons.search_rounded),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: categories.map((cat) {
                  final label = cat.isEmpty
                      ? 'All'
                      : cat[0].toUpperCase() + cat.substring(1);
                  final selected = _category == cat;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(label),
                      selected: selected,
                      onSelected: (_) {
                        setState(() => _category = cat);
                        _load();
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 4),
            Expanded(
              child: _loading
                  ? const LoadingShimmer()
                  : _error != null
                      ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                      : _entries.isEmpty
                      ? const NoDataContainer(
                          title: 'No portfolio entries',
                          subtitle:
                              'Student portfolio entries will appear here',
                          icon: Icons.folder_special_rounded,
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _entries.length,
                          itemBuilder: (context, index) {
                            final e = _entries[index];
                            return Card(
                              margin: const EdgeInsets.only(bottom: 10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (e['thumbnail_url'] != null)
                                    ClipRRect(
                                      borderRadius: const BorderRadius.vertical(
                                          top: Radius.circular(12)),
                                      child: Image.network(
                                        e['thumbnail_url'],
                                        height: 140,
                                        width: double.infinity,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) =>
                                            const SizedBox.shrink(),
                                      ),
                                    ),
                                  Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(e['title'] ?? '—',
                                            style: const TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 15)),
                                        Text(e['student_name'] ?? '—',
                                            style: TextStyle(
                                                fontSize: 13,
                                                color: Colors.grey[600])),
                                        if (e['description'] != null)
                                          Padding(
                                            padding:
                                                const EdgeInsets.only(top: 4),
                                            child: Text(
                                              e['description'],
                                              style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey[700]),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            if (e['category'] != null)
                                              Chip(
                                                label: Text(e['category'],
                                                    style: const TextStyle(
                                                        fontSize: 11)),
                                                padding: EdgeInsets.zero,
                                                visualDensity:
                                                    VisualDensity.compact,
                                              ),
                                            const Spacer(),
                                            TextButton.icon(
                                              onPressed: () => _addFeedback(e),
                                              icon: const Icon(
                                                  Icons.rate_review_rounded,
                                                  size: 16),
                                              label: const Text('Feedback',
                                                  style:
                                                      TextStyle(fontSize: 12)),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
