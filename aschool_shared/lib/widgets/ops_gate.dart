import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/auth_service.dart';
import '../services/crash_reporter.dart';
import '../services/mobile_version_service.dart';
import 'force_update_dialog.dart';
import 'maintenance_screen.dart';

/// A-07: server-driven ops gate for a single app.
///
/// Place it in `MaterialApp.builder` so it wraps the Navigator:
/// ```dart
/// builder: (context, child) =>
///     OpsGate(appName: 'admin', child: child ?? const SizedBox.shrink()),
/// ```
///
/// Behaviour (fail-open everywhere):
///  - Runs `MobileVersionService.checkOps` once the auth bootstrap settles
///    (and again whenever the signed-in identity changes) — the endpoint
///    needs a JWT, so it is skipped while logged out.
///  - `maintenance: true` → renders [MaintenanceScreen] INSTEAD of the app
///    home until a Retry re-check succeeds.
///  - `forceUpdate: true` → covers the app with a non-dismissible
///    [ForceUpdateDialog].
///  - On any error (offline, unauthenticated, malformed payload) the app
///    continues untouched — offline users are never trapped.
class OpsGate extends ConsumerStatefulWidget {
  const OpsGate({
    super.key,
    required this.appName,
    required this.child,
    this.currentVersion,
  });

  /// Backend app key: `admin|teacher|student|parent|user`.
  final String appName;

  /// Client version for the min-version force-update comparison. Falls back
  /// to the version captured by `CrashReporter.init` in `main()`.
  final String? currentVersion;

  /// The wrapped app (the MaterialApp builder child / Navigator).
  final Widget child;

  @override
  ConsumerState<OpsGate> createState() => _OpsGateState();
}

class _OpsGateState extends ConsumerState<OpsGate> {
  AppOpsState? _ops;
  bool _checking = false;
  String? _lastCheckedUserId;

  @override
  void initState() {
    super.initState();
    // Cover the case where auth already settled before this gate mounted.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = ref.read(authProvider);
      if (!auth.isLoading) _runCheck();
    });
  }

  Future<void> _runCheck() async {
    if (!mounted || _checking) return;
    final user = ref.read(authProvider).user;
    // No JWT before login → the endpoint 401s; fail-open instead of adding
    // one more doomed request (and possible token-refresh churn).
    if (user == null) return;
    _checking = true;
    try {
      final ops = await MobileVersionService.checkOps(
        appName: widget.appName,
        currentVersion:
            widget.currentVersion ?? CrashReporter.appVersion ?? '0.0.0',
      );
      if (!mounted) return;
      setState(() {
        _ops = ops;
        _lastCheckedUserId = user.id;
      });
    } catch (_) {
      // Belt-and-braces: checkOps already fail-opens internally.
      if (mounted) setState(() => _ops = null);
    } finally {
      _checking = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Re-check once the bootstrap spinner settles (session restored or not).
    ref.listen(authProvider.select((s) => s.isLoading), (prev, next) {
      if (prev == true && next == false) _runCheck();
    });
    // Re-check when the signed-in identity changes (fresh JWT after login);
    // clear any stale gate state on logout.
    ref.listen(authProvider.select((s) => s.user?.id), (prev, next) {
      if (prev == next) return;
      if (next == null) {
        if (_ops != null && mounted) setState(() => _ops = null);
      } else if (next != _lastCheckedUserId) {
        _runCheck();
      }
    });

    final ops = _ops;
    if (ops != null && ops.maintenance) {
      return MaintenanceScreen(
        message: ops.maintenanceMessage,
        onRetry: _runCheck,
      );
    }
    if (ops != null && ops.forceUpdate) {
      // Non-blocking-dialog variant of ForceUpdateDialog: the builder sits
      // above the Navigator, so showDialog has no route to use — a barrier
      // overlay gives the same non-dismissible behaviour.
      return Stack(
        children: [
          Positioned.fill(child: widget.child),
          const Positioned.fill(
            child: ModalBarrier(dismissible: false, color: Colors.black54),
          ),
          Align(
            alignment: Alignment.center,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ForceUpdateDialog(
                message: ops.message.isEmpty
                    ? 'Please update ASchool to the latest version to continue.'
                    : ops.message,
                storeUrl: ops.storeUrl,
              ),
            ),
          ),
        ],
      );
    }
    return widget.child;
  }
}
