import 'package:flutter_test/flutter_test.dart';
import 'package:aschool_shared/models/plugin_manifest.dart';
import 'package:aschool_shared/models/user.dart';
import 'package:aschool_shared/models/school.dart';

void main() {
  group('PluginManifest', () {
    test('fromJson creates valid instance', () {
      final json = {
        'slug': 'attendance',
        'name': 'Attendance',
        'description': 'Daily attendance tracking',
        'tier': 'free',
        'price_monthly': 0,
        'price_yearly': 0,
        'icon': 'check_circle',
        'category': 'core',
        'is_installed': true,
        'config': {'notify': true},
      };

      final manifest = PluginManifest.fromJson(json);

      expect(manifest.slug, 'attendance');
      expect(manifest.name, 'Attendance');
      expect(manifest.description, 'Daily attendance tracking');
      expect(manifest.tier, 'free');
      expect(manifest.priceMonthly, 0);
      expect(manifest.priceYearly, 0);
      expect(manifest.icon, 'check_circle');
      expect(manifest.category, 'core');
      expect(manifest.isInstalled, true);
      expect(manifest.config?['notify'], true);
    });

    test('fromJson handles missing optional fields', () {
      final json = {'slug': 'lms', 'name': 'LMS'};

      final manifest = PluginManifest.fromJson(json);

      expect(manifest.slug, 'lms');
      expect(manifest.name, 'LMS');
      expect(manifest.description, isNull);
      expect(manifest.tier, 'free');
      expect(manifest.priceMonthly, 0);
      expect(manifest.isInstalled, false);
      expect(manifest.config, isNull);
    });

    test('toJson round-trip preserves data', () {
      const manifest = PluginManifest(
        slug: 'lms',
        name: 'Learning Management',
        tier: 'growth',
        priceMonthly: 500,
        priceYearly: 5000,
        category: 'academics',
        isInstalled: true,
      );

      final json = manifest.toJson();
      final restored = PluginManifest.fromJson(json);

      expect(restored.slug, manifest.slug);
      expect(restored.name, manifest.name);
      expect(restored.tier, manifest.tier);
      expect(restored.priceMonthly, manifest.priceMonthly);
      expect(restored.priceYearly, manifest.priceYearly);
      expect(restored.isInstalled, manifest.isInstalled);
    });

    test('toJson outputs correct keys', () {
      const manifest = PluginManifest(slug: 'test', name: 'Test');
      final json = manifest.toJson();

      expect(json.containsKey('slug'), true);
      expect(json.containsKey('price_monthly'), true);
      expect(json.containsKey('price_yearly'), true);
      expect(json.containsKey('is_installed'), true);
    });
  });

  group('InstalledPlugin', () {
    test('fromJson creates valid instance', () {
      final json = {
        'slug': 'lms',
        'name': 'LMS',
        'category': 'academics',
        'tier': 'growth',
        'is_active': true,
        'installed_at': '2024-01-15T10:30:00.000Z',
        'expires_at': '2025-01-15T10:30:00.000Z',
      };

      final plugin = InstalledPlugin.fromJson(json);

      expect(plugin.slug, 'lms');
      expect(plugin.name, 'LMS');
      expect(plugin.category, 'academics');
      expect(plugin.tier, 'growth');
      expect(plugin.isActive, true);
      expect(plugin.installedAt, isA<DateTime>());
      expect(plugin.expiresAt, isA<DateTime>());
      expect(plugin.installedAt!.year, 2024);
    });

    test('fromJson handles missing optional fields', () {
      final json = {'slug': 'attendance', 'name': 'Attendance'};

      final plugin = InstalledPlugin.fromJson(json);

      expect(plugin.slug, 'attendance');
      expect(plugin.tier, 'free');
      expect(plugin.isActive, true);
      expect(plugin.installedAt, isNull);
      expect(plugin.expiresAt, isNull);
      expect(plugin.category, isNull);
    });

    test('toJson round-trip preserves data', () {
      final original = InstalledPlugin(
        slug: 'lms',
        name: 'LMS',
        tier: 'growth',
        category: 'academics',
        installedAt: DateTime(2024, 1, 15),
      );

      final json = original.toJson();
      final restored = InstalledPlugin.fromJson(json);

      expect(restored.slug, original.slug);
      expect(restored.name, original.name);
      expect(restored.tier, original.tier);
      expect(restored.category, original.category);
    });

    test('toJson outputs null dates as null', () {
      const plugin = InstalledPlugin(slug: 'test', name: 'Test');
      final json = plugin.toJson();

      expect(json['installed_at'], isNull);
      expect(json['expires_at'], isNull);
    });
  });

  group('User', () {
    test('fromJson creates valid instance', () {
      final json = {
        'id': 'usr-123',
        'email': 'ram@school.np',
        'phone': '9841000001',
        'first_name': 'Ram',
        'last_name': 'Sharma',
        'role': 'teacher',
        'school_id': 'sch-456',
        'school_slug': 'test-academy',
        'school_name': 'Test Academy',
        'avatar_url': 'https://cdn.example.com/avatar.jpg',
        'is_active': true,
      };

      final user = User.fromJson(json);

      expect(user.id, 'usr-123');
      expect(user.email, 'ram@school.np');
      expect(user.phone, '9841000001');
      expect(user.firstName, 'Ram');
      expect(user.lastName, 'Sharma');
      expect(user.role, 'teacher');
      expect(user.schoolId, 'sch-456');
      expect(user.isActive, true);
    });

    test('fullName combines first and last name', () {
      const user = User(id: '1', role: 'student', firstName: 'Sita', lastName: 'Rai');
      expect(user.fullName, 'Sita Rai');
    });

    test('fullName with only first name', () {
      const user = User(id: '1', role: 'student', firstName: 'Sita');
      expect(user.fullName, 'Sita');
    });

    test('fullName with no names is empty', () {
      const user = User(id: '1', role: 'student');
      expect(user.fullName, '');
    });

    test('fromJson defaults role to student', () {
      final json = {'id': 'usr-1'};
      final user = User.fromJson(json);
      expect(user.role, 'student');
    });

    test('toJson outputs correct keys', () {
      const user = User(
        id: 'usr-1',
        role: 'school_admin',
        email: 'admin@school.np',
        firstName: 'Admin',
      );
      final json = user.toJson();

      expect(json['id'], 'usr-1');
      expect(json['role'], 'school_admin');
      expect(json['email'], 'admin@school.np');
      expect(json['first_name'], 'Admin');
      // snake_case keys
      expect(json.containsKey('first_name'), true);
      expect(json.containsKey('school_id'), true);
      expect(json.containsKey('avatar_url'), true);
    });

    test('toJson round-trip preserves data', () {
      const user = User(
        id: 'usr-1',
        role: 'parent',
        email: 'parent@gmail.com',
        phone: '9841000002',
        firstName: 'Krishna',
        lastName: 'Adhikari',
        schoolId: 'sch-1',
      );

      final json = user.toJson();
      final restored = User.fromJson(json);

      expect(restored.id, user.id);
      expect(restored.role, user.role);
      expect(restored.email, user.email);
      expect(restored.firstName, user.firstName);
      expect(restored.lastName, user.lastName);
      expect(restored.schoolId, user.schoolId);
    });
  });

  group('School', () {
    test('fromJson creates valid instance', () {
      final json = {
        'id': 'sch-123',
        'name': 'Budhanilkantha School',
        'slug': 'budhanilkantha',
        'address': 'Kathmandu, Nepal',
        'phone': '014370001',
        'email': 'info@budhanilkantha.edu.np',
        'logo_url': 'https://cdn.example.com/logo.png',
        'plan': 'enterprise',
        'academic_year': '2081',
        'settings': {'language': 'ne', 'timezone': 'Asia/Kathmandu'},
      };

      final school = School.fromJson(json);

      expect(school.id, 'sch-123');
      expect(school.name, 'Budhanilkantha School');
      expect(school.slug, 'budhanilkantha');
      expect(school.address, 'Kathmandu, Nepal');
      expect(school.plan, 'enterprise');
      expect(school.academicYear, '2081');
      expect(school.settings?['language'], 'ne');
    });

    test('fromJson handles missing optional fields', () {
      final json = {'id': 'sch-1', 'name': 'Test', 'slug': 'test'};
      final school = School.fromJson(json);

      expect(school.address, isNull);
      expect(school.plan, isNull);
      expect(school.settings, isNull);
    });

    test('toJson outputs correct keys', () {
      const school = School(
        id: 'sch-1',
        name: 'Demo School',
        slug: 'demo',
        plan: 'standard',
      );
      final json = school.toJson();

      expect(json['id'], 'sch-1');
      expect(json['slug'], 'demo');
      expect(json.containsKey('logo_url'), true);
      expect(json.containsKey('academic_year'), true);
    });

    test('toJson round-trip preserves data', () {
      const school = School(
        id: 'sch-1',
        name: 'Nepal Academy',
        slug: 'nepal-academy',
        address: 'Pokhara',
        plan: 'standard',
        academicYear: '2081',
        settings: {'theme': 'dark'},
      );

      final json = school.toJson();
      final restored = School.fromJson(json);

      expect(restored.id, school.id);
      expect(restored.name, school.name);
      expect(restored.slug, school.slug);
      expect(restored.address, school.address);
      expect(restored.plan, school.plan);
      expect(restored.academicYear, school.academicYear);
      expect(restored.settings?['theme'], 'dark');
    });
  });
}
