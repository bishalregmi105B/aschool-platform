import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../providers/parent_providers.dart';

class DismissalQrScreen extends ConsumerWidget {
  const DismissalQrScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedChildId = ref.watch(selectedChildIdForApiProvider);
    final state = ref.watch(parentDismissalProvider(selectedChildId));

    return PluginGate(
      pluginSlug: 'dismissal',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Pickup QR'),
          centerTitle: false,
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: () =>
                  ref.invalidate(parentDismissalProvider(selectedChildId)),
              tooltip: 'Refresh',
            ),
          ],
        ),
        body: state.when(
          loading: () => const LoadingShimmer(),
          error: (err, _) => ErrorContainer(
            errorMessage: err.toString(),
            onRetry: () =>
                ref.invalidate(parentDismissalProvider(selectedChildId)),
          ),
          data: (data) => RefreshIndicator(
            onRefresh: () =>
                ref.refresh(parentDismissalProvider(selectedChildId).future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _StatusCard(data: data),
                const SizedBox(height: 16),
                if (data['parent_user_id'] != null &&
                    data['student_id'] != null)
                  _QrCard(data: data),
                const SizedBox(height: 16),
                if (safeMapList(data['authorized_pickups']).isNotEmpty)
                  _AuthorizedPickupsCard(
                      pickups: safeMapList(data['authorized_pickups'])),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  final Map<String, dynamic> data;

  const _StatusCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final status = data['status']?.toString() ?? 'unknown';
    final isReleased = status == 'released';
    final studentName = data['student_name']?.toString() ?? 'Student';
    final dismissedAt = data['dismissed_at']?.toString();
    final pickedUpBy = data['picked_up_by']?.toString();

    return ESchoolCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isReleased
                    ? Colors.green.shade50
                    : ASchoolTheme.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                isReleased ? Icons.check_circle_rounded : Icons.school_rounded,
                color:
                    isReleased ? Colors.green.shade600 : ASchoolTheme.primary,
                size: 28,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    studentName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isReleased ? 'Released today' : 'Currently in school',
                    style: TextStyle(
                      fontSize: 13,
                      color: isReleased
                          ? Colors.green.shade700
                          : Colors.grey.shade600,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (isReleased && dismissedAt != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      'At ${_formatTime(dismissedAt)}${pickedUpBy != null ? ' · by $pickedUpBy' : ''}',
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey.shade500),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final h = dt.hour;
      final m = dt.minute.toString().padLeft(2, '0');
      final period = h >= 12 ? 'PM' : 'AM';
      final hour = h % 12 == 0 ? 12 : h % 12;
      return '$hour:$m $period';
    } catch (e) {
      debugPrint('DismissalQrScreen _formatTime parse failed: $e');
      return iso;
    }
  }
}

class _QrCard extends StatelessWidget {
  final Map<String, dynamic> data;

  const _QrCard({required this.data});

  @override
  Widget build(BuildContext context) {
    // QR encodes parent user ID + student ID for school staff to scan
    final qrData =
        'aschool:pickup:${data['parent_user_id']}:${data['student_id']}';

    return ESchoolCard(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            ESchoolSectionTitle(title: 'Pickup Authorization QR'),
            const SizedBox(height: 4),
            Text(
              'Show this QR code to school staff when picking up your child.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: QrImageView(
                data: qrData,
                version: QrVersions.auto,
                size: 200,
                backgroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: qrData));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('QR code ID copied')),
                );
              },
              icon: const Icon(Icons.copy_rounded, size: 14),
              label: const Text('Copy ID'),
              style: TextButton.styleFrom(
                foregroundColor: Colors.grey.shade600,
                textStyle: const TextStyle(fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthorizedPickupsCard extends StatelessWidget {
  final List<Map<String, dynamic>> pickups;

  const _AuthorizedPickupsCard({required this.pickups});

  @override
  Widget build(BuildContext context) {
    return ESchoolCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ESchoolSectionTitle(title: 'Authorized Pickups'),
            const SizedBox(height: 8),
            ...pickups.map((p) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 22,
                        backgroundColor: ASchoolTheme.primary.withOpacity(0.1),
                        backgroundImage: p['photo_url'] != null
                            ? NetworkImage(p['photo_url'].toString())
                            : null,
                        child: p['photo_url'] == null
                            ? Text(
                                _initials(p['name']?.toString() ?? '?'),
                                style: TextStyle(
                                  color: ASchoolTheme.primary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              p['name']?.toString() ?? '',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                            ),
                            if (p['relation'] != null)
                              Text(
                                p['relation'].toString(),
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (p['phone'] != null)
                        Text(
                          p['phone'].toString(),
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade700,
                          ),
                        ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}
