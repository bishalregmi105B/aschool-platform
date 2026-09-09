import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/i18n_service.dart';

/// One field the AI assistant may fill — mirrors the web AiFieldSchema and
/// the backend /ai-tools/form-assist contract.
class AiFieldSchema {
  final String key;
  final String label;
  final String ne;
  final String type; // text | number | date | time | select | email | textarea
  final List<String> options;
  final bool required;

  const AiFieldSchema({
    required this.key,
    required this.label,
    required this.ne,
    this.type = 'text',
    this.options = const [],
    this.required = false,
  });

  Map<String, dynamic> toJson() => {
        'key': key,
        'label': label,
        'type': type,
        if (options.isNotEmpty) 'options': options,
        if (required) 'required': true,
      };
}

/// The universal AI form-assist sheet — the mobile sibling of the web
/// AiFormAssistPanel. Any form in any of the five apps can open it with a
/// schema + a callback, and the AI fills fields through that callback so
/// cascading/select logic on the form side still runs:
///
///   showAiFormAssistSheet(
///     context,
///     formId: 'student_admission',
///     schema: [AiFieldSchema(key: 'first_name', label: 'First Name', ne: 'पहिलो नाम'), …],
///     onApply: (values) => setState(…),
///   );
Future<void> showAiFormAssistSheet(
  BuildContext context, {
  required String formId,
  required List<AiFieldSchema> schema,
  required Map<String, dynamic> current,
  required ValueChanged<Map<String, dynamic>> onApply,
}) async {
  final i18n = I18nService.instance;
  final controller = TextEditingController();
  bool busy = false;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      final theme = Theme.of(sheetContext);
      return StatefulBuilder(
        builder: (sheetContext, setState) {
          Future<void> run() async {
            final instruction = controller.text.trim();
            if (instruction.isEmpty || busy) return;
            setState(() => busy = true);
            try {
              final res = await ApiClient.instance.post('/ai-tools/form-assist', data: {
                'form_id': formId,
                'fields': schema.map((f) => f.toJson()).toList(),
                'instruction': instruction,
                'current': current,
                'language': i18n.isNepali ? 'nepali' : 'english',
              });
              final data = res.data is Map ? (res.data['data'] ?? res.data) : null;
              final values = (data is Map ? data['values'] : null);
              if (values is Map && values.isNotEmpty) {
                onApply(Map<String, dynamic>.from(values));
                if (sheetContext.mounted) {
                  ScaffoldMessenger.of(sheetContext).showSnackBar(SnackBar(
                    content: Text(i18n.t(
                        'AI filled ${values.length} field(s)',
                        'AI ले ${values.length} फिल्ड भर्‍यो')),
                  ));
                  Navigator.of(sheetContext).pop();
                }
              } else {
                setState(() => busy = false);
                if (sheetContext.mounted) {
                  ScaffoldMessenger.of(sheetContext).showSnackBar(SnackBar(
                    content: Text(i18n.t(
                        "AI couldn't determine any fields — add more detail",
                        'AI ले फिल्ड निर्धारण गर्न सकेन — थप विवरण दिनुहोस्')),
                  ));
                }
              }
            } catch (_) {
              setState(() => busy = false);
              if (sheetContext.mounted) {
                ScaffoldMessenger.of(sheetContext).showSnackBar(SnackBar(
                  content: Text(i18n.t('AI assistant failed', 'AI सहायक असफल भयो')),
                ));
              }
            }
          }

          return SafeArea(
            child: Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 14,
                bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 14,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Icon(Icons.auto_awesome_rounded,
                          size: 18, color: theme.colorScheme.primary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          i18n.t('AI Quick Fill', 'एआई द्रुत भराइ'),
                          style: theme.textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 18),
                        onPressed: () => Navigator.of(sheetContext).pop(),
                      ),
                    ],
                  ),
                  Text(
                    i18n.t(
                        'Describe the record in plain words (Nepali or English)',
                        'कुनै पनि भाषामा विवरण लेख्नुहोस्'),
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: controller,
                    maxLines: 3,
                    minLines: 2,
                    autofocus: true,
                    decoration: InputDecoration(
                      hintText: i18n.t(
                          'e.g. Ram Bahadur Thapa, class 5 section A, father Suresh 9841000000',
                          'जस्तै: राम बहादुर थापा, कक्षा ५ खण्ड क, बुबा सुरेश ९८४१००००००'),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 10),
                  FilledButton.icon(
                    onPressed: busy ? null : run,
                    icon: busy
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.auto_fix_high_rounded, size: 18),
                    label: Text(busy
                        ? i18n.t('Filling…', 'भर्दै…')
                        : i18n.t('Fill form', 'फारम भर्नुहोस्')),
                  ),
                  // Keeps the keyboard from covering the button.
                  SizedBox(height: MediaQuery.of(sheetContext).viewInsets.bottom > 0 ? 4 : 0),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}
