/// Fee models — maps to backend fee.py
import '../utils/safe_parse.dart';

class FeeType {
  final String id;
  final String name;
  final String? description;
  final double amount;
  final bool isOptional;

  const FeeType({required this.id, required this.name, this.description, this.amount = 0, this.isOptional = false});

  factory FeeType.fromJson(Map<String, dynamic> json) => FeeType(
    id: safeString(json['id']),
    name: safeString(json['name']),
    description: safeStringOrNull(json['description']),
    amount: safeDouble(json['amount']),
    isOptional: safeBool(json['is_optional']),
  );
}

class FeeDetails {
  final double totalFees;
  final double paidAmount;
  final double dueAmount;
  final List<FeeLineItem> items;
  final List<FeePayment> payments;

  const FeeDetails({this.totalFees = 0, this.paidAmount = 0, this.dueAmount = 0, this.items = const [], this.payments = const []});
  double get percentPaid => totalFees > 0 ? (paidAmount / totalFees) * 100 : 0;

  factory FeeDetails.fromJson(Map<String, dynamic> json) => FeeDetails(
    totalFees: safeDouble(json['total_fees']),
    paidAmount: safeDouble(json['paid_amount']),
    dueAmount: safeDouble(json['due_amount']),
    items: safeMapList(json['items']).map(FeeLineItem.fromJson).toList(),
    payments: safeMapList(json['payments']).map(FeePayment.fromJson).toList(),
  );
}

class FeeLineItem {
  final String id;
  final String name;
  final double amount;
  final double paidAmount;
  final bool isOptional;
  final String? status;

  const FeeLineItem({required this.id, required this.name, this.amount = 0, this.paidAmount = 0, this.isOptional = false, this.status});

  factory FeeLineItem.fromJson(Map<String, dynamic> json) => FeeLineItem(
    id: safeString(json['id']),
    name: safeString(json['name']),
    amount: safeDouble(json['amount']),
    paidAmount: safeDouble(json['paid_amount']),
    isOptional: safeBool(json['is_optional']),
    status: safeStringOrNull(json['status']),
  );
}

class FeePayment {
  final String id;
  final double amount;
  final String? paymentMethod;
  final String? transactionId;
  final String? paidDate;
  final String? status;
  final String? receiptUrl;

  const FeePayment({required this.id, this.amount = 0, this.paymentMethod, this.transactionId, this.paidDate, this.status, this.receiptUrl});

  factory FeePayment.fromJson(Map<String, dynamic> json) => FeePayment(
    id: safeString(json['id']),
    amount: safeDouble(json['amount']),
    paymentMethod: safeStringOrNull(json['payment_method']),
    transactionId: safeStringOrNull(json['transaction_id']),
    paidDate: safeStringOrNull(json['paid_date']),
    status: safeStringOrNull(json['status']),
    receiptUrl: safeStringOrNull(json['receipt_url']),
  );
}
