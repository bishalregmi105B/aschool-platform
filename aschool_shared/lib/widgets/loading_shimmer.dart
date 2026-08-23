import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../theme/app_theme.dart';

class LoadingShimmer extends StatelessWidget {
  final int itemCount;
  final double height;
  final EdgeInsets padding;
  final bool showHeader;

  const LoadingShimmer({
    super.key,
    this.itemCount = 5,
    this.height = 86,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
    this.showHeader = true,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: ASchoolTheme.tertiary,
      highlightColor: Colors.white,
      child: ListView(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          if (showHeader)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Container(
                height: 96,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(ASchoolTheme.radiusLg),
                ),
              ),
            ),
          ...List.generate(
            itemCount,
            (_) => Padding(
              padding: padding,
              child: Container(
                height: height,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget cards({int count = 4}) {
    return Shimmer.fromColors(
      baseColor: ASchoolTheme.tertiary,
      highlightColor: Colors.white,
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.4,
        ),
        itemCount: count,
        itemBuilder: (_, __) => Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(ASchoolTheme.radiusMd),
          ),
        ),
      ),
    );
  }
}
