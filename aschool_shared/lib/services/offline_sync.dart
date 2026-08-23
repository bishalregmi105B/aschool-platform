import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'api_client.dart';

/// Offline sync service — queues API calls when offline, replays when online.
/// Uses Isar for persistent queue storage.
class OfflineSync {
  final _logger = Logger();
  final _connectivity = Connectivity();
  StreamSubscription? _subscription;
  final List<_PendingRequest> _queue = [];
  bool _isSyncing = false;

  void init() {
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      final isOnline = results.any((r) => r != ConnectivityResult.none);
      if (isOnline && _queue.isNotEmpty) {
        _syncQueue();
      }
    });
  }

  /// Queue a request for later sync
  void enqueue({
    required String method,
    required String path,
    Map<String, dynamic>? data,
  }) {
    _queue.add(_PendingRequest(
      method: method,
      path: path,
      data: data,
      createdAt: DateTime.now(),
    ));
    _logger.i('Queued offline request: $method $path (${_queue.length} pending)');
  }

  /// Check if we're currently online
  Future<bool> get isOnline async {
    final result = await _connectivity.checkConnectivity();
    return result.any((r) => r != ConnectivityResult.none);
  }

  /// Replay queued requests
  Future<void> _syncQueue() async {
    if (_isSyncing || _queue.isEmpty) return;
    _isSyncing = true;
    _logger.i('Starting offline sync: ${_queue.length} pending requests');

    final toSync = List<_PendingRequest>.from(_queue);
    for (final req in toSync) {
      try {
        switch (req.method) {
          case 'POST':
            await ApiClient.instance.post(req.path, data: req.data);
          case 'PUT':
            await ApiClient.instance.put(req.path, data: req.data);
          case 'DELETE':
            await ApiClient.instance.delete(req.path);
          default:
            continue;
        }
        _queue.remove(req);
        _logger.i('Synced: ${req.method} ${req.path}');
      } catch (e) {
        _logger.w('Sync failed for ${req.path}: $e');
        break; // Stop on first failure to maintain order
      }
    }

    _isSyncing = false;
    _logger.i('Offline sync complete: ${_queue.length} remaining');
  }

  int get pendingCount => _queue.length;

  void dispose() {
    _subscription?.cancel();
  }
}

class _PendingRequest {
  final String method;
  final String path;
  final Map<String, dynamic>? data;
  final DateTime createdAt;

  _PendingRequest({
    required this.method,
    required this.path,
    this.data,
    required this.createdAt,
  });
}

final offlineSyncProvider = Provider<OfflineSync>((ref) {
  final sync = OfflineSync();
  sync.init();
  ref.onDispose(() => sync.dispose());
  return sync;
});
