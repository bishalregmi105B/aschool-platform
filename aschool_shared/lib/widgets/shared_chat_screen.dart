import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/models.dart';
import '../providers/providers.dart';
import '../services/auth_service.dart';
import '../services/file_upload_service.dart';
import '../theme/app_theme.dart';
import 'error_container.dart';
import 'loading_shimmer.dart';
import 'no_data_container.dart';
import 'pull_to_refresh.dart';

class SharedChatScreen extends ConsumerStatefulWidget {
  final String title;

  const SharedChatScreen({
    super.key,
    this.title = 'Chat',
  });

  @override
  ConsumerState<SharedChatScreen> createState() => _SharedChatScreenState();
}

class _SharedChatScreenState extends ConsumerState<SharedChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  ChatContact? _selectedContact;
  List<ChatMessage> _messages = [];
  bool _loadingMessages = false;
  bool _sending = false;
  bool _uploadingFile = false;

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    await ref.read(chatProvider.notifier).refresh();
    final contact = _selectedContact;
    if (contact != null) await _loadMessages(contact);
  }

  Future<void> _loadMessages(ChatContact contact) async {
    setState(() {
      _selectedContact = contact;
      _loadingMessages = true;
    });
    try {
      final messages =
          await ref.read(chatRepositoryProvider).getMessages(contact.id);
      if (!mounted) return;
      setState(() {
        _messages = messages;
        _loadingMessages = false;
      });
      _scrollToBottom();
    } catch (error) {
      if (!mounted) return;
      setState(() => _loadingMessages = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to load messages: $error')),
      );
    }
  }

  Future<void> _sendMessage({String? fileUrl, String? fileType}) async {
    final contact = _selectedContact;
    final text = _messageController.text.trim();
    if (contact == null || (text.isEmpty && fileUrl == null) || _sending) return;

    setState(() => _sending = true);
    _messageController.clear();
    try {
      await ref.read(chatRepositoryProvider).sendMessage(
            contact.id,
            text,
            fileUrl: fileUrl,
            fileType: fileType,
          );
      await _loadMessages(contact);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to send: $error')),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _sendFile() async {
    setState(() => _uploadingFile = true);
    try {
      final file = await FileUploadService.instance.pickAndUploadImage(
        module: UploadModule.chat,
      );
      if (file != null && mounted) {
        await _sendMessage(fileUrl: file.fileUrl, fileType: file.fileType);
      }
    } finally {
      if (mounted) setState(() => _uploadingFile = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider);

    return chatState.when(
      loading: () => const LoadingShimmer(),
      error: (error, _) => ErrorContainer(
        errorMessage: error.toString(),
        onRetry: _refresh,
      ),
      data: (data) {
        return LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 720;
            if (!wide && _selectedContact != null) {
              return _messagePane(showBack: true);
            }
            return PullToRefresh(
              onRefresh: _refresh,
              child: wide
                  ? Row(
                      children: [
                        SizedBox(
                          width: 340,
                          child: _contactList(data.contacts),
                        ),
                        const VerticalDivider(width: 1),
                        Expanded(child: _messagePane(showBack: false)),
                      ],
                    )
                  : _contactList(data.contacts),
            );
          },
        );
      },
    );
  }

  Widget _contactList(List<ChatContact> contacts) {
    if (contacts.isEmpty) {
      return const NoDataContainer(
        title: 'No chat contacts',
        subtitle: 'Contacts will appear here when available.',
        icon: Icons.forum_outlined,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.only(top: 8),
      itemCount: contacts.length,
      separatorBuilder: (_, __) =>
          Divider(
                    height: 1,
                    indent: 72,
                    color: Theme.of(context).dividerColor,
                  ),
      itemBuilder: (context, index) {
        final contact = contacts[index];
        final selected = _selectedContact?.id == contact.id;
        return _ContactTile(
          contact: contact,
          selected: selected,
          onTap: () => _loadMessages(contact),
        );
      },
    );
  }

  Widget _messagePane({required bool showBack}) {
    final contact = _selectedContact;
    if (contact == null) {
      return const NoDataContainer(
        title: 'Select a conversation',
        icon: Icons.chat_bubble_outline_rounded,
      );
    }

    return Column(
      children: [
        // Chat header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            border: Border(
                bottom: BorderSide(color: Theme.of(context).dividerColor)),
          ),
          child: Row(
            children: [
              if (showBack)
                IconButton(
                  icon: const Icon(Icons.arrow_back_rounded),
                  onPressed: () =>
                      setState(() => _selectedContact = null),
                ),
              Stack(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: ASchoolTheme.primary.withAlpha(30),
                    backgroundImage: contact.avatarUrl != null
                        ? NetworkImage(contact.avatarUrl!)
                        : null,
                    child: contact.avatarUrl == null
                        ? Text(_initials(contact.name),
                            style: const TextStyle(
                                color: ASchoolTheme.primary,
                                fontWeight: FontWeight.bold))
                        : null,
                  ),
                  if (contact.isOnline)
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: Colors.green,
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: Theme.of(context).cardColor, width: 2),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(contact.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15)),
                    Text(
                      contact.isOnline
                          ? 'Online'
                          : _roleLabel(contact.role),
                      style: TextStyle(
                        color: contact.isOnline
                            ? Colors.green
                            : Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Messages
        Expanded(
          child: Container(
            color: Theme.of(context)
                .colorScheme
                .surfaceContainerHighest
                .withAlpha(80),
            child: _loadingMessages
                ? const LoadingShimmer()
                : _messages.isEmpty
                    ? const NoDataContainer(
                        title: 'Start the conversation',
                        icon: Icons.mark_chat_unread_outlined,
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) =>
                            _messageBubble(_messages[index]),
                      ),
          ),
        ),
        // Input bar
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              border: Border(
                  top: BorderSide(color: Theme.of(context).dividerColor)),
            ),
            child: Row(
              children: [
                IconButton(
                  icon: _uploadingFile
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2))
                      : Icon(Icons.attach_file_rounded,
                          color: Theme.of(context)
                              .colorScheme
                              .onSurfaceVariant),
                  onPressed: _uploadingFile ? null : _sendFile,
                  tooltip: 'Attach',
                ),
                Expanded(
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: TextField(
                      controller: _messageController,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      decoration: const InputDecoration(
                        hintText: 'Type a message...',
                        hintStyle: TextStyle(fontSize: 14),
                        border: InputBorder.none,
                        contentPadding:
                            EdgeInsets.symmetric(vertical: 10),
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  decoration: const BoxDecoration(
                    color: ASchoolTheme.primary,
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: _sending
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.send_rounded,
                            color: Colors.white),
                    onPressed: _sending ? null : () => _sendMessage(),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _messageBubble(ChatMessage message) {
    final currentUserId = ref.read(authProvider).user?.id;
    final mine =
        currentUserId != null && currentUserId == message.senderId;
    final hasFile =
        message.fileUrl != null && message.fileUrl!.isNotEmpty;
    final lower = message.fileUrl?.toLowerCase() ?? '';
    final isImage = hasFile &&
        (message.fileType == 'image' ||
            lower.contains('.jpg') ||
            lower.contains('.png') ||
            lower.contains('.jpeg') ||
            lower.contains('.webp'));

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Align(
        alignment:
            mine ? Alignment.centerRight : Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75,
          ),
          child: Column(
            crossAxisAlignment: mine
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              if (!mine && message.senderName != null)
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 3),
                  child: Text(message.senderName!,
                      style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context)
                              .colorScheme
                              .onSurfaceVariant,
                          fontWeight: FontWeight.w600)),
                ),
              Container(
                decoration: BoxDecoration(
                  color: mine
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).cardColor,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(18),
                    topRight: const Radius.circular(18),
                    bottomLeft: Radius.circular(mine ? 18 : 4),
                    bottomRight: Radius.circular(mine ? 4 : 18),
                  ),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withAlpha(
                            Theme.of(context).brightness == Brightness.dark
                                ? 50
                                : 12),
                        blurRadius: 4,
                        offset: const Offset(0, 1))
                  ],
                ),
                child: Column(
                  crossAxisAlignment: mine
                      ? CrossAxisAlignment.end
                      : CrossAxisAlignment.start,
                  children: [
                    if (isImage)
                      ClipRRect(
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(18),
                          topRight: Radius.circular(18),
                        ),
                        child: GestureDetector(
                          onTap: () async {
                            final uri = Uri.parse(message.fileUrl!);
                            if (await canLaunchUrl(uri)) {
                              await launchUrl(uri,
                                  mode: LaunchMode
                                      .externalApplication);
                            }
                          },
                          child: CachedNetworkImage(
                            imageUrl: message.fileUrl!,
                            width: double.infinity,
                            height: 200,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(
                                height: 200,
                                color: Theme.of(context)
                                    .dividerColor),
                            errorWidget: (_, __, ___) => Container(
                                height: 200,
                                color: Theme.of(context)
                                    .dividerColor,
                                child: const Icon(Icons.broken_image)),
                          ),
                        ),
                      ),
                    if (hasFile && !isImage)
                      GestureDetector(
                        onTap: () async {
                          final uri = Uri.parse(message.fileUrl!);
                          if (await canLaunchUrl(uri)) {
                            await launchUrl(uri,
                                mode: LaunchMode.externalApplication);
                          }
                        },
                        child: Container(
                          margin: const EdgeInsets.all(8),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: mine
                                ? Colors.white.withAlpha(30)
                                : Theme.of(context)
                                    .colorScheme
                                    .surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                  Icons.insert_drive_file_rounded,
                                  color: mine
                                      ? Colors.white70
                                      : Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                                  size: 20),
                              const SizedBox(width: 8),
                              Flexible(
                                child: Text(
                                  message.fileUrl!.split('/').last,
                                  style: TextStyle(
                                      color: mine
                                          ? Colors.white
                                          : Colors.grey.shade800,
                                      fontSize: 13),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    if (message.message.isNotEmpty)
                      Padding(
                        padding:
                            const EdgeInsets.fromLTRB(14, 8, 14, 4),
                        child: Text(
                          message.message,
                          style: TextStyle(
                              color: mine
                                  ? Colors.white
                                  : Colors.black87,
                              fontSize: 14,
                              height: 1.4),
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
                      child: Text(
                        _formatTime(message.timestamp),
                        style: TextStyle(
                          color: mine
                              ? Colors.white60
                              : Colors.grey.shade400,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  String _roleLabel(String role) {
    return role
        .split('_')
        .where((p) => p.isNotEmpty)
        .map((p) => '${p[0].toUpperCase()}${p.substring(1)}')
        .join(' ');
  }

  String _formatTime(String timestamp) {
    final parsed = DateTime.tryParse(timestamp);
    if (parsed == null) return '';
    final local = parsed.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final suffix = local.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $suffix';
  }
}

// ─── Contact Tile ─────────────────────────────────────────────────────────────

class _ContactTile extends StatelessWidget {
  final ChatContact contact;
  final bool selected;
  final VoidCallback onTap;

  const _ContactTile(
      {required this.contact,
      required this.selected,
      required this.onTap});

  String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  Color _roleColor(String role) {
    switch (role) {
      case 'teacher':
        return Colors.blue;
      case 'parent':
        return Colors.green;
      case 'student':
        return Colors.orange;
      case 'school_admin':
        return Colors.purple;
      default:
        return Colors.grey;
    }
  }

  String _roleLabel(String role) => role
      .split('_')
      .where((p) => p.isNotEmpty)
      .map((p) => '${p[0].toUpperCase()}${p.substring(1)}')
      .join(' ');

  String _shortTime(String timestamp) {
    final dt = DateTime.tryParse(timestamp)?.toLocal();
    if (dt == null) return '';
    final now = DateTime.now();
    if (dt.day == now.day) {
      final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final m = dt.minute.toString().padLeft(2, '0');
      final s = dt.hour >= 12 ? 'PM' : 'AM';
      return '$h:$m $s';
    }
    return '${dt.day}/${dt.month}';
  }

  @override
  Widget build(BuildContext context) {
    final roleColor = _roleColor(contact.role);

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        color: selected
            ? ASchoolTheme.primary.withAlpha(15)
            : Colors.transparent,
        child: Row(
          children: [
            Stack(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: roleColor.withAlpha(30),
                  backgroundImage: contact.avatarUrl != null
                      ? NetworkImage(contact.avatarUrl!)
                      : null,
                  child: contact.avatarUrl == null
                      ? Text(
                          _initials(contact.name),
                          style: TextStyle(
                              color: roleColor,
                              fontWeight: FontWeight.bold,
                              fontSize: 15),
                        )
                      : null,
                ),
                if (contact.isOnline)
                  Positioned(
                    bottom: 1,
                    right: 1,
                    child: Container(
                      width: 13,
                      height: 13,
                      decoration: BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          contact.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 14),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (contact.lastMessageTime != null)
                        Text(
                          _shortTime(contact.lastMessageTime!),
                          style: TextStyle(
                              color: Colors.grey.shade400, fontSize: 11),
                        ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: roleColor.withAlpha(20),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _roleLabel(contact.role),
                          style: TextStyle(
                              color: roleColor,
                              fontSize: 10,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          contact.lastMessage ?? '',
                          style: TextStyle(
                              color: Theme.of(context)
                              .colorScheme
                              .onSurfaceVariant, fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (contact.unreadCount > 0)
              Container(
                margin: const EdgeInsets.only(left: 8),
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: ASchoolTheme.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${contact.unreadCount}',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
