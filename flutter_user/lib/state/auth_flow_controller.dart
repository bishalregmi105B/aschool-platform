import 'package:flutter/material.dart';

enum UserRoleTarget { student, parent, teacher, unsupported }

enum LoginFlow { student, parent, teacher }

enum EntryStage { loading, onboarding, mode, school, login }

const String schoolSlugKey = 'selected_school_slug_v1';

extension LoginFlowView on LoginFlow {
  String get label {
    switch (this) {
      case LoginFlow.student:
        return 'Student';
      case LoginFlow.parent:
        return 'Parent';
      case LoginFlow.teacher:
        return 'Teacher';
    }
  }

  String get subtitle {
    switch (this) {
      case LoginFlow.student:
        return 'Timetable, homework, results, and progress in one place.';
      case LoginFlow.parent:
        return 'Track attendance, fees, notices, and child performance.';
      case LoginFlow.teacher:
        return 'Manage classes, attendance, marks, and teaching tools.';
    }
  }

  String get identifierLabel {
    if (this == LoginFlow.student) return 'Student ID';
    return 'Phone Number or Email';
  }

  String get identifierHint {
    switch (this) {
      case LoginFlow.student:
        return 'e.g. STU-2023-001';
      case LoginFlow.parent:
        return '98XXXXXXXX or parent@email.com';
      case LoginFlow.teacher:
        return '98XXXXXXXX or teacher@school.edu.np';
    }
  }

  TextInputType get keyboardType {
    if (this == LoginFlow.student) return TextInputType.text;
    return TextInputType.emailAddress;
  }

  IconData get icon {
    switch (this) {
      case LoginFlow.student:
        return Icons.school_rounded;
      case LoginFlow.parent:
        return Icons.family_restroom_rounded;
      case LoginFlow.teacher:
        return Icons.menu_book_rounded;
    }
  }

  Color get accent {
    switch (this) {
      case LoginFlow.student:
        return const Color(0xFF2563EB);
      case LoginFlow.parent:
        return const Color(0xFF0E9F6E);
      case LoginFlow.teacher:
        return const Color(0xFFD97706);
    }
  }
}

const String onboardingSeenKey = 'user_onboarding_seen_v1';

UserRoleTarget resolveRoleTarget(String rawRole) {
  final role = rawRole.trim().toLowerCase();
  if (role == 'student') return UserRoleTarget.student;
  if (role == 'parent') return UserRoleTarget.parent;
  if (role == 'teacher' || role == 'staff') return UserRoleTarget.teacher;
  return UserRoleTarget.unsupported;
}
