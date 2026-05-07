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
    if (err.response?.statusCode == 401 && !_isRefreshing) {
      _isRefreshing = true;
      try {
        final refreshToken =
            await _storage.read(key: AppConstants.refreshTokenKey);
        if (refreshToken == null) {
          _isRefreshing = false;
          return handler.next(err);
        }

        final dio = Dio(BaseOptions(
          baseUrl: ApiClient.instance.options.baseUrl,
        ));
        final response = await dio.post(
          '/auth/refresh',
          data: {'refresh_token': refreshToken},
        );

        if (response.statusCode == 200) {
          final newAccess = response.data['data']['access_token'];
          final newRefresh = response.data['data']['refresh_token'];

          await _storage.write(
              key: AppConstants.accessTokenKey, value: newAccess);
          await _storage.write(
              key: AppConstants.refreshTokenKey, value: newRefresh);

          // Retry original request
          err.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
          final retryResponse = await dio.fetch(err.requestOptions);
          _isRefreshing = false;
          return handler.resolve(retryResponse);
        }
      } catch (_) {
        // Refresh failed — force logout
        await _storage.deleteAll();
      }
      _isRefreshing = false;
    }
    handler.next(err);
  }
}
