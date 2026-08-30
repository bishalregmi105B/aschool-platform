import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
import 'exceptions.dart';

class ChatRepository {
  Future<List<ChatContact>> getContacts() async {
    try {
      final response = await ApiClient.instance.get('/communications/contacts');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'ChatRepository.getContacts')
            .map(ChatContact.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch contacts'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  Future<List<ChatMessage>> getMessages(String userId) async {
    try {
      final response = await ApiClient.instance.get('/communications/messages/$userId');
      if (envelopeOk(response.data)) {
        return envelopeRows(response.data, source: 'ChatRepository.getMessages')
            .map(ChatMessage.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch messages'));
    } catch (e) {
      if (e is ApiException) rethrow;
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
