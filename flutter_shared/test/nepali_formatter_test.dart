import 'package:flutter_test/flutter_test.dart';
import 'package:aschool_shared/utils/nepali_formatter.dart';

void main() {
  group('NepaliFormatter', () {
    group('currency', () {
      test('formats basic amount', () {
        expect(NepaliFormatter.currency(1234.50), 'Rs. 1,234.50');
      });

      test('formats zero', () {
        expect(NepaliFormatter.currency(0), 'Rs. 0.00');
      });

      test('formats large amount with Indian numbering', () {
        expect(NepaliFormatter.currency(100000), 'Rs. 1,00,000.00');
      });

      test('formats small amount', () {
        expect(NepaliFormatter.currency(5), 'Rs. 5.00');
      });
    });

    group('phone', () {
      test('formats 10-digit number', () {
        expect(NepaliFormatter.phone('9841000001'), '+977-9841000001');
      });

      test('formats number with country code', () {
        expect(NepaliFormatter.phone('9779841000001'), '+977-9841000001');
      });

      test('strips non-digit characters', () {
        expect(NepaliFormatter.phone('+977-984-100-0001'), '+977-9841000001');
      });
    });

    group('ordinal', () {
      test('1st', () => expect(NepaliFormatter.ordinal(1), '1st'));
      test('2nd', () => expect(NepaliFormatter.ordinal(2), '2nd'));
      test('3rd', () => expect(NepaliFormatter.ordinal(3), '3rd'));
      test('4th', () => expect(NepaliFormatter.ordinal(4), '4th'));
      test('11th', () => expect(NepaliFormatter.ordinal(11), '11th'));
      test('12th', () => expect(NepaliFormatter.ordinal(12), '12th'));
      test('13th', () => expect(NepaliFormatter.ordinal(13), '13th'));
      test('21st', () => expect(NepaliFormatter.ordinal(21), '21st'));
      test('22nd', () => expect(NepaliFormatter.ordinal(22), '22nd'));
    });

    group('relativeTime', () {
      test('just now', () {
        expect(NepaliFormatter.relativeTime(DateTime.now()), 'just now');
      });

      test('minutes ago', () {
        final fiveMinAgo = DateTime.now().subtract(const Duration(minutes: 5));
        expect(NepaliFormatter.relativeTime(fiveMinAgo), '5 min ago');
      });

      test('hours ago', () {
        final twoHoursAgo = DateTime.now().subtract(const Duration(hours: 2));
        expect(NepaliFormatter.relativeTime(twoHoursAgo), '2 hours ago');
      });

      test('days ago', () {
        final threeDaysAgo = DateTime.now().subtract(const Duration(days: 3));
        expect(NepaliFormatter.relativeTime(threeDaysAgo), '3 days ago');
      });
    });
  });
}
