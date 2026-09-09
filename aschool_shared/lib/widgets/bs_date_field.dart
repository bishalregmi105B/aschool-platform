import 'package:flutter/material.dart';

import '../services/i18n_service.dart';

// BS calendar data: days per month per year (2000–2090 BS)
const Map<int, List<int>> _bsData = {
  2000:[30,32,31,32,31,30,30,30,29,30,29,31], 2001:[31,31,32,31,31,31,30,29,30,29,30,30],
  2002:[31,31,32,32,31,30,30,29,30,29,30,30], 2003:[31,32,31,32,31,30,30,30,29,29,30,31],
  2004:[30,32,31,32,31,30,30,30,29,30,29,31], 2005:[31,31,32,31,31,31,30,29,30,29,30,30],
  2006:[31,31,32,32,31,30,30,29,30,29,30,30], 2007:[31,32,31,32,31,30,30,30,29,29,30,31],
  2008:[31,31,31,32,31,31,29,30,30,29,29,31], 2009:[31,31,32,31,31,31,30,29,30,29,30,30],
  2010:[31,31,32,32,31,30,30,29,30,29,30,30], 2011:[31,32,31,32,31,30,30,30,29,29,30,31],
  2012:[31,31,31,32,31,31,29,30,30,29,30,30], 2013:[31,31,32,31,31,31,30,29,30,29,30,30],
  2014:[31,31,32,32,31,30,30,29,30,29,30,30], 2015:[31,32,31,32,31,30,30,30,29,29,30,31],
  2016:[31,31,31,32,31,31,29,30,30,29,30,30], 2017:[31,31,32,31,31,31,30,29,30,29,30,30],
  2018:[31,31,32,32,31,30,30,29,30,29,30,30], 2019:[31,32,31,32,31,30,30,30,29,29,30,31],
  2020:[31,31,31,32,31,31,29,30,30,29,30,30], 2021:[31,31,32,31,31,31,30,29,30,29,30,30],
  2022:[31,31,32,32,31,30,30,29,30,29,30,30], 2023:[31,32,31,32,31,30,30,30,29,29,30,31],
  2024:[31,31,31,32,31,31,29,30,30,29,30,30], 2025:[31,31,32,31,31,31,30,29,30,29,30,30],
  2026:[31,31,32,32,31,30,30,29,30,29,30,30], 2027:[31,32,31,32,31,30,30,30,29,29,30,31],
  2028:[31,31,31,32,31,31,29,30,30,29,30,30], 2029:[31,31,32,31,31,31,30,29,30,29,30,30],
  2030:[31,31,32,32,31,30,30,29,30,29,30,30], 2031:[31,32,31,32,31,30,30,30,29,29,30,31],
  2032:[31,31,31,32,31,31,29,30,30,29,30,30], 2033:[31,31,32,31,31,31,30,29,30,29,30,30],
  2034:[31,31,32,32,31,30,30,29,30,29,30,30], 2035:[31,32,31,32,31,30,30,30,29,29,30,31],
  2036:[31,31,31,32,31,31,29,30,30,29,30,30], 2037:[31,31,32,31,31,31,30,29,30,29,30,30],
  2038:[31,31,32,32,31,30,30,29,30,29,30,30], 2039:[31,32,31,32,31,30,30,30,29,29,30,31],
  2040:[31,31,31,32,31,31,29,30,30,29,30,30], 2041:[31,31,32,31,31,31,30,29,30,29,30,30],
  2042:[31,31,32,32,31,30,30,29,30,29,30,30], 2043:[31,32,31,32,31,30,30,30,29,29,30,31],
  2044:[31,31,31,32,31,31,29,30,30,29,30,30], 2045:[31,31,32,31,31,31,30,29,30,29,30,30],
  2046:[31,31,32,32,31,30,30,29,30,29,30,30], 2047:[31,32,31,32,31,30,30,30,29,29,30,31],
  2048:[31,31,31,32,31,31,29,30,30,29,30,30], 2049:[31,31,32,31,31,31,30,29,30,29,30,30],
  2050:[31,31,32,32,31,30,30,29,30,29,30,30], 2051:[31,32,31,32,31,30,30,30,29,29,30,31],
  2052:[31,31,31,32,31,31,29,30,30,29,30,30], 2053:[31,31,32,31,31,31,30,29,30,29,30,30],
  2054:[31,31,32,32,31,30,30,29,30,29,30,30], 2055:[31,32,31,32,31,30,30,30,29,29,30,31],
  2056:[31,31,31,32,31,31,29,30,30,29,30,30], 2057:[31,31,32,31,31,31,30,29,30,29,30,30],
  2058:[31,31,32,32,31,30,30,29,30,29,30,30], 2059:[31,32,31,32,31,30,30,30,29,29,30,31],
  2060:[31,31,31,32,31,31,29,30,30,29,30,30], 2061:[31,31,32,31,31,31,30,29,30,29,30,30],
  2062:[31,31,32,32,31,30,30,29,30,29,30,30], 2063:[31,32,31,32,31,30,30,30,29,29,30,31],
  2064:[31,31,31,32,31,31,29,30,30,29,30,30], 2065:[31,31,32,31,31,31,30,29,30,29,30,30],
  2066:[31,31,32,32,31,30,30,29,30,29,30,30], 2067:[31,32,31,32,31,30,30,30,29,29,30,31],
  2068:[31,31,31,32,31,31,29,30,30,29,30,30], 2069:[31,31,32,31,31,31,30,29,30,29,30,30],
  2070:[31,31,32,32,31,30,30,29,30,29,30,30], 2071:[31,32,31,32,31,30,30,30,29,29,30,31],
  2072:[31,31,31,32,31,31,29,30,30,29,30,30], 2073:[31,31,32,31,31,31,30,29,30,29,30,30],
  2074:[31,31,32,32,31,30,30,29,30,29,30,30], 2075:[31,32,31,32,31,30,30,30,29,29,30,31],
  2076:[31,31,31,32,31,31,29,30,30,29,30,30], 2077:[31,31,32,31,31,31,30,29,30,29,30,30],
  2078:[31,31,32,32,31,30,30,29,30,29,30,30], 2079:[31,32,31,32,31,30,30,30,29,29,30,31],
  2080:[31,31,31,32,31,31,29,30,30,29,30,30], 2081:[31,31,32,31,31,31,30,29,30,29,30,30],
  2082:[31,32,31,32,31,30,30,30,29,29,30,30], 2083:[31,31,31,32,31,31,29,30,30,29,30,30],
  2084:[31,31,32,31,31,31,30,29,30,29,30,30], 2085:[31,32,31,32,31,30,30,30,29,29,30,31],
  2086:[31,31,31,32,31,31,29,30,30,29,30,30], 2087:[31,31,32,31,31,31,30,29,30,29,30,30],
  2088:[31,31,32,32,31,30,30,29,30,29,30,30], 2089:[31,32,31,32,31,30,30,30,29,29,30,31],
  2090:[31,31,31,32,31,31,29,30,30,29,30,30],
};

const List<String> bsMonthsEn = [
  'Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin',
  'Kartik','Mangsir','Poush','Magh','Falgun','Chaitra',
];

const List<String> bsMonthsNe = [
  'बैशाख','जेठ','असार','श्रावण','भदौ','असोज',
  'कार्तिक','मंसिर','पुष','माघ','फाल्गुन','चैत',
];

// BS epoch: 2000/01/01 BS = 1943-04-14 AD
final DateTime _bsEpochAd = DateTime(1943, 4, 14);

class BsDate {
  final int year, month, day;
  const BsDate(this.year, this.month, this.day);

  /// "YYYY-MM-DD" (BS numbers).
  String get iso =>
      '$year-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';

  @override
  String toString() => iso;
}

int _bsDaysInMonth(int y, int m) => _bsData[y]?[m - 1] ?? 30;

/// Convert an AD [DateTime] to a BS date.
BsDate adToBs(DateTime ad) {
  final local = DateTime(ad.year, ad.month, ad.day);
  int remaining = local.difference(_bsEpochAd).inDays;
  for (int y = 2000; y <= 2090; y++) {
    final months = _bsData[y];
    if (months == null) break;
    for (int m = 0; m < 12; m++) {
      if (remaining < months[m]) {
        return BsDate(y, m + 1, remaining + 1);
      }
      remaining -= months[m];
    }
  }
  // Out of table range: approximate (7-year offset) so UI never blanks.
  return BsDate(ad.year + 56, ad.month, ad.day + 17 > 30 ? 30 : ad.day + 17);
}

/// Convert a BS date to AD.
DateTime bsToAd(BsDate bs) {
  int days = 0;
  for (int y = 2000; y < bs.year; y++) {
    final months = _bsData[y];
    if (months == null) break;
    days += months.reduce((a, b) => a + b);
  }
  final months = _bsData[bs.year];
  if (months != null) {
    for (int m = 0; m < bs.month - 1; m++) {
      days += months[m];
    }
  }
  days += bs.day - 1;
  return _bsEpochAd.add(Duration(days: days));
}

/// Convert an AD "YYYY-MM-DD" string to BS.
BsDate? adStringToBs(String ad) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(ad.trim());
  if (m == null) return null;
  return adToBs(DateTime(int.parse(m.group(1)!), int.parse(m.group(2)!), int.parse(m.group(3)!)));
}

/// Convert a BS [BsDate] to AD "YYYY-MM-DD" string.
String bsToAdString(BsDate bs) {
  final ad = bsToAd(bs);
  return '${ad.year.toString().padLeft(4, '0')}-'
      '${ad.month.toString().padLeft(2, '0')}-'
      '${ad.day.toString().padLeft(2, '0')}';
}

/// BS-first date field for forms — the mobile sibling of the web
/// BSDateInput. Opens a bottom sheet with a BS calendar grid; emits AD
/// "YYYY-MM-DD" by default (emitBs: true keeps legacy BS contracts), so
/// backends stay unchanged. The AD equivalent is always shown under the
/// chosen BS date.
///
///   BsDateField(label: 'Date of Birth', onChanged: (ad) => …)
class BsDateField extends FormField<String> {
  final String label;
  /// Nepali label shown when the app language is नेपाली.
  final String ne;
  final bool emitBs;

  BsDateField({
    super.key,
    required this.label,
    this.ne = '',
    super.initialValue,
    super.onSaved,
    ValueChanged<String>? onChanged,
    super.validator,
    this.emitBs = false,
    bool enabled = true,
    String? hint,
  }) : super(
          enabled: enabled,
          builder: (state) {
            final context = state.context;
            final value = state.value;
            final bs = value != null ? adStringToBs(value) : null;
            final theme = Theme.of(context);

            Future<void> pick() async {
              final pickedBs = await showBsDatePicker(
                context,
                initialAd: value,
              );
              if (pickedBs != null) {
                final out = emitBs ? pickedBs.iso : bsToAdString(pickedBs);
                state.didChange(out);
                onChanged?.call(out);
              }
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    I18nService.instance.t(label, ne),
                    style: theme.textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                InkWell(
                  onTap: enabled ? pick : null,
                  borderRadius: BorderRadius.circular(10),
                  child: InputDecorator(
                    decoration: InputDecoration(
                      hintText: hint ?? 'वि.सं. मिति छान्नुहोस्',
                      prefixIcon: const Icon(Icons.calendar_month_rounded, size: 20),
                      suffixIcon: value != null && enabled
                          ? IconButton(
                              icon: const Icon(Icons.close_rounded, size: 16),
                              onPressed: () {
                                state.didChange(null);
                                onChanged?.call('');
                              },
                            )
                          : null,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      isDense: true,
                    ),
                    child: Text(
                      bs != null
                          ? '${bs.day} ${bsMonthsEn[bs.month - 1]} ${bs.year}'
                          : '',
                      style: theme.textTheme.bodyMedium,
                    ),
                  ),
                ),
                if (bs != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 3, left: 2),
                    child: Text(
                      value!,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline),
                    ),
                  ),
                if (state.hasError)
                  Padding(
                    padding: const EdgeInsets.only(top: 3, left: 2),
                    child: Text(
                      state.errorText!,
                      style: TextStyle(
                          color: theme.colorScheme.error, fontSize: 11),
                    ),
                  ),
              ],
            );
          },
        );
}

/// BS calendar bottom sheet. Returns the picked [BsDate] (BS numbers) or null.
Future<BsDate?> showBsDatePicker(
  BuildContext context, {
  String? initialAd,
  int minYear = 2000,
  int maxYear = 2090,
}) async {
  final initial = initialAd != null && initialAd.isNotEmpty
      ? adStringToBs(initialAd)
      : adToBs(DateTime.now());
  BsDate selected = initial ?? adToBs(DateTime.now());

  return showModalBottomSheet<BsDate>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (context) {
      final theme = Theme.of(context);
      return StatefulBuilder(
        builder: (context, setState) {
          final daysInMonth = _bsDaysInMonth(selected.year, selected.month);
          final monthName = bsMonthsEn[selected.month - 1];
          return SafeArea(
            child: Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 12,
                bottom: MediaQuery.of(context).viewInsets.bottom + 12,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          key: ValueKey('bs-year-$selected'),
                          initialValue: selected.year,
                          decoration: const InputDecoration(
                            labelText: 'वर्ष (BS)',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                          items: [
                            for (int y = minYear; y <= maxYear; y++)
                              DropdownMenuItem(value: y, child: Text('$y BS')),
                          ],
                          onChanged: (y) {
                            if (y == null) return;
                            setState(() {
                              final maxDay = _bsDaysInMonth(y, selected.month);
                              selected = BsDate(
                                y,
                                selected.month,
                                selected.day > maxDay ? maxDay : selected.day,
                              );
                            });
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          key: ValueKey('bs-month-$selected'),
                          initialValue: selected.month,
                          decoration: const InputDecoration(
                            labelText: 'महिना',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                          items: [
                            for (int m = 1; m <= 12; m++)
                              DropdownMenuItem(
                                value: m,
                                child: Text('${bsMonthsNe[m - 1]} · ${bsMonthsEn[m - 1]}'),
                              ),
                          ],
                          onChanged: (m) {
                            if (m == null) return;
                            setState(() {
                              final maxDay = _bsDaysInMonth(selected.year, m);
                              selected = BsDate(
                                selected.year,
                                m,
                                selected.day > maxDay ? maxDay : selected.day,
                              );
                            });
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '$monthName ${selected.year} BS',
                        style: theme.textTheme.titleSmall,
                      ),
                      TextButton.icon(
                        onPressed: () {
                          final today = adToBs(DateTime.now());
                          setState(() => selected = today);
                          Navigator.of(context).pop(today);
                        },
                        icon: const Icon(Icons.today_rounded, size: 16),
                        label: const Text('आज'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 38 * ((daysInMonth + 6) ~/ 7 + 1),
                    child: GridView.builder(
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 7,
                        childAspectRatio: 1.15,
                      ),
                      itemCount: daysInMonth,
                      itemBuilder: (context, i) {
                        final day = i + 1;
                        final isSel = day == selected.day;
                        return Padding(
                          padding: const EdgeInsets.all(2),
                          child: Material(
                            color: isSel
                                ? theme.colorScheme.primary
                                : theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(8),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(8),
                              onTap: () {
                                setState(() => selected = BsDate(selected.year, selected.month, day));
                                Navigator.of(context).pop(selected);
                              },
                              child: Center(
                                child: Text(
                                  '$day',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                                    color: isSel ? theme.colorScheme.onPrimary : null,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  Text(
                    'AD: ${bsToAdString(selected)}',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}

/// BS month picker (year + month only) emitting "YYYY-MM" in BS numbers —
/// for billing months and validity windows.
Future<String?> showBsMonthPicker(
  BuildContext context, {
  String? initialBsYm,
  int minYear = 2075,
  int maxYear = 2090,
}) async {
  final parts = initialBsYm?.split('-') ?? [];
  int year = parts.isNotEmpty ? int.tryParse(parts[0]) ?? 2083 : 2083;
  int month = parts.length > 1 ? int.tryParse(parts[1]) ?? 1 : 1;

  return showModalBottomSheet<String>(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: year,
                    decoration: const InputDecoration(
                      labelText: 'वर्ष (BS)',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    items: [
                      for (int y = minYear; y <= maxYear; y++)
                        DropdownMenuItem(value: y, child: Text('$y BS')),
                    ],
                    onChanged: (y) {
                      if (y != null) year = y;
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: month,
                    decoration: const InputDecoration(
                      labelText: 'महिना',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    items: [
                      for (int m = 1; m <= 12; m++)
                        DropdownMenuItem(
                          value: m,
                          child: Text('${bsMonthsNe[m - 1]} · ${bsMonthsEn[m - 1]}'),
                        ),
                    ],
                    onChanged: (m) {
                      if (m != null) month = m;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(
                '$year-${month.toString().padLeft(2, '0')}',
              ),
              child: const Text('ठीक छ'),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Show (and keep updating) the BS date string for any AD date — display
/// helper for cards/lists.
String bsDisplay(DateTime ad, {bool nepali = false}) {
  final bs = adToBs(ad);
  final months = nepali ? bsMonthsNe : bsMonthsEn;
  return '${bs.day} ${months[bs.month - 1]} ${bs.year}';
}
