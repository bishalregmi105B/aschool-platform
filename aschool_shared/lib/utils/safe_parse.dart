/// Tolerant JSON parsing helpers (M9 parse-hardening pass).
///
/// The backend (Flask/SQLAlchemy `to_dict()` serializers, JSONB columns,
/// SQLite-vs-Postgres numeric quirks) sometimes delivers ids as ints,
/// numerics as numeric strings or doubles, and nested collections as null
/// or the wrong type. Raw `as String` / `as int` / `as List` downcasts
/// throw on any of those and crash whole screens.
///
/// Convention used across `aschool_shared` models/repositories:
/// - ids accept `String | int` (anything else → fallback / null)
/// - numerics accept `int | double | String`
/// - lists / maps default to `[]` / `{}` on null or wrong type
/// - timestamps are null-safe
/// - malformed data never throws: it degrades to the fallback so one bad
///   field can't take down a whole model; repositories log the anomaly.
///
/// These helpers coerce; they never swallow unexpected *exceptions* — a
/// wrong JSON type is a data shape problem (→ fallback), not an error to
/// hide, and callers that need to know use the `OrNull` variants.
library;

import 'package:flutter/foundation.dart';

/// Log a non-fatal JSON shape anomaly (wrong type / missing field) so
/// malformed backend payloads are visible in the console instead of being
/// silently coerced. Never throws.
void logJsonShape(String source, Object detail) {
  debugPrint('[aschool_shared] json shape anomaly at $source: $detail');
}

/// Coerce a JSON value to [String]: `String` passes through, `num`/`bool`
/// stringify, anything else (null, Map, List) → [fallback].
String safeString(dynamic v, {String fallback = ''}) {
  if (v is String) return v;
  if (v is num || v is bool) return v.toString();
  return fallback;
}

/// Like [safeString] but returns null instead of a fallback when the value
/// is absent or not stringifiable in a meaningful way.
String? safeStringOrNull(dynamic v) {
  if (v == null) return null;
  if (v is String) return v;
  if (v is num || v is bool) return v.toString();
  return null;
}

/// Coerce a JSON value to [int]: `num` truncates, `String` parses as int
/// (then as double for `"3.0"`-style payloads), anything else → [fallback].
int safeInt(dynamic v, {int fallback = 0}) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) {
    final parsed = int.tryParse(v) ?? double.tryParse(v)?.toInt();
    return parsed ?? fallback;
  }
  return fallback;
}

/// Like [safeInt] but returns null when the value is absent or unparseable.
int? safeIntOrNull(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? double.tryParse(v)?.toInt();
  return null;
}

/// Coerce a JSON value to [double]: `num`, numeric `String`, else [fallback].
double safeDouble(dynamic v, {double fallback = 0}) {
  if (v is num) return v.toDouble();
  if (v is String) {
    final parsed = double.tryParse(v) ?? int.tryParse(v)?.toDouble();
    return parsed ?? fallback;
  }
  return fallback;
}

/// Like [safeDouble] but returns null when the value is absent or unparseable.
double? safeDoubleOrNull(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? int.tryParse(v)?.toDouble();
  return null;
}

/// Coerce a JSON value to [bool]: real `bool` passes through, numeric
/// `1/0` and `"true"/"false"/"1"/"0"/"yes"/"no"` are accepted, else [fallback].
bool safeBool(dynamic v, {bool fallback = false}) {
  if (v is bool) return v;
  if (v is num) return v != 0;
  if (v is String) {
    switch (v.toLowerCase()) {
      case 'true':
      case '1':
      case 'yes':
      case 'y':
        return true;
      case 'false':
      case '0':
      case 'no':
      case 'n':
        return false;
    }
  }
  return fallback;
}

/// Coerce a JSON value to `List<Map<String, dynamic>>`: a `List` yields its
/// `Map` elements (skipping non-map entries), anything else → `const []`.
List<Map<String, dynamic>> safeMapList(dynamic v) {
  if (v is List) {
    return [
      for (final item in v)
        if (item is Map) Map<String, dynamic>.from(item),
    ];
  }
  return const [];
}

/// Coerce a JSON value to a `List<String>`: elements are stringified
/// (ids often arrive as ints), non-primitive entries are skipped.
List<String> safeStringList(dynamic v) {
  if (v is List) {
    return [
      for (final item in v)
        if (item is String || item is num || item is bool) item.toString(),
    ];
  }
  return const [];
}

/// Like [safeBool] but returns null when the value is absent or of an
/// unrecognizable shape.
bool? safeBoolOrNull(dynamic v) {
  if (v == null) return null;
  if (v is bool) return v;
  if (v is num) return v != 0;
  if (v is String) {
    switch (v.toLowerCase()) {
      case 'true':
      case '1':
      case 'yes':
      case 'y':
        return true;
      case 'false':
      case '0':
      case 'no':
      case 'n':
        return false;
    }
  }
  return null;
}

/// Coerce a JSON value to [num] preserving int/double-ness: `num` passes
/// through, numeric `String` parses, anything else → [fallback].
num safeNum(dynamic v, {num fallback = 0}) {
  if (v is num) return v;
  if (v is String) return num.tryParse(v) ?? fallback;
  return fallback;
}

/// Like [safeNum] but returns null when the value is absent or unparseable.
num? safeNumOrNull(dynamic v) {
  if (v == null) return null;
  if (v is num) return v;
  if (v is String) return num.tryParse(v);
  return null;
}

/// Coerce a JSON value to a plain `List<dynamic>`: a `List` is copied,
/// anything else (null, Map, scalar) → `const []`. Drop-in replacement for
/// `(x['field'] as List?) ?? []` at screen level.
List<dynamic> safeList(dynamic v) {
  if (v is List) return List<dynamic>.of(v);
  return const [];
}

/// Coerce a JSON value to `Map<String, dynamic>`: a `Map` is copied, a JSON
/// string containing an object is decoded, anything else → `const {}`.
Map<String, dynamic> safeMap(dynamic v) {
  if (v is Map) return Map<String, dynamic>.from(v);
  return const {};
}

/// Like [safeMap] but returns null when the value is absent or not a map.
Map<String, dynamic>? safeMapOrNull(dynamic v) {
  if (v is Map) return Map<String, dynamic>.from(v);
  return null;
}

/// Parse a timestamp from `ISO-8601 String`, epoch seconds/millis `int`, or
/// numeric-string epoch; anything else (incl. null) → null.
DateTime? safeDateTime(dynamic v) {
  if (v == null) return null;
  if (v is DateTime) return v;
  if (v is String) {
    if (v.isEmpty) return null;
    final parsed = DateTime.tryParse(v);
    if (parsed != null) return parsed;
    final epoch = int.tryParse(v) ?? double.tryParse(v)?.toInt();
    if (epoch != null) return _fromEpoch(epoch);
    return null;
  }
  if (v is num) return _fromEpoch(v.toInt());
  return null;
}

DateTime _fromEpoch(int epoch) {
  // Heuristic: values below ~10^11 are seconds, above are milliseconds.
  if (epoch > 100000000000) {
    return DateTime.fromMillisecondsSinceEpoch(epoch);
  }
  return DateTime.fromMillisecondsSinceEpoch(epoch * 1000);
}

// ── Backend envelope helpers ───────────────────────────────────────────────
// Flask endpoints answer {"success": bool, "data": ..., "error": ...}. Repos
// use these to unwrap without raw `as List` / `as Map` downcasts that crash
// on a null or differently-typed `data` field.

/// True when [payload] is the standard envelope Map and reports success.
bool envelopeOk(dynamic payload) => payload is Map && payload['success'] == true;

/// Best-effort server error message from an envelope, else [fallback].
String envelopeErrorText(dynamic payload, String fallback) {
  if (payload is Map) {
    final err = payload['error'];
    if (err is String && err.isNotEmpty) return err;
    if (err != null) return err.toString();
  }
  return fallback;
}

/// The envelope's `data` field; null when the envelope itself is malformed.
dynamic envelopeData(dynamic payload) => payload is Map ? payload['data'] : null;

/// Row list from an envelope payload: `data` is a List → its Map entries
/// (non-map entries skipped); anything else → `[]` + a shape log.
List<Map<String, dynamic>> envelopeRows(dynamic payload, {String source = ''}) {
  final data = payload is Map ? payload['data'] : payload;
  if (data is List) return safeMapList(data);
  logJsonShape(source, 'expected a list payload, got ${data.runtimeType}');
  return const [];
}

/// Single object from an envelope payload: `data` is a Map → a copied
/// `Map<String, dynamic>`; anything else → null + a shape log.
Map<String, dynamic>? envelopeObject(dynamic payload, {String source = ''}) {
  final data = payload is Map ? payload['data'] : payload;
  if (data is Map) return Map<String, dynamic>.from(data);
  logJsonShape(source, 'expected an object payload, got ${data.runtimeType}');
  return null;
}
