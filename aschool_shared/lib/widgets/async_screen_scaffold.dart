import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'error_container.dart';
import 'loading_shimmer.dart';
import 'no_data_container.dart';

/// AsyncScreenScaffold — the one async-screen body (R7.1).
///
/// The mobile audit found the loading/error/empty trio re-implemented ~90
/// times across the five apps (`if (_loading) LoadingShimmer; if (_error)
/// ErrorContainer(...)`). This widget owns that trio once:
///
/// ```dart
/// AsyncScreenScaffold(
///   loading: _loading,
///   error: _error,
///   onRetry: _load,
///   isEmpty: _items.isEmpty,
///   emptyTitle: 'No assignments yet',
///   child: ListView(...),
/// )
/// ```
///
/// Priority: error > loading > empty > child. Works with FutureBuilder too
/// via the [AsyncScreenScaffold.fromSnapshot] helper (snapshot.hasError /
/// !snapshot.hasData map to error/loading).
class AsyncScreenScaffold extends StatelessWidget {
  /// Whether the async operation is in flight.
  final bool loading;

  /// Error message; non-null renders the retry card.
  final String? error;

  /// Retry callback shown on the error card.
  final VoidCallback? onRetry;

  /// When true (and not loading/error), renders the empty state.
  final bool isEmpty;

  /// Empty-state copy.
  final String emptyTitle;
  final String? emptySubtitle;
  final IconData emptyIcon;

  /// The loaded content.
  final Widget child;

  /// Shimmer row count while loading.
  final int shimmerItems;

  const AsyncScreenScaffold({
    super.key,
    required this.loading,
    this.error,
    this.onRetry,
    this.isEmpty = false,
    this.emptyTitle = 'Nothing here yet',
    this.emptySubtitle,
    this.emptyIcon = Icons.inbox_outlined,
    required this.child,
    this.shimmerItems = 6,
  });

  /// FutureBuilder/AsyncSnapshot adapter: connectionState.waiting → loading,
  /// hasError → error (message from error.toString()), no data → empty.
  factory AsyncScreenScaffold.fromSnapshot({
    Key? key,
    required AsyncSnapshot<Object?> snapshot,
    VoidCallback? onRetry,
    required String emptyTitle,
    String? emptySubtitle,
    IconData emptyIcon = Icons.inbox_outlined,
    required Widget child,
    int shimmerItems = 6,
  }) {
    final waiting = snapshot.connectionState == ConnectionState.waiting &&
        !snapshot.hasData;
    final errorMsg = snapshot.hasError ? snapshot.error.toString() : null;
    final empty = !waiting &&
        errorMsg == null &&
        (snapshot.data == null ||
            (snapshot.data is List && (snapshot.data as List).isEmpty));
    return AsyncScreenScaffold(
      key: key,
      loading: waiting,
      error: errorMsg,
      onRetry: onRetry,
      isEmpty: empty,
      emptyTitle: emptyTitle,
      emptySubtitle: emptySubtitle,
      emptyIcon: emptyIcon,
      shimmerItems: shimmerItems,
      child: child,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return ErrorContainer(
        errorMessage: error!,
        onRetry: onRetry,
      );
    }
    if (loading) {
      return LoadingShimmer(itemCount: shimmerItems);
    }
    if (isEmpty) {
      return NoDataContainer(
        title: emptyTitle,
        subtitle: emptySubtitle,
        icon: emptyIcon,
      );
    }
    return child;
  }
}

/// DependencyEmptyState — the setup-guidance variant for blocked screens
/// (mobile audit: no equivalent of the web DependencyMissingEmptyState).
/// Shows what's missing and where to get it, instead of a bare "no data".
class DependencyEmptyState extends StatelessWidget {
  final String title;
  final String subtitle;
  final String prerequisiteName;
  final IconData icon;

  const DependencyEmptyState({
    super.key,
    required this.title,
    required this.subtitle,
    required this.prerequisiteName,
    this.icon = Icons.extension_outlined,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: ASchoolTheme.primary.withAlpha(26),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 30, color: ASchoolTheme.primary),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).hintColor,
                  ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: ASchoolTheme.accent.withAlpha(26),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'Requires: $prerequisiteName',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: ASchoolTheme.primary,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
