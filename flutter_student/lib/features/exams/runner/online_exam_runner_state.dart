import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Student-only online-exam runner state (S-A2, emulates eSchool's runner):
/// one attempt per (exam, student) with a server clock, per-question
/// autosave deltas, and auto-submit on expiry / extended absence.
enum AnswerSaveStatus { idle, pending, saving, saved, failed }

class OnlineExamRunnerState {
  final OnlineExam exam;
  final List<Question> questions;

  /// questionId → answer. `String` for single-select, `List<String>` for
  /// multi-answer questions (same shapes `_score_online_exam` accepts).
  final Map<String, dynamic> answers;
  final int currentIndex;
  final int remainingSeconds;
  final bool loading;
  final String? loadError;
  final bool submitting;
  final bool submitted;

  /// Set exactly once when a submit succeeds (or lands 409-with-score) —
  /// the screen listens for it and navigates to the result.
  final OnlineExamSubmitResult? submitResult;

  /// Transient submit failure message (network down, window closed...).
  final String? submitError;
  final AnswerSaveStatus saveStatus;
  final int savedQuestionCount;

  /// Set when the submit was fired by the clock or the away timer rather
  /// than a tap, so the result screen can explain what happened.
  final bool autoSubmitted;

  const OnlineExamRunnerState({
    required this.exam,
    this.questions = const [],
    this.answers = const {},
    this.currentIndex = 0,
    this.remainingSeconds = 0,
    this.loading = true,
    this.loadError,
    this.submitting = false,
    this.submitted = false,
    this.submitResult,
    this.submitError,
    this.saveStatus = AnswerSaveStatus.idle,
    this.savedQuestionCount = 0,
    this.autoSubmitted = false,
  });

  factory OnlineExamRunnerState.initial(OnlineExam exam) =>
      OnlineExamRunnerState(
        exam: exam,
        remainingSeconds: exam.durationMinutes * 60,
      );

  int get answeredCount => answers.values
      .where((value) => value is String
          ? value.isNotEmpty
          : value is List && value.isNotEmpty)
      .length;

  int get unansweredCount => questions.length - answeredCount;

  bool isAnswered(String questionId) {
    final value = answers[questionId];
    return value is String ? value.isNotEmpty : value is List && value.isNotEmpty;
  }

  OnlineExamRunnerState copyWith({
    List<Question>? questions,
    Map<String, dynamic>? answers,
    int? currentIndex,
    int? remainingSeconds,
    bool? loading,
    String? loadError,
    bool clearLoadError = false,
    bool? submitting,
    bool? submitted,
    OnlineExamSubmitResult? submitResult,
    String? submitError,
    bool clearSubmitError = false,
    AnswerSaveStatus? saveStatus,
    int? savedQuestionCount,
    bool? autoSubmitted,
  }) {
    return OnlineExamRunnerState(
      exam: exam,
      questions: questions ?? this.questions,
      answers: answers ?? this.answers,
      currentIndex: currentIndex ?? this.currentIndex,
      remainingSeconds: remainingSeconds ?? this.remainingSeconds,
      loading: loading ?? this.loading,
      loadError: clearLoadError ? null : (loadError ?? this.loadError),
      submitting: submitting ?? this.submitting,
      submitted: submitted ?? this.submitted,
      submitResult: submitResult ?? this.submitResult,
      submitError: clearSubmitError ? null : (submitError ?? this.submitError),
      saveStatus: saveStatus ?? this.saveStatus,
      savedQuestionCount: savedQuestionCount ?? this.savedQuestionCount,
      autoSubmitted: autoSubmitted ?? this.autoSubmitted,
    );
  }
}

/// Debounce window before an answer change is PATCHed to the server
/// (≥1.5s as per the S-A2 runner spec).
const Duration _autosaveDebounce = Duration(milliseconds: 1600);

/// eSchool anti-cheat: if the app stays paused (backgrounded / screen off)
/// for longer than this, the exam auto-submits with what has been saved.
const Duration _awayAutoSubmitAfter = Duration(seconds: 5);

class OnlineExamRunnerNotifier
    extends AutoDisposeFamilyNotifier<OnlineExamRunnerState, OnlineExam> {
  late OnlineExam _exam;
  late ExamRepository _repo;
  bool _disposed = false;

  // Timers (kept outside the immutable state).
  Timer? _clock;
  Timer? _autosaveTimer;
  Timer? _awayTimer;

  /// Deltas waiting to be persisted, including failed ones that will be
  /// retried on the next change (retry-on-next-change policy).
  final Map<String, dynamic> _dirty = {};
  bool _savingDeltas = false;

  bool _isPaused = false;

  @override
  OnlineExamRunnerState build(OnlineExam exam) {
    _exam = exam;
    // Cache the repository (a plain never-disposed Provider) so the
    // onDispose flush below never touches a disposed `ref`.
    _repo = ref.read(examRepositoryProvider);
    _disposed = false;
    ref.onDispose(_teardown);
    unawaited(_loadPaper());
    return OnlineExamRunnerState.initial(exam);
  }

  void _teardown() {
    _disposed = true;
    _clock?.cancel();
    _autosaveTimer?.cancel();
    _awayTimer?.cancel();
    // Last-chance flush so a quick back-press doesn't lose fresh answers.
    if (_dirty.isNotEmpty && !_savingDeltas) {
      final deltas = Map<String, dynamic>.of(_dirty);
      _dirty.clear();
      unawaited(Future<void>(() async {
        try {
          await _repo.autosaveAttempt(_exam.id, deltas);
        } catch (_) {
          // Best-effort only — the app is leaving the exam.
        }
      }));
    }
  }

  void _set(OnlineExamRunnerState next) {
    if (_disposed) return;
    state = next;
  }

  // ── paper load (/take) ─────────────────────────────────────────────────

  Future<void> _loadPaper() async {
    _set(state.copyWith(loading: true, clearLoadError: true));
    try {
      final paper = await _repo.takeOnlineExam(_exam.id);
      if (_disposed) return;
      final questions = paper.exam.questions;
      _set(state.copyWith(
        questions: questions,
        answers: _normalizeSavedAnswers(questions, paper.attempt?.savedAnswers),
        remainingSeconds: paper.attempt != null
            ? paper.attempt!.remainingSeconds
            : _exam.durationMinutes * 60,
        loading: false,
        clearLoadError: true,
        savedQuestionCount:
            paper.attempt?.savedAnswers.keys.length ?? 0,
      ));
      _startClock();
    } on OnlineExamAlreadySubmittedException catch (e) {
      // Attempt already closed server-side — surface it as a completed
      // result (with the server-reported score) so the screen navigates
      // to the score summary.
      if (_disposed) return;
      _set(state.copyWith(
        loading: false,
        submitted: true,
        submitResult: OnlineExamSubmitResult(
          score: e.score,
          totalMarks: _exam.totalMarks?.toDouble() ?? 0,
          status: 'submitted',
          alreadySubmitted: true,
        ),
      ));
    } on ApiException catch (e) {
      if (_disposed) return;
      _set(state.copyWith(loading: false, loadError: e.message));
    } catch (e) {
      if (_disposed) return;
      _set(state.copyWith(loading: false, loadError: e.toString()));
    }
  }

  Future<void> retryLoad() => _loadPaper();

  /// Map the server's saved answers ({questionId: value}) onto the local
  /// answer shape, honouring per-question multi-answer flags.
  Map<String, dynamic> _normalizeSavedAnswers(
      List<Question> questions, Map<String, dynamic>? saved) {
    final answers = <String, dynamic>{};
    if (saved == null || saved.isEmpty) return answers;
    for (final question in questions) {
      final value = saved[question.id];
      if (value == null) continue;
      if (question.multi) {
        answers[question.id] = value is List
            ? value.map((e) => e.toString()).toList()
            : [value.toString()];
      } else {
        answers[question.id] = value is List
            ? (value.isNotEmpty ? value.first.toString() : '')
            : value.toString();
      }
    }
    return answers;
  }

  // ── clock ───────────────────────────────────────────────────────────────

  void _startClock() {
    _clock?.cancel();
    if (_disposed || state.submitted || state.remainingSeconds <= 0) return;
    _clock = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    if (_disposed || state.submitted || state.submitting) return;
    final remaining = state.remainingSeconds - 1;
    _set(state.copyWith(remainingSeconds: remaining < 0 ? 0 : remaining));
    if (remaining <= 0) {
      _clock?.cancel();
      unawaited(_submit(auto: true));
    }
  }

  /// Re-sync the countdown from a server response (autosave returns the
  /// authoritative remaining time). Small upward drift is ignored so the
  /// countdown never visually jumps forward.
  void _syncClock(int serverSeconds) {
    if (_disposed || state.submitted) return;
    if (serverSeconds < 0) return;
    if (serverSeconds > state.remainingSeconds + 5) return;
    _set(state.copyWith(remainingSeconds: serverSeconds));
    if (serverSeconds <= 0) {
      _clock?.cancel();
      unawaited(_submit(auto: true));
    }
  }

  // ── navigation ──────────────────────────────────────────────────────────

  void setCurrentIndex(int index) {
    if (_disposed) return;
    if (state.questions.isEmpty) return;
    final clamped = index.clamp(0, state.questions.length - 1);
    if (clamped == state.currentIndex) return;
    _set(state.copyWith(currentIndex: clamped));
  }

  // ── answering + autosave ────────────────────────────────────────────────

  void selectSingleOption(String questionId, String optionId) {
    _storeAnswer(questionId, optionId);
  }

  void toggleMultiOption(String questionId, String optionId) {
    final current = state.answers[questionId];
    final selected = current is List
        ? current.map((e) => e.toString()).toList()
        : <String>[];
    if (selected.contains(optionId)) {
      selected.remove(optionId);
    } else {
      selected.add(optionId);
    }
    _storeAnswer(questionId, selected);
  }

  void clearAnswer(String questionId) {
    _storeAnswer(questionId, state.questions
            .firstWhere((q) => q.id == questionId,
                orElse: () => const Question(id: '', question: ''))
            .multi
        ? <String>[]
        : '');
  }

  void _storeAnswer(String questionId, dynamic value) {
    if (_disposed || state.submitted || state.submitting) return;
    final current = state.answers[questionId];
    // Skip no-op writes (re-tapping the same single option).
    if (current is String && current == value) return;
    final answers = Map<String, dynamic>.of(state.answers);
    answers[questionId] = value;
    _dirty[questionId] = value;
    _set(state.copyWith(
      answers: answers,
      saveStatus:
          _savingDeltas ? state.saveStatus : AnswerSaveStatus.pending,
    ));
    _scheduleAutosave();
  }

  void _scheduleAutosave() {
    _autosaveTimer?.cancel();
    _autosaveTimer = Timer(_autosaveDebounce, _flushAutosave);
  }

  Future<void> _flushAutosave() async {
    if (_disposed || state.submitted) return;
    if (_savingDeltas) {
      // A PATCH is in flight — the next tick/change will carry the deltas.
      _scheduleAutosave();
      return;
    }
    if (_dirty.isEmpty) return;
    final deltas = Map<String, dynamic>.of(_dirty);
    _dirty.clear();
    _savingDeltas = true;
    _set(state.copyWith(saveStatus: AnswerSaveStatus.saving));
    try {
      final result = await _repo.autosaveAttempt(_exam.id, deltas);
      if (_disposed) return;
      if (result.alreadySubmitted) {
        // Closed elsewhere (expiry / away) — stop autosaving; the next
        // submit call will 409 into the result flow with the score.
        _savingDeltas = false;
        _clock?.cancel();
        _set(state.copyWith(saveStatus: AnswerSaveStatus.idle));
        return;
      }
      _savingDeltas = false;
      _set(state.copyWith(
        saveStatus: AnswerSaveStatus.saved,
        savedQuestionCount: result.savedQuestionCount,
      ));
      _syncClock(result.remainingSeconds);
    } catch (e) {
      _savingDeltas = false;
      if (_disposed) return;
      // Put the failed deltas back — they ride along with the next change.
      for (final entry in deltas.entries) {
        _dirty.putIfAbsent(entry.key, () => entry.value);
      }
      _set(state.copyWith(saveStatus: AnswerSaveStatus.failed));
    }
  }

  // ── lifecycle (away auto-submit) ────────────────────────────────────────

  void onAppPaused() {
    if (_disposed || state.submitted) return;
    _isPaused = true;
    _awayTimer?.cancel();
    _awayTimer = Timer(_awayAutoSubmitAfter, () {
      if (_isPaused && !_disposed) unawaited(_submit(auto: true));
    });
  }

  void onAppResumed() {
    _isPaused = false;
    _awayTimer?.cancel();
  }

  // ── submit ──────────────────────────────────────────────────────────────

  /// Manual submit from the palette / confirm dialog. Returns true when the
  /// exam is submitted (the screen listens for [submitResult] to navigate).
  Future<bool> submitManually() async {
    await _submit(auto: false);
    return state.submitted;
  }

  Future<void> _submit({required bool auto}) async {
    if (_disposed || state.submitted || state.submitting) return;
    _clock?.cancel();
    _awayTimer?.cancel();
    _autosaveTimer?.cancel();
    _set(state.copyWith(
      submitting: true,
      clearSubmitError: true,
      autoSubmitted: auto,
    ));

    // Full local map = saved answers (prefilled from /take) + local edits,
    // i.e. exactly the merge the server applies at submit time.
    final answers = Map<String, dynamic>.of(state.answers);
    for (final entry in _dirty.entries) {
      answers[entry.key] = entry.value;
    }

    try {
      final result =
          await _repo.submitOnlineExamAttempt(_exam.id, answers);
      if (_disposed) return;
      _dirty.clear();
      _set(state.copyWith(
        submitting: false,
        submitted: true,
        submitResult: result,
      ));
    } on ApiException catch (e) {
      if (_disposed) return;
      _set(state.copyWith(submitting: false, submitError: e.message));
      _startClock(); // give the student time to retry
    } catch (e) {
      if (_disposed) return;
      _set(state.copyWith(submitting: false, submitError: e.toString()));
      _startClock();
    }
  }
}

final onlineExamRunnerProvider = NotifierProvider.autoDispose
    .family<OnlineExamRunnerNotifier, OnlineExamRunnerState, OnlineExam>(
  OnlineExamRunnerNotifier.new,
);
