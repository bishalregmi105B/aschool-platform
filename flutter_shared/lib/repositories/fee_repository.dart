import '../services/api_client.dart';
import '../models/models.dart';
import 'exceptions.dart';

class FeeRepository {
  Future<FeeDetails> getFeeDetails(String studentId) async {
    try {
      final response = await ApiClient.instance.get('/fees/student/$studentId');
      if (response.data['success'] == true) {
        return FeeDetails.fromJson(response.data['data']);
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch fee details');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }

  Future<bool> makePayment(String studentId, double amount, String method, String transactionId) async {
    try {
      final response = await ApiClient.instance.post('/fees/pay', data: {
        'student_id': studentId,
        'amount': amount,
        'payment_method': method,
        'transaction_id': transactionId,
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
        return (response.data['data'] as List)
            .map((e) => FeePayment.fromJson(e))
            .toList();
      }
      throw ApiException(response.data['error'] ?? 'Failed to fetch transactions');
    } catch (e) {
      throw ApiException(e.toString());
    }
  }
}
