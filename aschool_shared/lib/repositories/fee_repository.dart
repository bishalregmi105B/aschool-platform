import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';
import '../services/api_client.dart';
import '../models/models.dart';
import '../utils/safe_parse.dart';
import 'exceptions.dart';

class FeeRepository {
  static const _uuid = Uuid();

  /// Fee statement for a student — maps `GET /student/fees` (student domain):
  /// `{overview: {total_fees, paid, due}, invoices: [...]}`.
  Future<FeeDetails> getFeeDetails(String studentId) async {
    try {
      final response = await ApiClient.instance.get('/student/fees');
      if (response.data['success'] == true) {
        final body =
            envelopeObject(response.data, source: 'FeeRepository.getFeeDetails') ??
                const {};
        final overview = (body['overview'] as Map?) ?? const {};
        return FeeDetails.fromJson({
          'total_fees': overview['total_fees'],
          'paid_amount': overview['paid'],
          'due_amount': overview['due'],
          'items': body['invoices'],
        });
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to fetch fee details'));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  /// Record a manual payment against a fee collection (admin/accountant).
  /// `POST /fees/collections/<id>/pay` with an idempotency key to prevent
  /// duplicates on network retries or double-clicks.
  Future<bool> recordCollectionPayment({
    required String collectionId,
    required double amount,
    required String method,
    String? transactionId,
    String? paymentDate,
  }) async {
    try {
      final response = await ApiClient.instance
          .post('/fees/collections/$collectionId/pay', data: {
        'amount': amount,
        'payment_method': method,
        if (transactionId != null) 'transaction_id': transactionId,
        if (paymentDate != null) 'payment_date': paymentDate,
        'idempotency_key': _uuid.v4(),
      });
      return response.data['success'] == true;
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  /// Payment history for a student — `GET /fees/collections?student_id=`.
  Future<List<FeePayment>> getTransactions(String studentId) async {
    try {
      final response = await ApiClient.instance.get(
        '/fees/collections',
        queryParameters: {'student_id': studentId},
      );
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
        '/fees/initiate-payment',
        data: {
          'fee_ids': [collectionId],
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

  /// Submit a bank-transfer / cheque slip for office review —
  /// `POST /fees/offline-submissions`. Money is NOT applied here; the
  /// returned submission starts in `pending` status until an admin approves.
  Future<OfflineSubmission> createOfflineSubmission({
    required String studentId,
    required double amount,
    required String method, // "bank" | "cheque"
    String? bankName,
    String? referenceNo,
    String? paidOnBs, // "YYYY-MM-DD" (BS)
    String? slipFileId,
    List<String> collectionIds = const [],
  }) async {
    try {
      final response = await ApiClient.instance.post(
        '/fees/offline-submissions',
        data: {
          'student_id': studentId,
          'amount': amount,
          'method': method,
          if (bankName != null && bankName.isNotEmpty) 'bank_name': bankName,
          if (referenceNo != null && referenceNo.isNotEmpty) 'reference_no': referenceNo,
          if (paidOnBs != null && paidOnBs.isNotEmpty) 'paid_on_bs': paidOnBs,
          if (slipFileId != null && slipFileId.isNotEmpty) 'slip_file_id': slipFileId,
          'collection_ids': collectionIds,
        },
      );
      if (response.data['success'] == true) {
        return OfflineSubmission.fromJson(
          envelopeObject(response.data, source: 'FeeRepository.createOfflineSubmission') ??
              const {},
        );
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to submit the deposit slip'));
    } catch (e) {
      throw _apiError(e, 'Failed to submit the deposit slip');
    }
  }

  /// The caller's own offline submissions —
  /// `GET /fees/offline-submissions?status=&page=` (parents/students see
  /// only their own; admins see everything).
  Future<List<OfflineSubmission>> listOfflineSubmissions({String? status, int page = 1}) async {
    try {
      final response = await ApiClient.instance.get(
        '/fees/offline-submissions',
        queryParameters: {
          if (status != null && status.isNotEmpty) 'status': status,
          'page': page,
        },
      );
      if (response.data['success'] == true) {
        final body =
            envelopeObject(response.data, source: 'FeeRepository.listOfflineSubmissions') ??
                const {};
        return safeMapList(body['submissions']).map(OfflineSubmission.fromJson).toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to load submissions'));
    } catch (e) {
      throw _apiError(e, 'Failed to load submissions');
    }
  }

  /// Per-student fee invoices — `GET /fees/invoices?student_id=&page=`.
  Future<List<FeeInvoice>> listInvoices({String? studentId, String? status, int page = 1}) async {
    try {
      final response = await ApiClient.instance.get(
        '/fees/invoices',
        queryParameters: {
          if (studentId != null && studentId.isNotEmpty) 'student_id': studentId,
          if (status != null && status.isNotEmpty) 'status': status,
          'page': page,
        },
      );
      if (response.data['success'] == true) {
        final body = envelopeObject(response.data, source: 'FeeRepository.listInvoices') ?? const {};
        return safeMapList(body['invoices']).map(FeeInvoice.fromJson).toList();
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to load invoices'));
    } catch (e) {
      throw _apiError(e, 'Failed to load invoices');
    }
  }

  /// A single invoice with its bill lines — `GET /fees/invoices/<id>`.
  Future<FeeInvoice> getInvoice(String invoiceId) async {
    try {
      final response = await ApiClient.instance.get('/fees/invoices/$invoiceId');
      if (response.data['success'] == true) {
        final body = envelopeObject(response.data, source: 'FeeRepository.getInvoice') ?? const {};
        return FeeInvoice.fromJson(safeMap(body['invoice']));
      }
      throw ApiException(envelopeErrorText(response.data, 'Failed to load invoice'));
    } catch (e) {
      throw _apiError(e, 'Failed to load invoice');
    }
  }

  /// Student "ask parents to pay" nudge —
  /// `POST /fees/students/<id>/nudge-parent`. Throws [ApiException] carrying
  /// the server message (e.g. 409 "No outstanding fees ..." or "No guardian
  /// accounts are linked ...") so screens can show a friendly hint.
  Future<FeeNudgeResult> nudgeParent(String studentId) async {
    try {
      final response = await ApiClient.instance.post('/fees/students/$studentId/nudge-parent');
      if (response.data['success'] == true) {
        return FeeNudgeResult.fromJson(
          envelopeObject(response.data, source: 'FeeRepository.nudgeParent') ?? const {},
        );
      }
      throw ApiException(envelopeErrorText(response.data, 'Could not notify guardians'));
    } catch (e) {
      throw _apiError(e, 'Could not notify guardians');
    }
  }

  /// Maps an HTTP failure to an [ApiException], preferring the backend
  /// `error` text (e.g. "method must be bank or cheque") over the raw
  /// DioException dump so screens can surface the server's message directly.
  ApiException _apiError(Object e, String fallback) {
    if (e is ApiException) return e;
    if (e is DioException) {
      final data = e.response?.data;
      final message =
          (data is Map && data['error'] != null) ? data['error'].toString() : fallback;
      return ApiException(message, statusCode: e.response?.statusCode);
    }
    return ApiException(e.toString());
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
