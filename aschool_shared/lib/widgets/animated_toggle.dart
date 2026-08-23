import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class AnimatedToggle extends StatelessWidget {
  final List<String> values;
  final int selectedIndex;
  final ValueChanged<int> onToggleCallback;
  final Color backgroundColor;
  final Color buttonColor;
  final Color textColor;

  const AnimatedToggle({
    super.key,
    required this.values,
    required this.onToggleCallback,
    this.selectedIndex = 0,
    this.backgroundColor = const Color(0xFFF0F0F0),
    this.buttonColor = ASchoolTheme.primary,
    this.textColor = Colors.white,
  });

  @override
  Widget build(BuildContext context) {
    double width = MediaQuery.of(context).size.width - 32;
    double itemWidth = width / values.length;

    return Container(
      width: width,
      height: 44,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Stack(
        children: [
          AnimatedPositioned(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
            top: 2,
            left: (selectedIndex * itemWidth) + 2,
            child: Container(
              width: itemWidth - 4,
              height: 40,
              decoration: BoxDecoration(
                color: buttonColor,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withAlpha(20),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
            ),
          ),
          Row(
            children: List.generate(
              values.length,
              (index) => GestureDetector(
                onTap: () => onToggleCallback(index),
                child: Container(
                  width: itemWidth,
                  height: 44,
                  alignment: Alignment.center,
                  color: Colors.transparent,
                  child: Text(
                    values[index],
                    style: TextStyle(
                      color: selectedIndex == index
                          ? textColor
                          : Colors.grey.shade600,
                      fontWeight: selectedIndex == index
                          ? FontWeight.bold
                          : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
