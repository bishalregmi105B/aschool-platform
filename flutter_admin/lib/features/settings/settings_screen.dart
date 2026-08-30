import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// School settings, profile, plan management, preferences
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  Map<String, dynamic>? _school;
  bool _loading = true;
  String? _error;
  bool _darkMode = false;
  bool _pushNotifications = true;
  bool _nepaliLanguage = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await ApiClient.instance.get('/schools/current');
      final data = Map<String, dynamic>.from(resp.data['data'] ?? {});
      final settings = Map<String, dynamic>.from(data['settings'] ?? {});
      final notifications =
          Map<String, dynamic>.from(data['notification_config'] ?? {});
      setState(() {
        _school = data;
        _darkMode = settings['dark_mode'] == true;
        _pushNotifications = notifications['push_enabled'] != false;
        _nepaliLanguage = data['default_language'] == 'ne';
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('SettingsScreen load failed: $e\n$st');
      setState(() {
        _error = 'Could not load school settings.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingShimmer();
    if (_error != null) {
      return ErrorContainer(errorMessage: _error!, onRetry: _load);
    }

    final auth = ref.watch(authProvider);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // School Info Card
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundImage: _school?['logo_url'] != null
                      ? NetworkImage(_school!['logo_url'])
                      : null,
                  child: _school?['logo_url'] == null
                      ? const Icon(Icons.school, size: 36)
                      : null,
                ),
                const SizedBox(height: 12),
                Text(_school?['name'] ?? '',
                    style: Theme.of(context).textTheme.titleLarge),
                Text(_school?['slug'] ?? '',
                    style: TextStyle(color: Colors.grey[500])),
                const SizedBox(height: 8),
                _planChip(_school?['plan'] ?? 'free'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Settings sections
        _sectionTitle('School Information'),
        _settingsTile(Icons.edit, 'Edit School Profile', () => _editProfile()),
        _settingsTile(Icons.language, 'Website & Domain', () => _editDomain()),
        _settingsTile(Icons.calendar_today, 'Academic Session',
            () => _editAcademicSession()),

        _sectionTitle('Billing & Plan'),
        _settingsTile(Icons.upgrade, 'Upgrade Plan', () => _showUpgrade()),
        _settingsTile(
            Icons.receipt_long, 'Billing History', () => _showBillingHistory()),
        _settingsTile(
            Icons.payment, 'Payment Methods', () => _showPaymentMethods()),

        _sectionTitle('Preferences'),
        _settingsTile(Icons.system_update, 'App Version & Force Update',
            () => _editMobileVersion()),
        _switchTile(Icons.dark_mode, 'Dark Mode', _darkMode,
            (v) => _saveSettings({'dark_mode': v})),
        _switchTile(Icons.notifications, 'Push Notifications',
            _pushNotifications, (v) => _saveNotificationSettings(v)),
        _switchTile(Icons.translate, 'Nepali Language', _nepaliLanguage,
            (v) => _saveLanguage(v)),

        _sectionTitle('Security'),
        _settingsTile(Icons.lock, 'Change Password', () => _changePassword()),
        _settingsTile(Icons.people, 'Manage Staff Accounts',
            () => context.go('/teachers')),
        _settingsTile(
            Icons.shield, 'Role Permissions', () => _showRolePermissions()),

        _sectionTitle('Data'),
        _settingsTile(
            Icons.download, 'Export Data', () => context.go('/compliance')),
        _settingsTile(
            Icons.backup, 'Backup Settings', () => _showBackupSettings()),

        const SizedBox(height: 24),
        // User Info
        Card(
          child: ListTile(
            leading: CircleAvatar(
              child: Text(
                (auth.user?.firstName ?? '?').substring(0, 1).toUpperCase(),
              ),
            ),
            title: Text(auth.user?.fullName ?? ''),
            subtitle: Text(auth.user?.email ?? auth.user?.phone ?? ''),
            trailing: const Text('Admin',
                style: TextStyle(color: ASchoolTheme.primary)),
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: () {
            ref.read(authProvider.notifier).logout();
          },
          icon: const Icon(Icons.logout, color: ASchoolTheme.danger),
          label: const Text('Logout',
              style: TextStyle(color: ASchoolTheme.danger)),
          style: OutlinedButton.styleFrom(
              side: const BorderSide(color: ASchoolTheme.danger)),
        ),
        const SizedBox(height: 24),
        Center(
          child: Text('ASchool v2.0',
              style: TextStyle(fontSize: 12, color: Colors.grey[400])),
        ),
      ],
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 8),
      child: Text(title,
          style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              color: Colors.grey[600])),
    );
  }

  Widget _settingsTile(IconData icon, String title, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 4),
      child: ListTile(
        leading: Icon(icon, color: ASchoolTheme.primary),
        title: Text(title),
        trailing: Icon(Icons.chevron_right, color: Colors.grey[400]),
        onTap: onTap,
      ),
    );
  }

  Widget _switchTile(
      IconData icon, String title, bool value, ValueChanged<bool> onChanged) {
    return Card(
      margin: const EdgeInsets.only(bottom: 4),
      child: SwitchListTile(
        secondary: Icon(icon, color: ASchoolTheme.primary),
        title: Text(title),
        value: value,
        onChanged: onChanged,
      ),
    );
  }

  Widget _planChip(String plan) {
    Color color;
    switch (plan) {
      case 'starter':
        color = ASchoolTheme.primary;
        break;
      case 'growth':
        color = ASchoolTheme.warning;
        break;
      case 'premium':
        color = const Color(0xFF8B5CF6);
        break;
      default:
        color = ASchoolTheme.success;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
          color: color.withAlpha(20), borderRadius: BorderRadius.circular(16)),
      child: Text('${plan.toUpperCase()} PLAN',
          style: TextStyle(
              fontWeight: FontWeight.w600, color: color, fontSize: 12)),
    );
  }

  void _editProfile() {
    final nameCtrl = TextEditingController(text: _school?['name'] ?? '');
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Edit School Profile'),
        content: TextField(
          controller: nameCtrl,
          decoration: const InputDecoration(labelText: 'School Name'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              await ApiClient.instance
                  .patch('/schools/current', data: {'name': nameCtrl.text});
              if (!mounted) return;
              Navigator.pop(context);
              await _load();
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _editDomain() {
    final domainCtrl =
        TextEditingController(text: _school?['custom_domain'] ?? '');
    final websiteCtrl =
        TextEditingController(text: _school?['website_external'] ?? '');
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Website & Domain'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: domainCtrl,
              decoration: const InputDecoration(labelText: 'Custom Domain'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: websiteCtrl,
              decoration: const InputDecoration(labelText: 'External Website'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              await ApiClient.instance.patch('/schools/current', data: {
                'custom_domain': domainCtrl.text.trim().isEmpty
                    ? null
                    : domainCtrl.text.trim(),
                'website_external': websiteCtrl.text.trim().isEmpty
                    ? null
                    : websiteCtrl.text.trim(),
              });
              if (!mounted) return;
              Navigator.pop(context);
              await _load();
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _editAcademicSession() {
    final startCtrl = TextEditingController(
        text: _school?['academic_year_start_bs']?.toString() ?? '');
    final endCtrl = TextEditingController(
        text: _school?['academic_year_end_bs']?.toString() ?? '');
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Academic Session'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: startCtrl,
              decoration: const InputDecoration(labelText: 'Start Date (BS)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: endCtrl,
              decoration: const InputDecoration(labelText: 'End Date (BS)'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              await ApiClient.instance.patch('/schools/current', data: {
                'academic_year_start_bs': startCtrl.text.trim(),
                'academic_year_end_bs': endCtrl.text.trim(),
              });
              if (!mounted) return;
              Navigator.pop(context);
              await _load();
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _saveSettings(Map<String, dynamic> updates) async {
    final settings = Map<String, dynamic>.from(_school?['settings'] ?? {});
    settings.addAll(updates);
    setState(() {
      _darkMode = settings['dark_mode'] == true;
    });
    await ApiClient.instance
        .patch('/schools/current', data: {'settings': settings});
    await _load();
  }

  Future<void> _saveNotificationSettings(bool enabled) async {
    final config =
        Map<String, dynamic>.from(_school?['notification_config'] ?? {});
    config['push_enabled'] = enabled;
    setState(() => _pushNotifications = enabled);
    await ApiClient.instance
        .patch('/schools/current', data: {'notification_config': config});
    await _load();
  }

  Future<void> _saveLanguage(bool nepali) async {
    setState(() => _nepaliLanguage = nepali);
    await ApiClient.instance.patch('/schools/current',
        data: {'default_language': nepali ? 'ne' : 'en'});
    await _load();
  }

  void _changePassword() {
    final currentCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Change Password'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: currentCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current Password'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: newCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'New Password'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              try {
                await ApiClient.instance.post('/auth/change-password', data: {
                  'current_password': currentCtrl.text,
                  'new_password': newCtrl.text,
                });
                if (!mounted) return;
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Password updated')),
                );
              } catch (e, st) {
                debugPrint('SettingsScreen change-password failed: $e\n$st');
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Unable to update password'),
                    backgroundColor: ASchoolTheme.danger,
                  ),
                );
              }
            },
            child: const Text('Update'),
          ),
        ],
      ),
    );
  }

  void _showBillingHistory() {
    _infoDialog(
      'Billing History',
      [
        'Plan: ${_school?['plan'] ?? 'free'}',
        'Status: ${_school?['status'] ?? 'trial'}',
        'Expires: ${_school?['plan_expires_at'] ?? 'Not scheduled'}',
      ],
    );
  }

  void _showPaymentMethods() {
    final feeConfig = Map<String, dynamic>.from(_school?['fee_config'] ?? {});
    final rawMethods = safeList(feeConfig['payment_methods']);
    final enabledLabels = rawMethods
        .whereType<Map>()
        .where((item) => item['enabled'] == true)
        .map((item) {
          final label = (item['label'] ?? '').toString().trim();
          final key = (item['key'] ?? '').toString().trim();
          return label.isNotEmpty ? label : key;
        })
        .where((value) => value.isNotEmpty)
        .toList();

    final methods = enabledLabels.isNotEmpty
        ? enabledLabels.join(', ')
        : 'No enabled payment methods';

    _infoDialog('Payment Methods', ['Enabled methods: $methods']);
  }

  void _showRolePermissions() {
    _infoDialog('Role Permissions', [
      'Superadmin and school admin users can manage staff accounts.',
      'Teacher, parent, and student access is controlled by their assigned role.',
    ]);
  }

  void _showBackupSettings() {
    final settings = Map<String, dynamic>.from(_school?['settings'] ?? {});
    _infoDialog('Backup Settings', [
      'School settings keys: ${settings.keys.join(', ').isEmpty ? 'none' : settings.keys.join(', ')}',
      'Use the compliance module for export history and audit logs.',
    ]);
  }

  void _infoDialog(String title, List<String> lines) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final line in lines)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(line),
              ),
          ],
        ),
        actions: [
          FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Done')),
        ],
      ),
    );
  }

  void _editMobileVersion() async {
    Map<String, dynamic> config = {};
    try {
      final resp = await ApiClient.instance.get('/mobile/version');
      config = Map<String, dynamic>.from(resp.data['data'] ?? {});
    } catch (e, st) {
      debugPrint('SettingsScreen mobile-version fetch failed (using cached): $e\n$st');
      config = Map<String, dynamic>.from(
          (_school?['settings'] ?? {})['mobile_version'] ?? {});
    }

    if (!mounted) return;
    final studentCtrl =
        TextEditingController(text: config['student_min_version'] ?? '1.0.0');
    final teacherCtrl =
        TextEditingController(text: config['teacher_min_version'] ?? '1.0.0');
    final parentCtrl =
        TextEditingController(text: config['parent_min_version'] ?? '1.0.0');
    final adminCtrl =
        TextEditingController(text: config['admin_min_version'] ?? '1.0.0');
    final messageCtrl = TextEditingController(
        text: config['message'] ?? 'A newer ASchool app version is available.');
    bool force = config['force_update'] == true;

    showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('App Version & Force Update'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Force Update'),
                  value: force,
                  onChanged: (value) => setDialogState(() => force = value),
                ),
                TextField(
                  controller: studentCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Student Min Version'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: teacherCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Teacher Min Version'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: parentCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Parent Min Version'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: adminCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Admin Min Version'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: messageCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Message'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                await ApiClient.instance.put('/mobile/version', data: {
                  'force_update': force,
                  'student_min_version': studentCtrl.text.trim(),
                  'teacher_min_version': teacherCtrl.text.trim(),
                  'parent_min_version': parentCtrl.text.trim(),
                  'admin_min_version': adminCtrl.text.trim(),
                  'message': messageCtrl.text.trim(),
                });
                if (!context.mounted) return;
                Navigator.pop(context);
                if (!mounted) return;
                await _load();
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  void _showUpgrade() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Upgrade Your Plan',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            _planOption(
                'Starter', 'Rs 1,500/mo', '15 plugins', ASchoolTheme.primary),
            _planOption(
                'Growth', 'Rs 3,500/mo', '35 plugins', ASchoolTheme.warning),
            _planOption('Premium', 'Rs 7,000/mo', '40+ plugins',
                const Color(0xFF8B5CF6)),
          ],
        ),
      ),
    );
  }

  Widget _planOption(String name, String price, String plugins, Color color) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withAlpha(20),
          child: Icon(Icons.star, color: color),
        ),
        title: Text(name),
        subtitle: Text(plugins),
        trailing: Text(price,
            style: TextStyle(fontWeight: FontWeight.bold, color: color)),
        onTap: () {
          Navigator.pop(context);
          context.go('/marketplace');
        },
      ),
    );
  }
}
