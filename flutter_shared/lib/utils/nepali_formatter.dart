import 'package:intl/intl.dart';

/// Nepal-specific formatting helpers
class NepaliFormatter {
  NepaliFormatter._();

  /// Format NPR currency: "Rs. 1,234.50"
  static String currency(double amount) {
    final sign = amount < 0 ? '-' : '';
    final fixed = NumberFormat('0.00').format(amount.abs());
    final parts = fixed.split('.');
    return 'Rs. $sign${_indianGroup(parts.first)}.${parts.last}';
  }

  static String _indianGroup(String value) {
    if (value.length <= 3) return value;
    final lastThree = value.substring(value.length - 3);
    var remaining = value.substring(0, value.length - 3);
    final groups = <String>[];
    while (remaining.length > 2) {
      groups.insert(0, remaining.substring(remaining.length - 2));
      remaining = remaining.substring(0, remaining.length - 2);
    }
    if (remaining.isNotEmpty) groups.insert(0, remaining);
    return [...groups, lastThree].join(',');
  }

  /// Format Nepal phone: "98XXXXXXXX" → "+977-98XXXXXXXX"
  static String phone(String number) {
    final cleaned = number.replaceAll(RegExp(r'[^\d]'), '');
    if (cleaned.startsWith('977')) {
      return '+977-${cleaned.substring(3)}';
    }
    return '+977-$cleaned';
  }

  /// Short date: "2081-05-15"
  static String shortDate(DateTime date) {
    return DateFormat('yyyy-MM-dd').format(date);
  }

  /// Prefer BS date text when available, otherwise fall back to AD text.
  static String preferredDateText({
    String? bsDate,
    String? adDate,
    String fallback = '-',
  }) {
    final bs = (bsDate ?? '').trim();
    if (bs.isNotEmpty) return bs;

    final ad = (adDate ?? '').trim();
    if (ad.isNotEmpty) return ad;

    return fallback;
  }

  /// Prefer BS start/end dates when available, otherwise fall back to AD dates.
  static String preferredDateRange({
    String? startBs,
    String? endBs,
    String? startAd,
    String? endAd,
    String separator = ' to ',
    String fallback = '-',
  }) {
    final start = preferredDateText(
      bsDate: startBs,
      adDate: startAd,
      fallback: fallback,
    );
    final end = preferredDateText(
      bsDate: endBs,
      adDate: endAd,
      fallback: fallback,
    );

    if (start == fallback && end == fallback) return fallback;
    if (end == fallback) return start;
    if (start == fallback) return end;
    return '$start$separator$end';
  }

  /// Relative time: "5 min ago", "2 hours ago", etc.
  static String relativeTime(DateTime dateTime) {
    final diff = DateTime.now().difference(dateTime);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hours ago';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    return DateFormat('MMM d').format(dateTime);
  }

  /// Ordinal suffix: 1 → "1st", 2 → "2nd"
  static String ordinal(int number) {
    if (number >= 11 && number <= 13) return '${number}th';
    switch (number % 10) {
      case 1:
        return '${number}st';
      case 2:
        return '${number}nd';
      case 3:
        return '${number}rd';
      default:
        return '${number}th';
    }
  }
}
