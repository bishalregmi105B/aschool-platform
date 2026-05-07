import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'repository_providers.dart';

class ChatData {
  final List<ChatContact> contacts;

  const ChatData({
    this.contacts = const [],
  });
}

class ChatNotifier extends AutoDisposeAsyncNotifier<ChatData> {
  @override
  Future<ChatData> build() async {
    return _fetchData();
  }

  Future<ChatData> _fetchData() async {
    final repo = ref.read(chatRepositoryProvider);
    final contacts = await repo.getContacts();

    return ChatData(
      contacts: contacts,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }
}

final chatProvider = AsyncNotifierProvider.autoDispose<ChatNotifier, ChatData>(() {
  return ChatNotifier();
});
