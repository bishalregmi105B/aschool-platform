import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Unified social media inbox, post creation and boost (PluginGate: social_hub)
class SocialHubScreen extends ConsumerStatefulWidget {
  const SocialHubScreen({super.key});

  @override
  ConsumerState<SocialHubScreen> createState() => _SocialHubScreenState();
}

class _SocialHubScreenState extends ConsumerState<SocialHubScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _posts = [];
  List<Map<String, dynamic>> _groups = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/social/posts'),
        ApiClient.instance.get('/social/groups'),
      ]);
      setState(() {
        _posts = List<Map<String, dynamic>>.from(results[0].data['data'] ?? []);
        _groups =
            List<Map<String, dynamic>>.from(results[1].data['data'] ?? []);
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('SocialHubScreen load failed: $e\n$st');
      setState(() {
        _error = 'Could not load social hub.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return PluginGate(
      pluginSlug: 'social_hub',
      child: Column(
        children: [
          TabBar(controller: _tabCtrl, tabs: const [
            Tab(text: 'Posts'),
            Tab(text: 'Groups'),
          ]),
          Expanded(
            child: _loading
                ? const LoadingShimmer()
                : _error != null
                    ? ErrorContainer(errorMessage: _error!, onRetry: _load)
                    : TabBarView(controller: _tabCtrl, children: [
                        _buildPosts(),
                        _buildGroups(),
                      ]),
          ),
        ],
      ),
    );
  }

  Widget _buildPosts() {
    return RefreshIndicator(
      onRefresh: _load,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _showCreatePost,
                icon: const Icon(Icons.add),
                label: const Text('New Post'),
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _posts.length,
              itemBuilder: (_, i) => _postCard(_posts[i]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _postCard(Map<String, dynamic> post) {
    final platforms = List<String>.from(post['platforms'] ?? []);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              ...platforms.map((p) => Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: _platformIcon(p),
                  )),
              const Spacer(),
              Text((post['posted_at'] ?? '').isNotEmpty ? adToBsString(DateTime.tryParse(post['posted_at']!) ?? DateTime.now()) : '',
                  style: TextStyle(fontSize: 11, color: Colors.grey[500])),
            ]),
            const SizedBox(height: 10),
            Text(post['content'] ?? '',
                maxLines: 3, overflow: TextOverflow.ellipsis),
            if (post['image_url'] != null) ...[
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(post['image_url'],
                    height: 160, width: double.infinity, fit: BoxFit.cover),
              ),
            ],
            const SizedBox(height: 10),
            Row(children: [
              _engagementStat(Icons.favorite, '${post['likes'] ?? 0}'),
              const SizedBox(width: 16),
              _engagementStat(Icons.comment, '${post['comments'] ?? 0}'),
              const SizedBox(width: 16),
              _engagementStat(Icons.share, '${post['shares'] ?? 0}'),
              const Spacer(),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _engagementStat(IconData icon, String count) {
    return Row(children: [
      Icon(icon, size: 16, color: Colors.grey[500]),
      const SizedBox(width: 4),
      Text(count, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
    ]);
  }

  Widget _platformIcon(String platform) {
    IconData icon;
    Color color;
    switch (platform) {
      case 'facebook':
        icon = Icons.facebook;
        color = const Color(0xFF1877F2);
        break;
      case 'whatsapp':
        icon = Icons.chat;
        color = const Color(0xFF25D366);
        break;
      case 'viber':
        icon = Icons.phone_in_talk;
        color = const Color(0xFF7360F2);
        break;
      default:
        icon = Icons.language;
        color = Colors.grey;
    }
    return Icon(icon, size: 20, color: color);
  }

  Widget _buildGroups() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _groups.length,
        itemBuilder: (_, i) {
          final group = _groups[i];
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                  child:
                      Text((group['name'] ?? '?').toString().substring(0, 1))),
              title: Text(group['name'] ?? ''),
              subtitle: Text(group['description'] ?? '',
                  maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: Text('${group['member_count'] ?? 0} members',
                  style: TextStyle(fontSize: 12, color: Colors.grey[600])),
            ),
          );
        },
      ),
    );
  }

  void _showCreatePost() {
    final contentCtrl = TextEditingController();
    final selected = <String>{'facebook'};
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: StatefulBuilder(
          builder: (ctx, setS) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Create Post',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                children: ['facebook', 'whatsapp', 'viber', 'website']
                    .map((p) => FilterChip(
                          label: Text(p),
                          selected: selected.contains(p),
                          onSelected: (v) => setS(
                              () => v ? selected.add(p) : selected.remove(p)),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contentCtrl,
                maxLines: 5,
                decoration: const InputDecoration(
                  hintText: 'Write your post...',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    await ApiClient.instance.post('/social/posts', data: {
                      'content': contentCtrl.text,
                      'media_urls': const [],
                      'type': selected.length == 1 ? selected.first : 'text',
                    });
                    if (!mounted) return;
                    Navigator.pop(context);
                    await _load();
                  },
                  child: const Text('Publish'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
