import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class ErrorContainer extends StatelessWidget {
  final String errorMessage;
  final VoidCallback? onRetry;
  final bool showIcon;

  const ErrorContainer({
    super.key,
    required this.errorMessage,
    this.onRetry,
    this.showIcon = true,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: ASchoolTheme.elevatedBox(
            borderColor: ASchoolTheme.danger.withAlpha(65),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (showIcon) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: ASchoolTheme.danger.withAlpha(20),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.error_outline_rounded,
                    color: ASchoolTheme.danger,
                    size: 34,
                  ),
                ),
                const SizedBox(height: 12),
              ],
              Text(
                'Something went wrong',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: ASchoolTheme.secondary,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                errorMessage,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: ASchoolTheme.mutedText,
                    ),
                textAlign: TextAlign.center,
              ),
              if (onRetry != null) ...[
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry'),
                  style: FilledButton.styleFrom(
                    backgroundColor: ASchoolTheme.primary,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(120, 44),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
