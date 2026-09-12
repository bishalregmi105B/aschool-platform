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

/// Offline bank-slip / cheque submission awaiting office approval (S-A1).
/// Money is NOT applied until an admin approves the slip.
class OfflineSubmission {
  final String id;
  final String studentId;
  final String? studentName;
  final double amount;
  final String method; // "bank" | "cheque"
  final String? bankName;
  final String? referenceNo;
  final String? paidOnBs; // "YYYY-MM-DD" (BS)
  final String? slipFileId;
  final List<String> collectionIds;
  final String status; // pending | approved | rejected
  final String? reviewNotes;
  final List<String> receiptIds;
  final String? createdAt;
  final String? reviewedAt;

  const OfflineSubmission({
    required this.id,
    required this.studentId,
    this.studentName,
    this.amount = 0,
    this.method = 'bank',
    this.bankName,
    this.referenceNo,
    this.paidOnBs,
    this.slipFileId,
    this.collectionIds = const [],
    this.status = 'pending',
    this.reviewNotes,
    this.receiptIds = const [],
    this.createdAt,
    this.reviewedAt,
  });

  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';

  factory OfflineSubmission.fromJson(Map<String, dynamic> json) => OfflineSubmission(
    id: safeString(json['id']),
    studentId: safeString(json['student_id']),
    studentName: safeStringOrNull(json['student_name']),
    amount: safeDouble(json['amount']),
    method: safeString(json['method'], fallback: 'bank'),
    bankName: safeStringOrNull(json['bank_name']),
    referenceNo: safeStringOrNull(json['reference_no']),
    paidOnBs: safeStringOrNull(json['paid_on_bs']),
    slipFileId: safeStringOrNull(json['slip_file_id']),
    collectionIds: safeStringList(json['collection_ids']),
    status: safeString(json['status'], fallback: 'pending'),
    reviewNotes: safeStringOrNull(json['review_notes']),
    receiptIds: safeStringList(json['receipt_ids']),
    createdAt: safeStringOrNull(json['created_at']),
    reviewedAt: safeStringOrNull(json['reviewed_at']),
  );
}

/// One bill line of a fee invoice (maps a FeeCollection row).
class FeeInvoiceLine {
  final String id;
  final String? feeType;
  final double netAmount;
  final double paidAmount;
  final double dueAmount;
  final String? status; // pending | partial | paid | waived | refunded
  final String? dueDate;
  final String? receiptNumber;
  final String? receiptUrl; // PDF download path (needs auth header)

  const FeeInvoiceLine({
    required this.id,
    this.feeType,
    this.netAmount = 0,
    this.paidAmount = 0,
    this.dueAmount = 0,
    this.status,
    this.dueDate,
    this.receiptNumber,
    this.receiptUrl,
  });

  bool get hasReceipt => (receiptUrl ?? '').isNotEmpty;

  factory FeeInvoiceLine.fromJson(Map<String, dynamic> json) => FeeInvoiceLine(
    id: safeString(json['id']),
    feeType: safeStringOrNull(json['fee_type']),
    netAmount: safeDouble(json['net_amount']),
    paidAmount: safeDouble(json['paid_amount']),
    dueAmount: safeDouble(json['due_amount']),
    status: safeStringOrNull(json['status']),
    dueDate: safeStringOrNull(json['due_date']),
    receiptNumber: safeStringOrNull(json['receipt_number']),
    receiptUrl: safeStringOrNull(json['receipt_url']),
  );
}

/// Per-student fee invoice (grouped bill lines).
class FeeInvoice {
  final String id;
  final String title;
  final String? studentId;
  final String? studentName;
  final String? academicYear;
  final String? periodKey;
  final String? dueDateBs;
  final String? status; // pending | partial | paid | waived
  final double totalAmount;
  final double paidAmount;
  final double dueAmount;
  final int lineCount;
  final String? notes;
  final List<FeeInvoiceLine> lines;

  const FeeInvoice({
    required this.id,
    required this.title,
    this.studentId,
    this.studentName,
    this.academicYear,
    this.periodKey,
    this.dueDateBs,
    this.status,
    this.totalAmount = 0,
    this.paidAmount = 0,
    this.dueAmount = 0,
    this.lineCount = 0,
    this.notes,
    this.lines = const [],
  });

  bool get isPaid => status == 'paid';
  bool get isWaived => status == 'waived';

  factory FeeInvoice.fromJson(Map<String, dynamic> json) => FeeInvoice(
    id: safeString(json['id']),
    title: safeString(json['title'], fallback: 'Invoice'),
    studentId: safeStringOrNull(json['student_id']),
    studentName: safeStringOrNull(json['student_name']),
    academicYear: safeStringOrNull(json['academic_year']),
    periodKey: safeStringOrNull(json['period_key']),
    dueDateBs: safeStringOrNull(json['due_date_bs']),
    status: safeStringOrNull(json['status']),
    totalAmount: safeDouble(json['total_amount']),
    paidAmount: safeDouble(json['paid_amount']),
    dueAmount: safeDouble(json['due_amount']),
    lineCount: safeInt(json['line_count']),
    notes: safeStringOrNull(json['notes']),
    lines: safeMapList(json['lines']).map(FeeInvoiceLine.fromJson).toList(),
  );
}

/// Result of the student "ask parents to pay" nudge.
class FeeNudgeResult {
  final int notified;
  final double outstanding;

  const FeeNudgeResult({this.notified = 0, this.outstanding = 0});

  factory FeeNudgeResult.fromJson(Map<String, dynamic> json) => FeeNudgeResult(
    notified: safeInt(json['notified']),
    outstanding: safeDouble(json['outstanding']),
  );
}
