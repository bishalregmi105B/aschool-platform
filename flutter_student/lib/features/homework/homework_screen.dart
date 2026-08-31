import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:aschool_shared/aschool_shared.dart';

class HomeworkScreen extends ConsumerStatefulWidget {
  const HomeworkScreen({super.key});

  @override
  ConsumerState<HomeworkScreen> createState() => _HomeworkScreenState();
}

class _HomeworkScreenState extends ConsumerState<HomeworkScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(assignmentsProvider);

    return Scaffold(
      appBar: const CustomAppBar(
        title: 'Assignments',
        showBackButton: false,
      ),
      body: Column(
        children: [
          AnimatedToggle(
            values: const ['Pending', 'Submitted'],
            selectedIndex: _selectedIndex,
            onToggleCallback: (index) {
              setState(() {
                _selectedIndex = index;
              });
            },
          ),
          Expanded(
            child: PullToRefresh(
              onRefresh: () => ref.read(assignmentsProvider.notifier).refresh(),
              child: state.when(
                loading: () => const ShimmerLoadingList(),
                error: (error, stackTrace) => ErrorContainer(
                  errorMessage: error.toString(),
                  onRetry: () =>
                      ref.read(assignmentsProvider.notifier).refresh(),
                ),
                data: (data) {
                  final items =
                      _selectedIndex == 0 ? data.pending : data.submitted;
                  final isPending = _selectedIndex == 0;

                  if (items.isEmpty) {
                    return NoDataContainer(
                      title: isPending
                          ? 'No pending homework! 🎉'
                          : 'No submissions yet',
                      icon: isPending
                          ? Icons.check_circle_outline
                          : Icons.assignment_turned_in,
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final hw = items[index];
                      return _HomeworkCard(
                        hw: hw,
                        isPending: isPending,
                        onTap: () => _showDetail(hw, isPending),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showDetail(Assignment hw, bool isPending) {
    CustomBottomSheet.show(
      context: context,
      title: 'Assignment Details',
      height: MediaQuery.of(context).size.height * 0.68,
      child: _AssignmentDetailView(
        hw: hw,
        isPending: isPending,
        onSubmitted: () {
          ref.read(assignmentsProvider.notifier).refresh();
        },
      ),
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  final Assignment hw;
  final bool isPending;
  final VoidCallback onTap;

  const _HomeworkCard({
    required this.hw,
    required this.isPending,
    required this.onTap,
  });

  String get _dueDateText => hw.dueDateBs ?? hw.dueDate ?? '-';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isOverdue = hw.isOverdue;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? ASchoolTheme.darkBorder
              : Colors.grey.shade200,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(5),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: ASchoolTheme.primary.withAlpha(20),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      hw.subject,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: ASchoolTheme.primary,
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (isOverdue && isPending)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.red.withAlpha(20),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.warning_rounded,
                              color: Colors.red, size: 14),
                          SizedBox(width: 4),
                          Text('OVERDUE',
                              style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.red,
                                  fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  if (!isPending && hw.marks != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.green.withAlpha(20),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${hw.marks}/${hw.totalMarks}',
                        style: const TextStyle(
                            fontSize: 12,
                            color: Colors.green,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                hw.title,
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.person_outline,
                      size: 16, color: Colors.grey.shade500),
                  const SizedBox(width: 4),
                  Text(hw.teacher,
                      style:
                          TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  const SizedBox(width: 16),
                  Icon(Icons.calendar_today,
                      size: 16,
                      color: (isOverdue && isPending)
                          ? Colors.red
                          : Colors.grey.shade500),
                  const SizedBox(width: 4),
                  Text(
                    'Due: $_dueDateText',
                    style: TextStyle(
                      fontSize: 13,
                      color: (isOverdue && isPending)
                          ? Colors.red
                          : Colors.grey.shade600,
                      fontWeight: (isOverdue && isPending)
                          ? FontWeight.w600
                          : FontWeight.normal,
                    ),
                  ),
                ],
              ),
              if (!isPending &&
                  hw.feedback != null &&
                  hw.feedback!.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.blue.withAlpha(15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.format_quote_rounded,
                          size: 16, color: Colors.blue),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          hw.feedback!,
                          style: TextStyle(
                              fontSize: 13, color: Colors.blue.shade900),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _AssignmentDetailView extends StatefulWidget {
  final Assignment hw;
  final bool isPending;
  final VoidCallback onSubmitted;

  const _AssignmentDetailView({
    required this.hw,
    required this.isPending,
    required this.onSubmitted,
  });

  @override
  State<_AssignmentDetailView> createState() => _AssignmentDetailViewState();
}

class _AssignmentDetailViewState extends State<_AssignmentDetailView> {
  final noteController = TextEditingController();
  final attachmentController = TextEditingController();
  String? _attachmentUrl;
  bool _isSubmitting = false;

  @override
  void dispose() {
    noteController.dispose();
    attachmentController.dispose();
    super.dispose();
  }

  Future<void> _submitAssignment() async {
    setState(() => _isSubmitting = true);
    try {
      final payload = <String, dynamic>{
        'note': noteController.text,
      };
      final attachmentUrl = _attachmentUrl?.trim();
      if (attachmentUrl != null && attachmentUrl.isNotEmpty) {
        payload['file_url'] = attachmentUrl;
        payload['attachment_urls'] = [attachmentUrl];
      }

      await ApiClient.instance.post(
        '/student/assignments/${widget.hw.id}/submit',
        data: payload,
      );
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Assignment submitted successfully! ✅'),
              backgroundColor: Colors.green),
        );
        widget.onSubmitted();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _openAttachment(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attachment link is invalid')),
      );
      return;
    }

    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open attachment')),
      );
    }
  }

  Future<void> _showAttachmentDialog() async {
    attachmentController.text = _attachmentUrl ?? '';
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Attach File URL'),
        content: TextField(
          controller: attachmentController,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(
            labelText: 'File URL',
            hintText: 'https://example.com/homework.pdf',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final value = attachmentController.text.trim();
              setState(() {
                _attachmentUrl = value.isEmpty ? null : value;
              });
              Navigator.pop(context);
            },
            child: const Text('Use Link'),
          ),
        ],
      ),
    );
  }

  String _attachmentLabel(String url) {
    final uri = Uri.tryParse(url);
    final lastSegment =
        uri?.pathSegments.isNotEmpty == true ? uri!.pathSegments.last : null;
    return (lastSegment == null || lastSegment.isEmpty)
        ? 'Attachment Document'
        : lastSegment;
  }

  @override
  Widget build(BuildContext context) {
    final isOverdue = widget.hw.isOverdue;
    final dueDateText = widget.hw.dueDateBs ?? widget.hw.dueDate ?? '-';
    final attachments = widget.hw.attachments;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: ASchoolTheme.primary.withAlpha(20),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                widget.hw.subject,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, color: ASchoolTheme.primary),
              ),
            ),
            const Spacer(),
            if (isOverdue && widget.isPending)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.red.withAlpha(20),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('OVERDUE',
                    style: TextStyle(
                        fontSize: 12,
                        color: Colors.red,
                        fontWeight: FontWeight.bold)),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          widget.hw.title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Icon(Icons.person_outline, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(width: 6),
            Text(widget.hw.teacher,
                style: TextStyle(color: Colors.grey.shade700, fontSize: 13)),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Icon(Icons.calendar_today,
                size: 16,
                color: (isOverdue && widget.isPending)
                    ? Colors.red
                    : Colors.grey.shade600),
            const SizedBox(width: 6),
            Text(
              'Due: $dueDateText',
              style: TextStyle(
                color: (isOverdue && widget.isPending)
                    ? Colors.red
                    : Colors.grey.shade700,
                fontSize: 13,
                fontWeight: (isOverdue && widget.isPending)
                    ? FontWeight.w600
                    : FontWeight.normal,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Divider(),
        const SizedBox(height: 12),
        const Text(
          'Instructions',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text(
          widget.hw.description ?? 'No description provided.',
          style:
              const TextStyle(fontSize: 13, height: 1.4, color: Colors.black87),
        ),
        if (attachments.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('Attachments',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...attachments.map((a) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                        color: Colors.blue.withAlpha(20),
                        borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.attach_file, color: Colors.blue),
                  ),
                  title: Text(_attachmentLabel(a),
                      style: const TextStyle(fontWeight: FontWeight.w500)),
                  subtitle:
                      Text(a, maxLines: 1, overflow: TextOverflow.ellipsis),
                  trailing: IconButton(
                    icon: const Icon(Icons.download_rounded,
                        color: ASchoolTheme.primary),
                    onPressed: () => _openAttachment(a),
                  ),
                ),
              )),
        ],
        if (!widget.isPending && widget.hw.marks != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.green.withAlpha(15),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.green.withAlpha(50)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: const BoxDecoration(
                      color: Colors.white, shape: BoxShape.circle),
                  child: const Icon(Icons.grade_rounded,
                      color: Colors.green, size: 28),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Marks: ${widget.hw.marks}/${widget.hw.totalMarks}',
                        style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.green),
                      ),
                      if (widget.hw.feedback != null &&
                          widget.hw.feedback!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(widget.hw.feedback!,
                            style: TextStyle(
                                fontSize: 14, color: Colors.green.shade800)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
        if (widget.isPending) ...[
          const SizedBox(height: 20),
          const Text('Submit Work',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _showAttachmentDialog,
            icon: const Icon(Icons.upload_file),
            label: Text(_attachmentUrl == null
                ? 'Attach File URL'
                : 'Change Attached File'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 12),
              side: const BorderSide(color: ASchoolTheme.primary),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
          if (_attachmentUrl != null) ...[
            const SizedBox(height: 8),
            Text(
              _attachmentUrl!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ],
          const SizedBox(height: 16),
          TextField(
            controller: noteController,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Add an optional note for the teacher...',
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.grey.shade50,
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submitAssignment,
              style: ElevatedButton.styleFrom(
                backgroundColor: ASchoolTheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : const Text('Turn In Assignment',
                      style:
                          TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ],
    );
  }
}
