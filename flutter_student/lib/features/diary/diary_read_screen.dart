import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class DiaryReadScreen extends ConsumerStatefulWidget {
  const DiaryReadScreen({super.key});

  @override
  ConsumerState<DiaryReadScreen> createState() => _DiaryReadScreenState();
}

class _DiaryReadScreenState extends ConsumerState<DiaryReadScreen> {
  List<Map<String, dynamic>> _items = [];
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
      final r = await ApiClient.instance.get('/notices', queryParameters: {
        'target_role': 'student',
        'is_published': 'true',
        'per_page': 100,
      });
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _items = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (e, st) {
      debugPrint('DiaryReadScreen load failed: $e\n$st');
      _items = [];
      _error = 'Could not load diary entries.';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'My Diary'),
      body: _loading
          ? const LoadingShimmer()
          : _error != null
              ? ErrorContainer(errorMessage: _error!, onRetry: _load)
              : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        NoDataContainer(
                          title: 'No diary entries yet',
                          subtitle: 'Diary notes from school will appear here.',
                          icon: Icons.menu_book_outlined,
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _items.length,
                      itemBuilder: (_, i) {
                        final item = _items[i];
                        final published = ((item['published_at'] ?? '')
                                .toString()
                                .isNotEmpty)
                            ? (item['published_at']).toString().split('T').first
                            : '-';

                        return ESchoolAnimatedEntry(
                          index: i,
                          child: ESchoolCard(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.menu_book_outlined),
                              title: Text(item['title']?.toString() ?? 'Diary'),
                              subtitle: Text(
                                item['content']?.toString() ?? '',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              trailing: Text(
                                published,
                                style: const TextStyle(
                                  color: ASchoolTheme.mutedText,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
