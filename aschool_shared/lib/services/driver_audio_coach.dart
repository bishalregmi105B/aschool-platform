import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

/// Audio coaching for the driver flow (R7.7 / D1, SBT pattern).
///
/// Speaks short cues at run-state transitions with a 5-second replay
/// throttle (SBT: repeated prompts at every rebuild are worse than none).
/// Failure is silent — audio is an enhancement, never a blocker: TTS may be
/// unavailable on the device or the language voice may be missing.
class DriverAudioCoach {
  DriverAudioCoach._();
  static final DriverAudioCoach instance = DriverAudioCoach._();

  FlutterTts? _tts;
  DateTime? _lastSpokenAt;
  String? _lastPhrase;

  /// Initialize lazily; returns false when TTS is unavailable.
  Future<bool> _ensure() async {
    if (_tts != null) return true;
    try {
      final tts = FlutterTts();
      await tts.setLanguage('en-US');
      await tts.setSpeechRate(0.5);
      await tts.setVolume(1.0);
      _tts = tts;
      return true;
    } catch (e) {
      debugPrint('DriverAudioCoach: TTS unavailable ($e)');
      return false;
    }
  }

  /// Speak a phrase, throttled: the same phrase within [throttle] is
  /// dropped (rebuild storms must not re-announce a stop).
  Future<void> say(String phrase, {Duration throttle = const Duration(seconds: 5)}) async {
    final now = DateTime.now();
    if (_lastPhrase == phrase &&
        _lastSpokenAt != null &&
        now.difference(_lastSpokenAt!) < throttle) {
      return;
    }
    if (!await _ensure()) return;
    try {
      _lastPhrase = phrase;
      _lastSpokenAt = now;
      await _tts!.speak(phrase);
    } catch (e) {
      debugPrint('DriverAudioCoach: speak failed ($e)');
    }
  }

  /// Run lifecycle cues.
  Future<void> runStarted() => say('Run started. Drive safe.');
  Future<void> runEnded() => say('Run completed. Well done.');

  /// Stop-level cues — the driver's eyes stay on the road.
  Future<void> approachingStop(String stopName) =>
      say('Approaching $stopName. $stopName is next.');
  Future<void> studentBoarded(String name) => say('$name boarded.');
  Future<void> studentMissed(String name) => say('$name did not show up.');
  Future<void> droppedOff(String stopName) => say('Dropped off at $stopName.');

  void dispose() {
    _tts?.stop();
    _tts = null;
  }
}
