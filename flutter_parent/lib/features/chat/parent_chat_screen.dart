import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Parent-teacher chat interface
class ParentChatScreen extends ConsumerStatefulWidget {
  const ParentChatScreen({super.key});

  @override
  ConsumerState<ParentChatScreen> createState() => _ParentChatScreenState();
}

class _ParentChatScreenState extends ConsumerState<ParentChatScreen> {
  List<Map<String, dynamic>> _threads = [];
  bool _loading = true;
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
      final resp = await ApiClient.instance.get('/parent/chat-threads');
      setState(() {
        _threads = List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('ParentChatScreen loadThreads failed: $e\n$st');
      setState(() {
        _error = 'Could not load conversations.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();
    if (_error != null) {
      return ErrorContainer(errorMessage: _error!, onRetry: _load);
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: _threads.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 120),
                NoDataContainer(
                  title: 'No conversations yet',
                  subtitle: 'Your chats with teachers will appear here.',
                  icon: Icons.chat_bubble_outline_rounded,
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _threads.length,
              itemBuilder: (_, i) => ESchoolAnimatedEntry(
                index: i,
                child: _threadTile(_threads[i]),
              ),
            ),
    );
  }

  Widget _threadTile(Map<String, dynamic> t) {
    final unread = t['unread_count'] ?? 0;
    return ESchoolCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: EdgeInsets.zero,
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: ASchoolTheme.primary.withAlpha(14),
          child: Text(
            (t['teacher_name'] ?? '?')[0],
            style: const TextStyle(
              color: ASchoolTheme.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        title: Text(t['teacher_name'] ?? ''),
        subtitle: Text(
          t['last_message'] ?? '',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              t['time'] ?? '',
              style:
                  const TextStyle(fontSize: 11, color: ASchoolTheme.mutedText),
            ),
            if (unread > 0)
              Container(
                margin: const EdgeInsets.only(top: 4),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: ASchoolTheme.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$unread',
                  style: const TextStyle(color: Colors.white, fontSize: 11),
                ),
              ),
          ],
        ),
        onTap: () => _openChat(t),
      ),
    );
  }

  void _openChat(Map<String, dynamic> thread) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _ChatDetailScreen(
          threadId: thread['id']?.toString() ?? '',
          teacherName: thread['teacher_name'] ?? '',
        ),
      ),
    );
  }
}

class _ChatDetailScreen extends ConsumerStatefulWidget {
  final String threadId;
  final String teacherName;
  const _ChatDetailScreen({required this.threadId, required this.teacherName});

  @override
  ConsumerState<_ChatDetailScreen> createState() => _ChatDetailState();
}

class _ChatDetailState extends ConsumerState<_ChatDetailScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
    // Listen for real-time messages
    SocketService.instance.on('chat:message', (data) {
      if (data['thread_id']?.toString() == widget.threadId) {
        setState(() => _messages.add(Map<String, dynamic>.from(data)));
        _scrollToBottom();
      }
    });
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    SocketService.instance.off('chat:message');
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final resp = await ApiClient.instance
          .get('/parent/chat/${widget.threadId}/messages');
      setState(() {
        _messages = List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
        _loading = false;
      });
      _scrollToBottom();
    } catch (e, st) {
      debugPrint('ParentChatScreen loadMessages failed: $e\n$st');
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Could not load messages. Pull to retry.')));
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _send() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;
    _msgCtrl.clear();
    // Optimistic add
    final pending = {
      'content': text,
      'is_mine': true,
      'time': 'Just now',
    };
    setState(() => _messages.add(pending));
    _scrollToBottom();
    try {
      await ApiClient.instance
          .post('/parent/chat/${widget.threadId}/messages', data: {
        'content': text,
      });
    } catch (e, st) {
      debugPrint('ParentChatScreen send failed: $e\n$st');
      // Roll back the optimistic bubble so the failure is visible.
      if (mounted) {
        setState(() => _messages.remove(pending));
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Message not sent. Please try again.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(title: widget.teacherName),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const LoadingShimmer()
                : ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) => _msgBubble(_messages[i]),
                  ),
          ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withAlpha(5),
                    blurRadius: 8,
                    offset: const Offset(0, -2)),
              ],
            ),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _msgCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Type a message...',
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: _send,
                icon: const Icon(Icons.send),
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _msgBubble(Map<String, dynamic> msg) {
    final mine = msg['is_mine'] == true;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: mine ? ASchoolTheme.primary : Colors.grey[100],
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(mine ? 16 : 0),
            bottomRight: Radius.circular(mine ? 0 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(msg['content'] ?? '',
                style: TextStyle(color: mine ? Colors.white : Colors.black87)),
            const SizedBox(height: 2),
            Text(msg['time'] ?? '',
                style: TextStyle(
                    fontSize: 10,
                    color: mine ? Colors.white70 : Colors.grey[500])),
          ],
        ),
      ),
    );
  }
}
