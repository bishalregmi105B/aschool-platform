import 'package:flutter/material.dart';
import 'package:flutter_tex/flutter_tex.dart';

/// Renders question/option text, switching to a KaTeX [TeXView] when the
/// string contains LaTeX math delimiters (`$...$`, `$$...$$`, `\(...\)`,
/// `\[...\]`). Falls back to plain [Text] on any renderer failure — a
/// broken webview must never take the exam screen down.
class ExamMathText extends StatelessWidget {
  final String data;
  final TextStyle? style;

  /// Background the webview paints over; pass the surrounding surface color
  /// so the renderer doesn't flash white on dark themes.
  final Color? backgroundColor;

  const ExamMathText(
    this.data, {
    super.key,
    this.style,
    this.backgroundColor,
  });

  static final RegExp _mathDelimiters = RegExp(
    r'\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]',
  );

  bool get hasMath => data.trim().isNotEmpty && _mathDelimiters.hasMatch(data);

  @override
  Widget build(BuildContext context) {
    if (!hasMath) {
      return Text(data, style: style);
    }
    // TeXView builds its payload synchronously; any setup failure (missing
    // platform view, malformed math) degrades to plain text.
    try {
      return TeXView(
        renderingEngine: const TeXViewRenderingEngine.katex(),
        style: TeXViewStyle(
          backgroundColor: backgroundColor ?? Colors.transparent,
          contentColor: style?.color ?? Colors.black,
        ),
        loadingWidgetBuilder: (_) => const Center(
          child: Padding(
            padding: EdgeInsets.all(12),
            child: SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
        child: TeXViewDocument(
          data,
          style: TeXViewStyle(
            contentColor: style?.color ?? Colors.black,
          ),
        ),
      );
    } catch (_) {
      return Text(data, style: style);
    }
  }
}
