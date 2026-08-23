import 'package:flutter/material.dart';

class GlowOrb extends StatelessWidget {
  final double size;
  final Color color;

  const GlowOrb({super.key, required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.3),
            blurRadius: 48,
            spreadRadius: 4,
          ),
        ],
      ),
    );
  }
}
