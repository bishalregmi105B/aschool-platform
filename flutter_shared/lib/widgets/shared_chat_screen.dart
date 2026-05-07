import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../providers/providers.dart';
import '../services/auth_service.dart';
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

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    await ref.read(chatProvider.notifier).refresh();
    final contact = _selectedContact;
    if (contact != null) {
      await _loadMessages(contact);
    }
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

  Future<void> _sendMessage() async {
    final contact = _selectedContact;
    final text = _messageController.text.trim();
    if (contact == null || text.isEmpty || _sending) return;

    setState(() => _sending = true);
    _messageController.clear();
    try {
      await ref.read(chatRepositoryProvider).sendMessage(contact.id, text);
      await _loadMessages(contact);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to send message: $error')),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
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
        subtitle:
            'Contacts will appear here when staff and families are available.',
        icon: Icons.forum_outlined,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: contacts.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final contact = contacts[index];
        final selected = _selectedContact?.id == contact.id;
        return ListTile(
          selected: selected,
          selectedTileColor: ASchoolTheme.primary.withAlpha(20),
          leading: CircleAvatar(
            backgroundImage: contact.avatarUrl != null
                ? NetworkImage(contact.avatarUrl!)
                : null,
            child: contact.avatarUrl == null
                ? Text(_initials(contact.name))
                : null,
          ),
          title: Text(
            contact.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: Text(
            contact.lastMessage?.isNotEmpty == true
                ? contact.lastMessage!
                : _roleLabel(contact.role),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: contact.unreadCount > 0
              ? Container(
                  constraints:
                      const BoxConstraints(minWidth: 24, minHeight: 24),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: ASchoolTheme.primary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${contact.unreadCount}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                )
              : null,
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
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
          ),
          child: Row(
            children: [
              if (showBack)
                IconButton(
                  icon: const Icon(Icons.arrow_back_rounded),
                  onPressed: () => setState(() => _selectedContact = null),
                ),
              CircleAvatar(
                radius: 18,
                backgroundImage: contact.avatarUrl != null
                    ? NetworkImage(contact.avatarUrl!)
                    : null,
                child: contact.avatarUrl == null
                    ? Text(_initials(contact.name),
                        style: const TextStyle(fontSize: 12))
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      contact.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      _roleLabel(contact.role),
                      style:
                          TextStyle(color: Colors.grey.shade600, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _loadingMessages
              ? const LoadingShimmer()
              : _messages.isEmpty
                  ? const NoDataContainer(
                      title: 'No messages yet',
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
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              border: Border(top: BorderSide(color: Colors.grey.shade200)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    decoration: const InputDecoration(
                      hintText: 'Message',
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: 'Send',
                  onPressed: _sending ? null : _sendMessage,
                  icon: _sending
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded),
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
    final mine = currentUserId != null && currentUserId == message.senderId;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.74,
        ),
        decoration: BoxDecoration(
          color: mine ? ASchoolTheme.primary : Colors.grey.shade100,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(mine ? 16 : 4),
            bottomRight: Radius.circular(mine ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment:
              mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message.message,
              style: TextStyle(color: mine ? Colors.white : Colors.black87),
            ),
            const SizedBox(height: 4),
            Text(
              _formatTime(message.timestamp),
              style: TextStyle(
                color: mine ? Colors.white70 : Colors.grey.shade600,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first.substring(0, 1)}${parts.last.substring(0, 1)}'
        .toUpperCase();
  }

  String _roleLabel(String role) {
    return role
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
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
