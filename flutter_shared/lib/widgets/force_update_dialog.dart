import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class ForceUpdateDialog extends StatelessWidget {
  final String message;
  final String? storeUrl;

  const ForceUpdateDialog({
    super.key,
    required this.message,
    this.storeUrl,
  });

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AlertDialog(
        title: const Text('Update Required'),
        content: Text(message),
        actions: [
          FilledButton.icon(
            onPressed: storeUrl == null
                ? null
                : () async {
                    final uri = Uri.parse(storeUrl!);
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri,
                          mode: LaunchMode.externalApplication);
                    }
                  },
            icon: const Icon(Icons.system_update_rounded),
            label: const Text('Update'),
          ),
        ],
      ),
    );
  }
}
