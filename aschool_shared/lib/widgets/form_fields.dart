import 'package:flutter/material.dart';

import '../services/i18n_service.dart';

/// Shared form primitives — bilingual labels + always-visible hints.
/// Every app form should build on these so labels/hints localize with the
/// header toggle and no field loses its helper text.
///
///   ASchoolFormField(
///     label: 'Phone', ne: 'फोन',
///     hint: 'SMS notices go to this number',
///     neHint: 'यो नम्बरमा SMS सूचना जान्छ',
///     child: TextFormField(…), // decoration: null — label rendered here
///   )
class ASchoolFormField extends StatelessWidget {
  final String label;
  final String ne;
  final String? hint;
  final String? neHint;
  final String? error;
  final bool requiredMark;
  final Widget child;

  const ASchoolFormField({
    super.key,
    required this.label,
    required this.ne,
    this.hint,
    this.neHint,
    this.error,
    this.requiredMark = false,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final i18n = I18nService.instance;
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Flexible(
                child: Text(
                  i18n.t(label, ne),
                  style: theme.textTheme.labelMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              if (requiredMark)
                Text(' *',
                    style: TextStyle(
                        color: theme.colorScheme.error,
                        fontWeight: FontWeight.w700)),
            ],
          ),
        ),
        child,
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 3, left: 2),
            child: Text(error!,
                style: TextStyle(
                    color: theme.colorScheme.error, fontSize: 11)),
          )
        else if (hint != null)
          Padding(
            padding: const EdgeInsets.only(top: 3, left: 2),
            child: Text(
              neHint != null ? i18n.t(hint!, neHint!) : hint!,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
          ),
      ],
    );
  }
}

/// Wide form scaffold: scrollable body + sticky footer action bar that
/// keeps the primary button reachable on long forms (matches the web
/// FormActions).
class ASchoolFormScaffold extends StatelessWidget {
  final String title;
  final String neTitle;
  final List<Widget> sections;
  final VoidCallback? onSubmit;
  final String submitLabel;
  final String neSubmitLabel;
  final bool submitting;
  final Widget? leading;

  const ASchoolFormScaffold({
    super.key,
    required this.title,
    required this.neTitle,
    required this.sections,
    this.onSubmit,
    required this.submitLabel,
    required this.neSubmitLabel,
    this.submitting = false,
    this.leading,
  });

  @override
  Widget build(BuildContext context) {
    final i18n = I18nService.instance;
    final theme = Theme.of(context);
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            children: [
              Text(i18n.t(title, neTitle),
                  style: theme.textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              ...sections.expand((s) => [s, const SizedBox(height: 14)]),
            ],
          ),
        ),
        Material(
          elevation: 8,
          color: theme.colorScheme.surface,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: Row(
                children: [
                  if (leading != null) leading!,
                  const Spacer(),
                  FilledButton(
                    onPressed: submitting ? null : onSubmit,
                    child: submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(i18n.t(submitLabel, neSubmitLabel)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
