import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:aschool_shared/aschool_shared.dart';

class GalleryScreen extends ConsumerStatefulWidget {
  const GalleryScreen({super.key});

  @override
  ConsumerState<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends ConsumerState<GalleryScreen> {
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
      final response = await ApiClient.instance.get(
        '/files/',
        queryParameters: {'type': 'image'},
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
    } catch (_) {
      _files = [];
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
      final response = await ApiClient.instance.get('/files/$fileId/presigned');
      final payload = response.data;
      if (payload is! Map<String, dynamic>) return directUrl;
      final data = payload['data'];
      if (data is! Map) return directUrl;
      final presigned = data['presigned_url']?.toString();
      if (presigned != null && presigned.isNotEmpty) {
        return presigned;
      }
    } catch (_) {
      // Fallback to direct URL when presigned fetch fails.
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

  @override
  Widget build(BuildContext context) {
    final years = _availableYears();
    final files = _filteredFiles();

    return Scaffold(
      appBar: const CustomAppBar(title: 'Gallery'),
      body: _loading
          ? const LoadingShimmer()
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
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: NoDataContainer(
                        title: 'No gallery photos',
                        icon: Icons.photo_library_outlined,
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.all(16),
                      sliver: SliverGrid(
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
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
              padding: const EdgeInsets.fromLTRB(10, 10, 10, 6),
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 0, 6, 4),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => _showPreview(file),
                    icon: const Icon(Icons.remove_red_eye_outlined, size: 20),
                    tooltip: 'Preview',
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () => _openInBrowser(file),
                    icon: const Icon(Icons.download_rounded, size: 20),
                    tooltip: 'Open / Download',
                  ),
                ],
              ),
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
