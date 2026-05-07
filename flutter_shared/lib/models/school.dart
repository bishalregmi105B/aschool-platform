/// School model — basic school info cached locally
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
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      address: json['address'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      logoUrl: json['logo_url'] as String?,
      plan: json['plan'] as String?,
      academicYear: json['academic_year'] as String?,
      settings: json['settings'] as Map<String, dynamic>?,
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
