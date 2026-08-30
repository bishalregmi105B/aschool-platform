/// School model — basic school info cached locally
import '../utils/safe_parse.dart';

class School {
  final String id;
  final String name;
  final String slug;
  final String? address;
  final String? phone;
  final String? email;
  final String? logoUrl;
  final String? plan; // free, standard, enterprise
  final String? academicYear;
  final Map<String, dynamic>? settings;

  const School({
    required this.id,
    required this.name,
    required this.slug,
    this.address,
    this.phone,
    this.email,
    this.logoUrl,
    this.plan,
    this.academicYear,
    this.settings,
  });

  factory School.fromJson(Map<String, dynamic> json) {
    return School(
      id: safeString(json['id']),
      name: safeString(json['name']),
      slug: safeString(json['slug']),
      address: safeStringOrNull(json['address']),
      phone: safeStringOrNull(json['phone']),
      email: safeStringOrNull(json['email']),
      logoUrl: safeStringOrNull(json['logo_url']),
      plan: safeStringOrNull(json['plan']),
      academicYear: safeStringOrNull(json['academic_year']),
      settings: safeMapOrNull(json['settings']),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'slug': slug,
        'address': address,
        'phone': phone,
        'email': email,
        'logo_url': logoUrl,
        'plan': plan,
        'academic_year': academicYear,
        'settings': settings,
      };
}
