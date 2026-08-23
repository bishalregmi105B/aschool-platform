import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:logger/logger.dart';
import '../utils/constants.dart';

/// Socket.IO service for real-time events
class SocketService {
  static SocketService? _instance;
  static final _logger = Logger();
  io.Socket? _socket;

  SocketService._();

  static SocketService get instance {
    _instance ??= SocketService._();
    return _instance!;
  }

  bool get isConnected => _socket?.connected ?? false;

  /// Connect with auth token
  void connect(String token, {String? schoolSlug}) {
    _socket?.dispose();
    _socket = io.io(
      AppConstants.baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .setQuery({'school': schoolSlug ?? ''})
          .enableAutoConnect()
          .enableReconnection()
          .build(),
    );

    _socket!.onConnect((_) => _logger.i('Socket connected'));
    _socket!.onDisconnect((_) => _logger.w('Socket disconnected'));
    _socket!.onError((err) => _logger.e('Socket error: $err'));
  }

  /// Listen to an event
  void on(String event, Function(dynamic) callback) {
    _socket?.on(event, callback);
  }

  /// Remove listener
  void off(String event) {
    _socket?.off(event);
  }

  /// Emit an event
  void emit(String event, [dynamic data]) {
    _socket?.emit(event, data);
  }

  /// Join a school room for scoped events
  void joinSchool(String schoolId) {
    _socket?.emit('join_school', {'school_id': schoolId});
  }

  /// Disconnect and clean up
  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }
}
