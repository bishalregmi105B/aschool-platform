import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:showcaseview/showcaseview.dart';

/// A-30: one-time coach-mark tour over the teacher home screen entry points —
/// attendance, marks, assignments and the More menu that holds Student Diary.
///
/// Everything here is guarded: any failure (missing plugin tiles, showcase
/// API quirks, storage issues) is swallowed so the tour can never block the
/// app. The tour runs at most once per install, tracked by the
/// [doneFlagKey] SharedPreferences flag.
class CoachMarks {
  CoachMarks._();

  /// Bump the suffix (v1 → v2) to replay the tour for everyone.
  static const String doneFlagKey = 'coach_marks_done_v1';

  static ShowcaseView? _registeredView;
  static final Set<GlobalKey> _tourKeys = <GlobalKey>{};

  // Stable keys — Showcase re-registers against the same key on rebuilds.
  static final GlobalKey _attendanceKey =
      GlobalKey(debugLabel: 'coach_attendance');
  static final GlobalKey _marksKey = GlobalKey(debugLabel: 'coach_marks');
  static final GlobalKey _assignmentsKey =
      GlobalKey(debugLabel: 'coach_assignments');
  static final GlobalKey _moreKey = GlobalKey(debugLabel: 'coach_more');

  static ShowcaseView _ensureView() =>
      _registeredView ??= ShowcaseView.register(
        skipIfTargetNotPresent: true,
        disableBarrierInteraction: true,
      );

  /// Wrap a quick-action tile in a [Showcase] when it is a tour stop;
  /// otherwise return the tile untouched.
  static Widget wrapTile(String label, Widget child) {
    try {
      final stop = _stopFor(label);
      if (stop == null) return child;
      _tourKeys.add(stop.$1);
      _ensureView();
      return Showcase(
        key: stop.$1,
        title: stop.$2,
        description: stop.$3,
        tooltipBackgroundColor: Colors.white,
        textColor: const Color(0xFF16344A),
        targetBorderRadius: BorderRadius.circular(14),
        child: child,
      );
    } catch (_) {
      return child;
    }
  }

  /// Schedule the one-time tour once the dashboard data has rendered, so all
  /// [Showcase] targets are mounted before startShowCase runs.
  static void maybeStart() {
    try {
      WidgetsBinding.instance.addPostFrameCallback((_) => _start());
    } catch (_) {}
  }

  static Future<void> _start() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool(doneFlagKey) ?? false) return;
      final keys = _tourKeys.toList();
      if (keys.isEmpty) return;
      // Mark done before starting so a crashed/interrupted tour can't loop.
      await prefs.setBool(doneFlagKey, true);
      _ensureView().startShowCase(keys);
    } catch (_) {
      // Never let the tour break the dashboard.
    }
  }

  /// Tour stops: label → (key, title, description). `More` stands in for the
  /// Student Diary entry point, which lives inside the More menu.
  static (GlobalKey, String, String)? _stopFor(String label) {
    switch (label) {
      case 'Attendance':
        return (
          _attendanceKey,
          'Take attendance',
          "Mark today's attendance for each class in one tap.",
        );
      case 'Marks':
        return (
          _marksKey,
          'Enter marks',
          'Record and update student marks here.',
        );
      case 'Assignments':
        return (
          _assignmentsKey,
          'Assignments',
          'Create homework and review student submissions.',
        );
      case 'More':
        return (
          _moreKey,
          'Student Diary & more',
          'Find Student Diary, exams, library and more in this menu.',
        );
      default:
        return null;
    }
  }
}
