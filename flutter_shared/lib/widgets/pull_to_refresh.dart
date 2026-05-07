import 'package:flutter/material.dart';

class PullToRefresh extends StatelessWidget {
  final Widget child;
  final Future<void> Function() onRefresh;

  const PullToRefresh({
    super.key,
    required this.child,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: Theme.of(context).primaryColor,
      backgroundColor: Colors.white,
      strokeWidth: 3,
      child: child,
    );
  }
}
