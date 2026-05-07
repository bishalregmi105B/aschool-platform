import 'package:flutter/material.dart';
import 'package:aschool_shared/aschool_shared.dart';

class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key});

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  List<Map<String, dynamic>> _files = [];
  bool _loading = true;
  String _selectedYear = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.instance.get(
        '/files/',
        queryParameters: {'type': 'image'},
      );
      final data = (res.data is Map<String, dynamic>) ? res.data['data'] : null;
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

    final years = _availableYears();
    final files = _filteredFiles();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _yearChip('all', 'All Years'),
                      for (final year in years) _yearChip(year, year),
                    ],
                  ),
                ),
              ),
            ),
            if (files.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: NoDataContainer(
                  title: 'No gallery photos',
                  subtitle:
                      'Upload image files to publish them in gallery views.',
                  icon: Icons.photo_library_outlined,
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 220,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.82,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _photoTile(files[index]),
                    childCount: files.length,
                  ),
                ),
              ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateAlbumDialog,
        icon: const Icon(Icons.add),
        label: const Text('Create Album'),
      ),
    );
  }

  Widget _yearChip(String value, String label) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: _selectedYear == value,
        onSelected: (_) => setState(() => _selectedYear = value),
      ),
    );
  }

  Widget _photoTile(Map<String, dynamic> file) {
    final url = file['url']?.toString();
    final title = file['original_name']?.toString() ?? 'Gallery photo';
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: url == null || url.isEmpty
                ? Container(
                    color: Colors.grey.shade100,
                    child:
                        const Center(child: Icon(Icons.broken_image_outlined)),
                  )
                : Image.network(
                    url,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        const Center(child: Icon(Icons.broken_image_outlined)),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  file['folder']?.toString() ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showCreateAlbumDialog() async {
    final nameCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Create Album'),
        content: TextField(
          controller: nameCtrl,
          decoration: const InputDecoration(labelText: 'Album name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              await ApiClient.instance.post('/files/folders', data: {
                'name': name,
                'module': 'gallery',
              });
              if (!context.mounted) return;
              Navigator.pop(context);
              await _load();
              if (!mounted) return;
              ScaffoldMessenger.of(this.context).showSnackBar(
                const SnackBar(content: Text('Album created')),
              );
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    nameCtrl.dispose();
  }

  List<Map<String, dynamic>> _filteredFiles() {
    if (_selectedYear == 'all') return _files;
    return _files.where((file) => _yearFor(file) == _selectedYear).toList();
  }

  List<String> _availableYears() {
    final years = _files
        .map(_yearFor)
        .where((year) => year != null)
        .cast<String>()
        .toSet()
        .toList();
    years.sort((a, b) => b.compareTo(a));
    return years;
  }

  String? _yearFor(Map<String, dynamic> file) {
    final createdAt = file['created_at']?.toString();
    if (createdAt == null || createdAt.isEmpty) return null;
    return DateTime.tryParse(createdAt)?.year.toString();
  }
}
