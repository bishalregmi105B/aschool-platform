import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_client.dart';
import '../widgets/custom_app_bar.dart';
import '../widgets/error_container.dart';
import '../widgets/loading_shimmer.dart';
import '../widgets/no_data_container.dart';

/// Shared photo gallery used by admin, parent and student apps.
///
/// Fetches files from `/files`, groups them by year, and supports in-app
/// preview with presigned URL resolution plus open/download via the browser.
/// Admin additionally can create albums (`canCreateAlbum`); parent lists all
/// file types (`imagesOnly: false`).
class GalleryScreen extends StatefulWidget {
  final String title;
  final bool showAppBar;
  final bool imagesOnly;
  final bool canCreateAlbum;

  const GalleryScreen({
    super.key,
    this.title = 'Gallery',
    this.showAppBar = false,
    this.imagesOnly = true,
    this.canCreateAlbum = false,
  });

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  List<Map<String, dynamic>> _files = [];
  bool _loading = true;
  String _selectedYear = 'all';
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
        '/files/',
        queryParameters:
            widget.imagesOnly ? {'type': 'image'} : null,
      );
      final data = (response.data is Map<String, dynamic>)
          ? response.data['data']
          : null;
      _files = (data is List)
          ? data
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
          : [];
    } catch (e, st) {
      debugPrint('GalleryScreen load failed: $e\n$st');
      _files = [];
      _error = 'Could not load the gallery.';
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<String?> _resolveFileUrl(Map<String, dynamic> file) async {
    final directUrl = file['url']?.toString();
    final fileId = file['id']?.toString();
    final visibility =
        (file['is_public']?.toString() ?? 'public').toLowerCase();

    final isPublic = visibility == 'public';
    if (isPublic || fileId == null || fileId.isEmpty) {
      return directUrl;
    }

    try {
      final response =
          await ApiClient.instance.get('/files/$fileId/presigned');
      final payload = response.data;
      if (payload is! Map<String, dynamic>) return directUrl;
      final data = payload['data'];
      if (data is! Map) return directUrl;
      final presigned = data['presigned_url']?.toString();
      if (presigned != null && presigned.isNotEmpty) {
        return presigned;
      }
    } catch (e, st) {
      // Fallback to direct URL when presigned fetch fails.
      debugPrint('GalleryScreen presigned($fileId) failed: $e\n$st');
    }
    return directUrl;
  }

  Future<void> _openInBrowser(Map<String, dynamic> file) async {
    final url = await _resolveFileUrl(file);
    final uri = url != null ? Uri.tryParse(url) : null;
    if (uri == null || !uri.hasScheme) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to open this file')),
      );
      return;
    }

    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not launch file URL')),
      );
    }
  }

  Future<void> _showPreview(Map<String, dynamic> file) async {
    final url = await _resolveFileUrl(file);
    if (!mounted) return;
    if (url == null || url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No preview URL available')),
      );
      return;
    }

    final title = file['original_name']?.toString() ?? 'Gallery photo';

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog(
        insetPadding: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(dialogContext),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            Flexible(
              child: AspectRatio(
                aspectRatio: 4 / 3,
                child: Container(
                  color: Colors.black.withAlpha(18),
                  child: InteractiveViewer(
                    child: Image.network(
                      url,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Center(
                          child: Icon(Icons.broken_image_outlined)),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _openInBrowser(file),
                      icon: const Icon(Icons.open_in_new_rounded),
                      label: const Text('Open'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _openInBrowser(file),
                      icon: const Icon(Icons.download_rounded),
                      label: const Text('Download'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showCreateAlbumDialog() async {
    final nameCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Create Album'),
        content: TextField(
          controller: nameCtrl,
          decoration: const InputDecoration(labelText: 'Album name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
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
              if (!dialogContext.mounted) return;
              Navigator.pop(dialogContext);
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

  @override
  Widget build(BuildContext context) {
    final years = _availableYears();
    final files = _filteredFiles();

    return Scaffold(
      appBar: widget.showAppBar ? CustomAppBar(title: widget.title) : null,
      floatingActionButton: widget.canCreateAlbum
          ? FloatingActionButton.extended(
              onPressed: _showCreateAlbumDialog,
              icon: const Icon(Icons.add),
              label: const Text('Create Album'),
            )
          : null,
      body: _loading
          ? const LoadingShimmer()
          : _error != null
              ? ErrorContainer(errorMessage: _error!, onRetry: _load)
              : RefreshIndicator(
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
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: NoDataContainer(
                        title: 'No gallery photos',
                        subtitle: widget.canCreateAlbum
                            ? 'Upload image files to publish them in gallery views.'
                            : null,
                        icon: Icons.photo_library_outlined,
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.all(16),
                      sliver: SliverGrid(
                        gridDelegate:
                            const SliverGridDelegateWithMaxCrossAxisExtent(
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
    );
  }

  Widget _yearChip(String value, String label) {
    final selected = _selectedYear == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => setState(() => _selectedYear = value),
      ),
    );
  }

  Widget _photoTile(Map<String, dynamic> file) {
    final url = file['url']?.toString();
    final title = file['original_name']?.toString() ?? 'Gallery photo';
    final folder = file['folder']?.toString() ?? '';
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _showPreview(file),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: url == null || url.isEmpty
                  ? Container(
                      color: Colors.grey.shade100,
                      child: const Center(
                          child: Icon(Icons.broken_image_outlined)),
                    )
                  : Image.network(
                      url,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Center(
                          child: Icon(Icons.broken_image_outlined)),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 10, 10, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  if (folder.isNotEmpty)
                    Text(
                      folder,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                ],
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                IconButton(
                  onPressed: () => _showPreview(file),
                  icon:
                      const Icon(Icons.remove_red_eye_outlined, size: 20),
                  tooltip: 'Preview',
                ),
                IconButton(
                  onPressed: () => _openInBrowser(file),
                  icon: const Icon(Icons.download_rounded, size: 20),
                  tooltip: 'Open / Download',
                ),
              ],
            ),
          ],
        ),
      ),
    );
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
