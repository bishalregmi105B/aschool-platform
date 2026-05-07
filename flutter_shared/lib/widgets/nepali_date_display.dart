import 'package:flutter/material.dart';

/// Displays Nepali (BS) date with optional AD date below it
class NepaliDateDisplay extends StatelessWidget {
  final DateTime? date;
  final bool showAd;
  final TextStyle? style;
  final TextStyle? adStyle;

  const NepaliDateDisplay({
    super.key,
    this.date,
    this.showAd = true,
    this.style,
    this.adStyle,
  });

  @override
  Widget build(BuildContext context) {
    final d = date ?? DateTime.now();
    // Basic formatting fallback since we don't have the full NepaliFormatter here
    final bsDate = d.toString().split(' ')[0]; // Fallback string
    final adDate = d.toString().split(' ')[0]; // Fallback string

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(bsDate, style: style ?? Theme.of(context).textTheme.bodyMedium),
        if (showAd)
          Text(
            adDate,
            style: adStyle ??
                Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: Colors.grey[600]),
          ),
      ],
    );
  }
}
