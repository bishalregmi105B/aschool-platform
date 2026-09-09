import 'dart:async';

import '../services/api_client.dart';

/// Authoritative server clock for the Flutter apps — sibling of the web
/// dashboard's `useServerTime`. GET /meta/time is unauthenticated and cheap;
/// we poll every 60s and expose the server-derived time so app bars, dash-
/// boards and date pickers all tick from the same clock (a device with a
/// wrong date used to show wrong "today" and backdate submissions).
class ServerTimeService {
  static final ServerTimeService instance = ServerTimeService._();

  ServerTimeService._();

  Timer? _timer;
  Duration _offset = Duration.zero; // server epoch minus device epoch
  bool _synced = false;

  bool get isSynced => _synced;

  /// Server-derived "now".
  DateTime now() => DateTime.now().add(_offset);

  /// "YYYY-MM-DD" of today at the server (NPT).
  String get todayAd {
    final n = now();
    return '${n.year.toString().padLeft(4, '0')}-'
        '${n.month.toString().padLeft(2, '0')}-'
        '${n.day.toString().padLeft(2, '0')}';
  }

  /// "HH:mm" at the server (NPT).
  String get hhmm {
    final n = now();
    return '${n.hour.toString().padLeft(2, '0')}:${n.minute.toString().padLeft(2, '0')}';
  }

  void startSync() {
    if (_timer != null) return; // already running
    _sync();
    _timer = Timer.periodic(const Duration(minutes: 1), (_) => _sync());
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _sync() async {
    try {
      final res = await ApiClient.instance.get('/meta/time');
      final data = res.data is Map ? res.data['data'] ?? res.data : null;
      if (data is Map && data['epoch_ms'] is num) {
        final serverMs = (data['epoch_ms'] as num).toInt();
        _offset = DateTime.fromMillisecondsSinceEpoch(serverMs).difference(DateTime.now());
        _synced = true;
      }
    } catch (_) {
      // Offline / endpoint not deployed yet: keep device clock.
    }
  }
}
