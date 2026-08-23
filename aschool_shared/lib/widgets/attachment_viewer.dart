/// AttachmentViewerWidget — displays a list of file attachment URLs
/// Supports: images (inline), PDFs, documents, video links
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/app_theme.dart';

class AttachmentViewerWidget extends StatelessWidget {
  final List<String> attachmentUrls;
  final bool compact;
  final String? baseUrl;

  const AttachmentViewerWidget({
    super.key,
    required this.attachmentUrls,
    this.compact = false,
    this.baseUrl,
  });

  String _resolveUrl(String url) {
    if (url.startsWith('http')) return url;
    return '${baseUrl ?? 'http://localhost:5001'}$url';
  }

  bool _isImage(String url) {
    final lower = url.toLowerCase();
    return lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.gif') ||
        lower.endsWith('.webp');
  }

  bool _isPdf(String url) => url.toLowerCase().endsWith('.pdf');
  bool _isVideo(String url) {
    final lower = url.toLowerCase();
    return lower.contains('youtube') ||
        lower.contains('youtu.be') ||
        lower.endsWith('.mp4') ||
        lower.endsWith('.mov');
  }

  IconData _iconFor(String url) {
    if (_isImage(url)) return Icons.image_rounded;
    if (_isPdf(url)) return Icons.picture_as_pdf_rounded;
    if (_isVideo(url)) return Icons.play_circle_rounded;
    return Icons.attach_file_rounded;
  }

  Color _colorFor(String url) {
    if (_isImage(url)) return Colors.blue;
    if (_isPdf(url)) return Colors.red;
    if (_isVideo(url)) return Colors.purple;
    return Colors.grey.shade700;
  }

  String _labelFor(String url) {
    final parts = url.split('/');
    return Uri.decodeComponent(parts.last.split('?').first);
  }

  Future<void> _open(String url) async {
    final resolved = _resolveUrl(url);
    final uri = Uri.parse(resolved);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (attachmentUrls.isEmpty) return const SizedBox.shrink();

    final images = attachmentUrls.where(_isImage).toList();
    final others = attachmentUrls.where((u) => !_isImage(u)).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Image grid
        if (images.isNotEmpty) ...[
          if (images.length == 1)
            _singleImage(images.first)
          else
            _imageGrid(images),
          if (others.isNotEmpty) const SizedBox(height: 8),
        ],
        // Non-image file chips
        if (others.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: others
                .map((url) => _fileChip(url))
                .toList(),
          ),
      ],
    );
  }

  Widget _singleImage(String url) {
    return GestureDetector(
      onTap: () => _open(url),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: CachedNetworkImage(
          imageUrl: _resolveUrl(url),
          height: 200,
          width: double.infinity,
          fit: BoxFit.cover,
          placeholder: (_, __) => Container(
            height: 200,
            color: Colors.grey.shade100,
            child: const Center(child: CircularProgressIndicator()),
          ),
          errorWidget: (_, __, ___) => Container(
            height: 200,
            color: Colors.grey.shade100,
            child: const Icon(Icons.broken_image, color: Colors.grey),
          ),
        ),
      ),
    );
  }

  Widget _imageGrid(List<String> images) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 6,
        mainAxisSpacing: 6,
        childAspectRatio: 1,
      ),
      itemCount: images.length > 6 ? 6 : images.length,
      itemBuilder: (context, i) {
        final url = images[i];
        final isLast = i == 5 && images.length > 6;
        return GestureDetector(
          onTap: () => _open(url),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Stack(
              fit: StackFit.expand,
              children: [
                CachedNetworkImage(
                  imageUrl: _resolveUrl(url),
                  fit: BoxFit.cover,
                  placeholder: (_, __) =>
                      Container(color: Colors.grey.shade200),
                  errorWidget: (_, __, ___) =>
                      Container(color: Colors.grey.shade200,
                          child: const Icon(Icons.broken_image)),
                ),
                if (isLast)
                  Container(
                    color: Colors.black54,
                    child: Center(
                      child: Text(
                        '+${images.length - 5}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 20),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _fileChip(String url) {
    final label = _labelFor(url);
    final icon = _iconFor(url);
    final color = _colorFor(url);

    return GestureDetector(
      onTap: () => _open(url),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: color.withAlpha(18),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withAlpha(50)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                    fontSize: 13, color: color, fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
              ),
            ),
            const SizedBox(width: 6),
            Icon(Icons.open_in_new_rounded, size: 14, color: color.withAlpha(180)),
          ],
        ),
      ),
    );
  }
}

/// Compact inline attachment chip list (for list tiles)
class AttachmentCountChip extends StatelessWidget {
  final int count;
  final Color? color;

  const AttachmentCountChip({super.key, required this.count, this.color});

  @override
  Widget build(BuildContext context) {
    if (count == 0) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: (color ?? ASchoolTheme.primary).withAlpha(20),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.attach_file_rounded,
              size: 12, color: color ?? ASchoolTheme.primary),
          const SizedBox(width: 3),
          Text(
            '$count',
            style: TextStyle(
              fontSize: 11,
              color: color ?? ASchoolTheme.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

/// Upload button widget with progress indicator
class UploadButton extends StatefulWidget {
  final String label;
  final IconData icon;
  final Future<void> Function() onTap;
  final Color? color;

  const UploadButton({
    super.key,
    required this.label,
    this.icon = Icons.attach_file_rounded,
    required this.onTap,
    this.color,
  });

  @override
  State<UploadButton> createState() => _UploadButtonState();
}

class _UploadButtonState extends State<UploadButton> {
  bool _uploading = false;

  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? ASchoolTheme.primary;
    return GestureDetector(
      onTap: _uploading
          ? null
          : () async {
              setState(() => _uploading = true);
              try {
                await widget.onTap();
              } finally {
                if (mounted) setState(() => _uploading = false);
              }
            },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: _uploading ? Colors.grey.shade100 : color.withAlpha(15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _uploading ? Colors.grey : color.withAlpha(80)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_uploading)
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: color),
              )
            else
              Icon(widget.icon, size: 18, color: color),
            const SizedBox(width: 8),
            Text(
              _uploading ? 'Uploading...' : widget.label,
              style: TextStyle(
                  color: _uploading ? Colors.grey : color,
                  fontWeight: FontWeight.w500,
                  fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
