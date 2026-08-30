import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

import '../../providers/parent_providers.dart';

class PTConferenceScreen extends ConsumerWidget {
  const PTConferenceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedChildId = ref.watch(selectedChildIdForApiProvider);
    final state = ref.watch(parentConferencesProvider(selectedChildId));

    return PluginGate(
      pluginSlug: 'conferences',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Parent-Teacher Meetings'),
          centerTitle: false,
        ),
        body: state.when(
          loading: () => const LoadingShimmer(),
          error: (err, _) => ErrorContainer(
            errorMessage: err.toString(),
            onRetry: () =>
                ref.invalidate(parentConferencesProvider(selectedChildId)),
          ),
          data: (conferences) => RefreshIndicator(
            onRefresh: () =>
                ref.refresh(parentConferencesProvider(selectedChildId).future),
            child: conferences.isEmpty
                ? const _EmptyState()
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: conferences.length,
                    itemBuilder: (ctx, i) => _ConferenceCard(
                      conference: conferences[i],
                      studentId: selectedChildId,
                      ref: ref,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const NoDataContainer(
      icon: Icons.people_outline_rounded,
      title: 'No Meetings Scheduled',
      subtitle:
          'Parent-teacher conference meetings will appear here when the school schedules them.',
    );
  }
}

class _ConferenceCard extends StatefulWidget {
  final Map<String, dynamic> conference;
  final String? studentId;
  final WidgetRef ref;

  const _ConferenceCard({
    required this.conference,
    required this.studentId,
    required this.ref,
  });

  @override
  State<_ConferenceCard> createState() => _ConferenceCardState();
}

class _ConferenceCardState extends State<_ConferenceCard> {
  bool _booking = false;

  String? get _bookedSlotId {
    final booked = safeMapOrNull(widget.conference['booked_slot']);
    return booked?['slot_id']?.toString();
  }

  Future<void> _showSlotPicker(BuildContext context) async {
    final conferenceId = widget.conference['id']?.toString();
    if (conferenceId == null) return;

    // Load available slots via direct API call
    List<Map<String, dynamic>> slots = [];
    var slotsFailed = false;
    try {
      final resp = await ApiClient.instance.get(
        '/conferences/$conferenceId/slots',
        queryParameters: {'available_only': 'true'},
      );
      slots = safeMapList(envelopeData(resp.data));
    } catch (e, st) {
      debugPrint('PtConferenceScreen loadSlots failed: $e\n$st');
      slotsFailed = true;
    }

    if (!context.mounted) return;

    if (slotsFailed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Could not load slots. Please try again.')),
      );
      return;
    }

    if (slots.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('No available slots for this conference.')),
      );
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.55,
        builder: (_, controller) => Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Choose a Time Slot',
              style: Theme.of(ctx)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
            const Divider(height: 24),
            Expanded(
              child: ListView.separated(
                controller: controller,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: slots.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx2, i) {
                  final slot = slots[i];
                  final startTime = slot['start_time']?.toString() ?? '';
                  final teacher = slot['teacher_name']?.toString() ?? '';
                  return ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    leading: const Icon(Icons.schedule_rounded,
                        color: ASchoolTheme.primary),
                    title: Text(_formatTime(startTime)),
                    subtitle: teacher.isNotEmpty ? Text('with $teacher') : null,
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () {
                      Navigator.pop(ctx2);
                      _bookSlot(
                          context, conferenceId, slot['id']?.toString() ?? '');
                    },
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _bookSlot(
      BuildContext context, String conferenceId, String slotId) async {
    if (slotId.isEmpty) return;
    setState(() => _booking = true);
    try {
      await ApiClient.instance.post(
        '/parent/conferences/$conferenceId/book',
        data: {
          'slot_id': slotId,
          if (widget.studentId != null) 'student_id': widget.studentId,
        },
      );
      widget.ref.invalidate(parentConferencesProvider(widget.studentId));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Meeting booked successfully!')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Booking failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _booking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final conf = widget.conference;
    final isVirtual = conf['is_virtual'] == true;
    final availableSlots = safeIntOrNull(conf['available_slots']) ?? 0;
    final bookedSlot = safeMapOrNull(conf['booked_slot']);
    final isBooked = bookedSlot != null;

    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: ASchoolTheme.secondary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isVirtual ? Icons.videocam_rounded : Icons.people_rounded,
                    color: ASchoolTheme.secondary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        conf['title']?.toString() ?? 'PT Meeting',
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 15),
                      ),
                      if (conf['description'] != null &&
                          conf['description'].toString().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            conf['description'].toString(),
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey.shade600),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                  ),
                ),
                if (isBooked)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.green.shade200),
                    ),
                    child: const Text(
                      'Booked',
                      style: TextStyle(
                          fontSize: 11,
                          color: Colors.green,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 6,
              children: [
                if (conf['start_date'] != null)
                  _InfoChip(
                    icon: Icons.calendar_today_rounded,
                    label: _formatDate(conf['start_date'].toString()),
                  ),
                _InfoChip(
                  icon: isVirtual
                      ? Icons.videocam_outlined
                      : Icons.location_on_outlined,
                  label: isVirtual ? 'Virtual' : 'In Person',
                ),
                _InfoChip(
                  icon: Icons.event_seat_rounded,
                  label: '$availableSlots slots available',
                  color:
                      availableSlots == 0 ? Colors.red : ASchoolTheme.primary,
                ),
              ],
            ),
            if (isBooked && bookedSlot != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade100),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle_rounded,
                        color: Colors.green.shade600, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Your appointment',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 12),
                          ),
                          Text(
                            '${_formatTime(bookedSlot['start_time']?.toString() ?? '')} '
                            'with ${bookedSlot['teacher_name'] ?? 'Teacher'}',
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey.shade700),
                          ),
                        ],
                      ),
                    ),
                    if (isVirtual && conf['meeting_link'] != null)
                      TextButton.icon(
                        onPressed: () {/* Launch URL */},
                        icon: const Icon(Icons.open_in_new_rounded, size: 14),
                        label:
                            const Text('Join', style: TextStyle(fontSize: 12)),
                        style: TextButton.styleFrom(
                          foregroundColor: ASchoolTheme.primary,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                  ],
                ),
              ),
            ] else if (availableSlots > 0) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _booking ? null : () => _showSlotPicker(context),
                  icon: _booking
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.event_available_rounded, size: 18),
                  label: Text(_booking ? 'Booking...' : 'Book a Slot'),
                  style: FilledButton.styleFrom(
                      backgroundColor: ASchoolTheme.secondary),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ];
      return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
    } catch (e) {
      debugPrint('PtConferenceScreen _formatDate parse failed: $e');
      return iso;
    }
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
      debugPrint('PtConferenceScreen _formatTime parse failed: $e');
      return iso;
    }
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;

  const _InfoChip({required this.icon, required this.label, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? Colors.grey.shade600;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: c),
        const SizedBox(width: 3),
        Text(label, style: TextStyle(fontSize: 12, color: c)),
      ],
    );
  }
}
