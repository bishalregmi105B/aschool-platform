import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<SharedPreferences> _prefs() => SharedPreferences.getInstance();

/// App language for all five ASchool Flutter apps.
enum AppLanguage { english, nepali }

/// Bilingual i18n for the Flutter apps — the sibling of the web dashboard's
/// `lib/i18n.tsx`. `t(en, ne)` returns the string for the active language;
/// partial dictionaries degrade to English by construction.
///
/// Persisted to SharedPreferences under the SAME `preferred_language` key the
/// web dashboard uses, so a user's choice follows them across platforms.
class I18nService extends ChangeNotifier {
  static const String storageKey = 'preferred_language';

  AppLanguage _language = AppLanguage.english;

  static final I18nService instance = I18nService._();

  I18nService._();

  factory I18nService() => instance;

  AppLanguage get language => _language;
  bool get isNepali => _language == AppLanguage.nepali;

  Future<void> load() async {
    try {
      final prefs = await _prefs();
      final v = prefs.getString(storageKey);
      if (v == 'ne') {
        _language = AppLanguage.nepali;
      } else if (v == 'en') {
        _language = AppLanguage.english;
      }
    } catch (_) {}
  }

  Future<void> setLanguage(AppLanguage lang) async {
    if (lang == _language) return;
    _language = lang;
    notifyListeners();
    try {
      final prefs = await _prefs();
      await prefs.setString(storageKey, lang == AppLanguage.nepali ? 'ne' : 'en');
    } catch (_) {}
  }

  Future<void> toggle() =>
      setLanguage(_language == AppLanguage.nepali ? AppLanguage.english : AppLanguage.nepali);

  /// t('Save', 'सुरक्षित') → string for the active language.
  String t(String en, String ne) =>
      _language == AppLanguage.nepali ? ne : en;
}

