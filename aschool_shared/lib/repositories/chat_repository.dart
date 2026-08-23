import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class ChatRepository {
  Future<List<ChatContact>> getContacts() async {
    try {
      final response = await ApiClient.instance.get('/communications/contacts');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => ChatContact.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch contacts');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<ChatMessage>> getMessages(String userId) async {
    try {
      final response = await ApiClient.instance.get('/communications/messages/$userId');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => ChatMessage.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch messages');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<bool> sendMessage(String receiverId, String message, {String? fileUrl, String? fileType}) async {
    try {
      final response = await ApiClient.instance.post('/communications/send', data: {
        'receiver_id': receiverId,
        'message': message,
        if (fileUrl != null) 'file_url': fileUrl,
        if (fileType != null) 'file_type': fileType,
      });
      return response.data['success'] == true;
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
