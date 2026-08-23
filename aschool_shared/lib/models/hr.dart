/// HR Models

class PayrollSlip {
  final String id;
  final String userId;
  final String? month;
  final String? year;
  final double basicSalary;
  final double totalAllowances;
  final double totalDeductions;
  final double netSalary;
  final String? status; // paid, pending
  final String? paymentDate;

  const PayrollSlip({
    required this.id,
    required this.userId,
    this.month,
    this.year,
    this.basicSalary = 0,
    this.totalAllowances = 0,
    this.totalDeductions = 0,
    this.netSalary = 0,
    this.status,
    this.paymentDate,
  });

  factory PayrollSlip.fromJson(Map<String, dynamic> json) {
    return PayrollSlip(
      id: json['id'] as String,
      userId: json['user_id']?.toString() ?? '',
      month: json['month'] as String?,
      year: json['year']?.toString(),
      basicSalary: (json['basic_salary'] as num?)?.toDouble() ?? 0,
      totalAllowances: (json['total_allowances'] as num?)?.toDouble() ?? 0,
      totalDeductions: (json['total_deductions'] as num?)?.toDouble() ?? 0,
      netSalary: (json['net_salary'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String?,
      paymentDate: json['payment_date'] as String?,
    );
  }
}

class LeaveRequest {
  final String id;
  final String userId;
  final String? leaveType;
  final String startDate;
  final String endDate;
  final String? reason;
  final String status; // pending, approved, rejected
  final String? approvedById;
  final String? remarks;

  const LeaveRequest({
    required this.id,
    required this.userId,
    this.leaveType,
    required this.startDate,
    required this.endDate,
    this.reason,
    this.status = 'pending',
    this.approvedById,
    this.remarks,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'] as String,
      userId: json['user_id']?.toString() ?? '',
      leaveType: json['leave_type'] as String?,
      startDate: json['start_date'] as String? ?? '',
      endDate: json['end_date'] as String? ?? '',
      reason: json['reason'] as String?,
      status: json['status'] as String? ?? 'pending',
      approvedById: json['approved_by_id']?.toString(),
      remarks: json['remarks'] as String?,
    );
  }
}
