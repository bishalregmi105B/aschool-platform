import 'package:dio/dio.dart';
import 'package:intl/intl.dart';

import 'api_client.dart';

class NoticesService {
  static List<Map<String, dynamic>> _extractList(Response<dynamic> response) {
    final payload = response.data;
    if (payload is! Map<String, dynamic>) {
      return const [];
    }
    final raw = payload['data'];
    if (raw is! List) {
      return const [];
    }
    return raw
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  static String formatNoticeDate(Map<String, dynamic> notice) {
    final raw = notice['published_at'] ?? notice['created_at'];
    if (raw == null) {
      return '';
    }
    try {
      final dt = DateTime.parse(raw.toString()).toLocal();
      return DateFormat('MMM d, yyyy • h:mm a').format(dt);
    } catch (_) {
      return raw.toString();
    }
  }

  static Future<List<Map<String, dynamic>>> fetchNotices({
    String? targetRole,
    bool isPublished = true,
  }) async {
    final params = <String, dynamic>{
      'per_page': 100,
      'is_published': isPublished.toString(),
    };
    if (targetRole != null && targetRole.isNotEmpty) {
      params['target_role'] = targetRole;
    }

    final response =
        await ApiClient.instance.get('/notices', queryParameters: params);
    final list = _extractList(response);

    return list.map((item) {
      final normalized = Map<String, dynamic>.from(item);
      normalized['author'] = item['author_name'];
      normalized['date'] = formatNoticeDate(item);
      final noticeType = (item['notice_type'] ?? '').toString().toLowerCase();
      normalized['priority'] =
          (item['is_pinned'] == true || noticeType == 'urgent')
              ? 'urgent'
              : 'normal';
      return normalized;
    }).toList();
  }

  static Future<void> createNotice({
    required String title,
    required String content,
    List<String> targetRoles = const [
      'school_admin',
      'teacher',
      'parent',
      'student'
    ],
    bool isPinned = false,
    bool isPublished = true,
    String noticeType = 'general',
  }) async {
    await ApiClient.instance.post(
      '/notices',
      data: {
        'title': title,
        'content': content,
        'target_roles': targetRoles,
        'is_pinned': isPinned,
        'is_published': isPublished,
        'notice_type': noticeType,
      },
    );
  }
}
