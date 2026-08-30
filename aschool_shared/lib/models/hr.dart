/// HR Models

/// Coerce a JSON value (int, double, numeric string, null) to double.
double _num(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}

class PayrollSlip {
  final String id;
  final String userId;
  final String? staffName;
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
    this.staffName,
    this.month,
    this.year,
    this.basicSalary = 0,
    this.totalAllowances = 0,
    this.totalDeductions = 0,
    this.netSalary = 0,
    this.status,
    this.paymentDate,
  });

  /// Field names follow the backend `_payroll_dict` serializer
  /// (`backend/app/api/v1/hr_payroll.py`): `allowances_total`,
  /// `deductions_total`, `paid_at`. Legacy aliases kept for older payloads.
  factory PayrollSlip.fromJson(Map<String, dynamic> json) {
    return PayrollSlip(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      staffName: json['staff_name'] as String?,
      month: json['month']?.toString(),
      year: json['year']?.toString(),
      basicSalary: _num(json['basic_salary']),
      totalAllowances:
          _num(json['allowances_total'] ?? json['total_allowances']),
      totalDeductions:
          _num(json['deductions_total'] ?? json['total_deductions']),
      netSalary: _num(json['net_salary']),
      status: json['status'] as String?,
      paymentDate:
          (json['paid_at'] ?? json['payment_date'])?.toString(),
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
      id: json['id']?.toString() ?? '',
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
