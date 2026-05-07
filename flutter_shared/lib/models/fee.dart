/// Fee models — maps to backend fee.py
class FeeType {
  final String id;
  final String name;
  final String? description;
  final double amount;
  final bool isOptional;

  const FeeType({required this.id, required this.name, this.description, this.amount = 0, this.isOptional = false});

  factory FeeType.fromJson(Map<String, dynamic> json) => FeeType(
    id: json['id'] as String, name: json['name'] as String? ?? '',
    description: json['description'] as String?,
    amount: (json['amount'] as num?)?.toDouble() ?? 0,
    isOptional: json['is_optional'] as bool? ?? false,
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
    totalFees: (json['total_fees'] as num?)?.toDouble() ?? 0,
    paidAmount: (json['paid_amount'] as num?)?.toDouble() ?? 0,
    dueAmount: (json['due_amount'] as num?)?.toDouble() ?? 0,
    items: ((json['items'] ?? []) as List).map((i) => FeeLineItem.fromJson(Map<String, dynamic>.from(i))).toList(),
    payments: ((json['payments'] ?? []) as List).map((p) => FeePayment.fromJson(Map<String, dynamic>.from(p))).toList(),
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
    id: json['id'] as String, name: json['name'] as String? ?? '',
    amount: (json['amount'] as num?)?.toDouble() ?? 0,
    paidAmount: (json['paid_amount'] as num?)?.toDouble() ?? 0,
    isOptional: json['is_optional'] as bool? ?? false,
    status: json['status'] as String?,
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
    id: json['id'] as String, amount: (json['amount'] as num?)?.toDouble() ?? 0,
    paymentMethod: json['payment_method'] as String?,
    transactionId: json['transaction_id'] as String?,
    paidDate: json['paid_date'] as String?,
    status: json['status'] as String?,
    receiptUrl: json['receipt_url'] as String?,
  );
}
