import 'package:dio/dio.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import 'exceptions.dart';

/// HR / payroll repository.
///
/// Backend routes live under the `/hr` blueprint prefix
/// (`backend/app/api/v1/hr_payroll.py`, `url_prefix="/hr"`) — there is no
/// `/hr-payroll/*` namespace.
class HrRepository {
  /// GET /hr/payroll — list payroll records.
  /// Server-side restricted to superadmin/school_admin/accountant; other
  /// roles get a 403 [ApiException].
  Future<List<PayrollSlip>> getPayslips() async {
    try {
      final response = await ApiClient.instance.get('/hr/payroll');
      return _slipsFromResponse(response.data);
    } on DioException catch (e) {
      throw _fromDio(e, 'Failed to fetch payslips');
    }
  }

  /// GET /hr/leaves — list staff leave requests (any school member with the
  /// hr_payroll plugin installed).
  Future<List<LeaveRequest>> getLeaveRequests() async {
    try {
      final response = await ApiClient.instance.get('/hr/leaves');
      return _dataList(response.data, 'Failed to fetch leave requests')
          .map(LeaveRequest.fromJson)
          .toList();
    } on DioException catch (e) {
      throw _fromDio(e, 'Failed to fetch leave requests');
    }
  }

  /// POST /hr/leave — apply for leave. `user_id` defaults to the caller's
  /// own id server-side when omitted.
  Future<bool> applyLeave(
      String type, String startDate, String endDate, String reason) async {
    try {
      final response = await ApiClient.instance.post('/hr/leave', data: {
        'leave_type': type,
        'start_date': startDate,
        'end_date': endDate,
        'reason': reason,
      });
      return response.data['success'] == true;
    } on DioException catch (e) {
      throw _fromDio(e, 'Failed to apply for leave');
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────

  /// Backend envelope: {"success": bool, "data": ..., "error": ...}.
  List<Map<String, dynamic>> _dataList(dynamic payload, String fallback) {
    if (payload is! Map) throw ApiException(fallback);
    if (payload['success'] != true) {
      throw ApiException(
          payload['error']?.toString() ?? fallback);
    }
    final data = payload['data'];
    if (data is! List) throw ApiException(fallback);
    return data
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  List<PayrollSlip> _slipsFromResponse(dynamic payload) {
    return _dataList(payload, 'Failed to fetch payslips')
        .map(PayrollSlip.fromJson)
        .toList();
  }

  ApiException _fromDio(DioException e, String fallback) {
    final data = e.response?.data;
    final message = (data is Map && data['error'] != null)
        ? data['error'].toString()
        : fallback;
    return ApiException(message, statusCode: e.response?.statusCode);
  }
}
