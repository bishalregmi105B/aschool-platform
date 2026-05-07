import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

class ParentGalleryScreen extends ConsumerStatefulWidget {
  const ParentGalleryScreen({super.key});

  @override
  ConsumerState<ParentGalleryScreen> createState() =>
      _ParentGalleryScreenState();
}

class _ParentGalleryScreenState extends ConsumerState<ParentGalleryScreen> {
  List<Map<String, dynamic>> _files = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await ApiClient.instance.get('/files');
      final data = (r.data is Map<String, dynamic>) ? r.data['data'] : null;
      _files = (data is List)
          ? data
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : [];
    } catch (_) {
      _files = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();
    return RefreshIndicator(
      onRefresh: _load,
      child: _files.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                NoDataContainer(
                  title: 'No gallery files found',
                  subtitle: 'Photos and documents will appear here.',
                  icon: Icons.photo_library_outlined,
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _files.length,
              itemBuilder: (_, i) {
                final f = _files[i];
                return ESchoolAnimatedEntry(
                  index: i,
                  child: ESchoolCard(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: EdgeInsets.zero,
                    child: ListTile(
                      leading: const Icon(Icons.photo_outlined),
                      title: Text(
                        f['original_name']?.toString() ??
                            f['name']?.toString() ??
                            'File',
                      ),
                      subtitle: Text(f['mime_type']?.toString() ?? ''),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
