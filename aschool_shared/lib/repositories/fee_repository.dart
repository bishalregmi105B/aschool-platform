import 'package:uuid/uuid.dart';
import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
import 'exceptions.dart';

class FeeRepository {
  static const _uuid = Uuid();

  Future<FeeDetails> getFeeDetails(String studentId) async {
    try {
      final response = await ApiClient.instance.get('/fees/student/$studentId');
      if (response.data['success'] == true) {
        return FeeDetails.fromJson(
            envelopeObject(response.data, source: 'FeeRepository.getFeeDetails') ??
                const {});
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch fee details'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  /// Record a manual payment with idempotency key to prevent duplicates.
  Future<bool> makePayment(
    String studentId,
    double amount,
    String method,
    String transactionId,
  ) async {
    try {
      final idempotencyKey = _uuid.v4();
      final response = await ApiClient.instance.post('/fees/pay', data: {
        'student_id': studentId,
        'amount': amount,
        'payment_method': method,
        'transaction_id': transactionId,
        'idempotency_key': idempotencyKey,
      });
      return response.data['success'] == true;
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<FeePayment>> getTransactions(String studentId) async {
    try {
      final response = await ApiClient.instance.get('/fees/transactions?student_id=$studentId');
      if (response.data['success'] == true) {
        return envelopeRows(response.data, source: 'FeeRepository.getTransactions')
            .map(FeePayment.fromJson)
            .toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch transactions'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  /// Initiate an online payment (eSewa, Khalti, FonePay).
  ///
  /// Returns a redirect URL to the payment gateway.
  Future<OnlinePaymentResult> initiateOnlinePayment({
    required String collectionId,
    required String provider,
    String? returnUrl,
  }) async {
    try {
      final response = await ApiClient.instance.post(
        '/fees/initiate-payment/$collectionId',
        data: {
          'provider': provider,
          if (returnUrl != null) 'return_url': returnUrl,
        },
      );
      if (response.data['success'] == true) {
        return OnlinePaymentResult.fromJson(
            envelopeObject(response.data, source: 'FeeRepository.initiateOnlinePayment') ??
                const {});
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to initiate payment'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  /// Get configured payment methods for the school.
  ///
  /// Throws [ApiException] so callers can distinguish "school has no online
  /// methods" from a failed request.
  Future<List<PaymentMethodConfig>> getPaymentMethods() async {
    try {
      final response = await ApiClient.instance.get('/fees/payment-methods');
      if (response.data['success'] == true) {
        final data = response.data['data'];
        return safeMapList(data is Map ? data['methods'] : null)
            .map(PaymentMethodConfig.fromJson)
            .toList();
      }
      return [];
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Failed to load payment methods: $e');
    }
  }
}

/// Result of initiating an online payment.
class OnlinePaymentResult {
  final String provider;
  final String? redirectUrl;
  final String? paymentUrl;
  final bool success;
  final Map<String, dynamic>? params;

  const OnlinePaymentResult({
    required this.provider,
    this.redirectUrl,
    this.paymentUrl,
    this.success = false,
    this.params,
  });

  factory OnlinePaymentResult.fromJson(Map<String, dynamic> json) {
    return OnlinePaymentResult(
      provider: safeString(json['provider']),
      redirectUrl: safeStringOrNull(json['redirect_url']),
      paymentUrl: safeStringOrNull(json['payment_url']),
      success: safeBool(json['success'], fallback: true),
      params: safeMapOrNull(json['params']),
    );
  }
}

/// Payment method configuration from the school.
class PaymentMethodConfig {
  final String key;
  final String label;
  final bool enabled;
  final String mode; // "online" or "offline"
  final bool requiresReference;
  final bool supportsQr;
  final String? qrImageUrl;
  final String? instructions;

  const PaymentMethodConfig({
    required this.key,
    required this.label,
    this.enabled = true,
    this.mode = 'offline',
    this.requiresReference = false,
    this.supportsQr = false,
    this.qrImageUrl,
    this.instructions,
  });

  factory PaymentMethodConfig.fromJson(Map<String, dynamic> json) {
    return PaymentMethodConfig(
      key: safeString(json['key']),
      label: safeString(json['label']),
      enabled: safeBool(json['enabled'], fallback: true),
      mode: safeString(json['mode'], fallback: 'offline'),
      requiresReference: safeBool(json['requires_reference']),
      supportsQr: safeBool(json['supports_qr']),
      qrImageUrl: safeStringOrNull(json['qr_image_url']),
      instructions: safeStringOrNull(json['instructions']),
    );
  }

  bool get isOnline => mode == 'online';
}
