import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/constants.dart';

/// Configured Dio HTTP client with auth interceptors
class ApiClient {
  static Dio? _instance;

  static Dio get instance {
    _instance ??= _createDio();
    return _instance!;
  }

  static Dio _createDio() {
    final dio = Dio(BaseOptions(
      baseUrl: AppConstants.baseUrl + AppConstants.apiVersion,
      connectTimeout: AppConstants.apiTimeout,
      receiveTimeout: AppConstants.apiTimeout,
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(_AuthInterceptor());
    return dio;
  }

  /// Override base URL (for dev/staging)
  static void setBaseUrl(String url) {
    instance.options.baseUrl = url + AppConstants.apiVersion;
  }

  /// Set school context header
  static void setSchoolSlug(String slug) {
    instance.options.headers['X-School-Slug'] = slug;
  }
}

class _AuthInterceptor extends Interceptor {
  static const _storage = FlutterSecureStorage();
  bool _isRefreshing = false;
  final List<Completer<String?>> _refreshQueue = [];

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.read(key: AppConstants.accessTokenKey);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode != 401) {
      return handler.next(err);
    }

    // Queue concurrent 401s; only one refresh flight runs at a time
    if (_isRefreshing) {
      final completer = Completer<String?>();
      _refreshQueue.add(completer);
      final newToken = await completer.future;
      if (newToken == null) {
        return handler.next(err);
      }
      err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
      final retry = await Dio(BaseOptions(baseUrl: ApiClient.instance.options.baseUrl))
          .fetch(err.requestOptions);
      return handler.resolve(retry);
    }

    _isRefreshing = true;
    String? newAccess;
    try {
      final refreshToken = await _storage.read(key: AppConstants.refreshTokenKey);
      if (refreshToken == null) {
        _isRefreshing = false;
        _drainQueue(null);
        return handler.next(err);
      }

      final dio = Dio(BaseOptions(baseUrl: ApiClient.instance.options.baseUrl));
      final response = await dio.post(
        '/auth/refresh',
        options: Options(headers: {'Authorization': 'Bearer $refreshToken'}),
      );

      if (response.statusCode == 200) {
        newAccess = response.data['data']['access_token'];
        final newRefresh = response.data['data']['refresh_token'];
        await _storage.write(key: AppConstants.accessTokenKey, value: newAccess);
        await _storage.write(key: AppConstants.refreshTokenKey, value: newRefresh);
      }
    } catch (_) {
      await _storage.deleteAll();
    }

    _isRefreshing = false;
    _drainQueue(newAccess);

    if (newAccess == null) {
      return handler.next(err);
    }
    err.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
    final retryResponse = await Dio(BaseOptions(baseUrl: ApiClient.instance.options.baseUrl))
        .fetch(err.requestOptions);
    return handler.resolve(retryResponse);
  }

  void _drainQueue(String? token) {
    for (final c in _refreshQueue) {
      c.complete(token);
    }
    _refreshQueue.clear();
  }
}
