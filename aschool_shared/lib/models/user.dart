/// User model — shared across all 4 Flutter apps
import '../utils/safe_parse.dart';

class User {
  final String id;
  final String? email;
  final String? phone;
  final String? firstName;
  final String? lastName;
  final String
      role; // superadmin, school_admin, teacher, staff, student, parent, accountant
  final String? schoolId;
  final String? schoolSlug;
  final String? schoolName;
  final String? avatarUrl;
  final bool isActive;

  const User({
    required this.id,
    this.email,
    this.phone,
    this.firstName,
    this.lastName,
    required this.role,
    this.schoolId,
    this.schoolSlug,
    this.schoolName,
    this.avatarUrl,
    this.isActive = true,
  });

  String get fullName =>
      [firstName, lastName].where((s) => s != null && s.isNotEmpty).join(' ');

  factory User.fromJson(Map<String, dynamic> json) {
    final firstName = _normalize(json['first_name']);
    final lastName = _normalize(json['last_name']);
    final fallbackFullName = _normalize(json['full_name']);
    final fallbackParts = fallbackFullName
            ?.split(RegExp(r'\s+'))
            .where((p) => p.isNotEmpty)
            .toList() ??
        const <String>[];

    final resolvedFirstName =
        firstName ?? (fallbackParts.isNotEmpty ? fallbackParts.first : null);
    final resolvedLastName = lastName ??
        (fallbackParts.length > 1 ? fallbackParts.sublist(1).join(' ') : null);

    return User(
      id: (json['id'] ?? '').toString(),
      email: safeStringOrNull(json['email']),
      phone: safeStringOrNull(json['phone']),
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      role: safeString(json['role'], fallback: 'student'),
      schoolId: json['school_id']?.toString(),
      schoolSlug: safeStringOrNull(json['school_slug']),
      schoolName: safeStringOrNull(json['school_name']),
      avatarUrl: safeStringOrNull(json['avatar_url']),
      isActive: safeBool(json['is_active'], fallback: true),
    );
  }

  static String? _normalize(dynamic value) {
    final text = value?.toString().trim();
    if (text == null || text.isEmpty) return null;
    return text;
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'phone': phone,
        'first_name': firstName,
        'last_name': lastName,
        'role': role,
        'school_id': schoolId,
        'school_slug': schoolSlug,
        'school_name': schoolName,
        'avatar_url': avatarUrl,
        'is_active': isActive,
      };
}
