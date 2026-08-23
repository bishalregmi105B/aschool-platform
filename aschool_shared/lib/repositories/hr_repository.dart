import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class HrRepository {
  Future<List<PayrollSlip>> getPayslips() async {
    try {
      final response = await ApiClient.instance.get('/hr-payroll/payslips');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => PayrollSlip.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch payslips');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<List<LeaveRequest>> getLeaveRequests() async {
    try {
      final response = await ApiClient.instance.get('/hr-payroll/leaves');
      if (response.data['success'] == true) {
        return (response.data['data'] as List)
            .map((e) => LeaveRequest.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch leave requests');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<bool> applyLeave(String type, String startDate, String endDate, String reason) async {
    try {
      final response = await ApiClient.instance.post('/hr-payroll/leaves/apply', data: {
        'leave_type': type,
        'start_date': startDate,
        'end_date': endDate,
        'reason': reason,
      });
      return response.data['success'] == true;
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
