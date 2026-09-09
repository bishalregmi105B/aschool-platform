import 'package:flutter/material.dart';
import '../services/i18n_service.dart';
import '../theme/app_theme.dart';

class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final bool showBackButton;
  final VoidCallback? onBackPressed;
  /// Server clock + EN⇄ने language toggle rendered before [actions]. Screens
  /// that need the full width can pass false; most want both by default.
  final bool showUtilities;

  const CustomAppBar({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    this.showBackButton = true,
    this.onBackPressed,
    this.showUtilities = true,
  });

  @override
  Widget build(BuildContext context) {
    final hasActions = actions != null && actions!.isNotEmpty;
    final canPop = Navigator.of(context).canPop();
    final shouldShowBack = showBackButton && (onBackPressed != null || canPop);
    return Material(
      color: Colors.transparent,
      child: Container(
        decoration: const BoxDecoration(
          color: ASchoolTheme.primary,
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(24),
            bottomRight: Radius.circular(24),
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  height: 40,
                  child: Stack(
                    children: [
                      if (shouldShowBack)
                        Align(
                          alignment: Alignment.centerLeft,
                          child: _CircleActionButton(
                            icon: Icons.arrow_back_ios_new_rounded,
                            onTap: onBackPressed ??
                                () => Navigator.of(context).maybePop(),
                          ),
                        ),
                      Align(
                        alignment: Alignment.center,
                        child: Padding(
                          padding: EdgeInsets.only(
                            left: shouldShowBack ? 58 : 18,
                            right: hasActions ? 120 : 18,
                          ),
                          child: Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              fontSize: 18,
                            ),
                          ),
                        ),
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: IconTheme(
                          data: const IconThemeData(color: Colors.white),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (showUtilities) ...[
                                const _AppBarLanguageToggle(),
                                const SizedBox(width: 6),
                              ],
                              ...(actions ?? const <Widget>[]),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Text(
                      subtitle!,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        height: 1.25,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Size get preferredSize {
    final hasSubtitle = subtitle != null && subtitle!.trim().isNotEmpty;
    return Size.fromHeight(hasSubtitle ? 112 : 94);
  }
}

class _CircleActionButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _CircleActionButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withAlpha(42),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(icon, color: Colors.white, size: 18),
        ),
      ),
    );
  }
}


/// Compact EN⇄ने switch styled for the deep-green app bar.
class _AppBarLanguageToggle extends StatelessWidget {
  const _AppBarLanguageToggle();

  @override
  Widget build(BuildContext context) {
    final i18n = I18nService.instance;
    return AnimatedBuilder(
      animation: i18n,
      builder: (context, _) => GestureDetector(
        onTap: () => i18n.toggle(),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'EN',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: Colors.white
                      .withValues(alpha: i18n.isNepali ? 0.5 : 1),
                ),
              ),
              const SizedBox(width: 4),
              Text(
                'ने',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Colors.white
                      .withValues(alpha: i18n.isNepali ? 1 : 0.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
