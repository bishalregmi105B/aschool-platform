import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aschool_shared/aschool_shared.dart';

final marksDropdownsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final results = await Future.wait([
    ApiClient.instance.get('/teacher/my-classes'),
    ApiClient.instance.get('/exams?status=ongoing,completed'),
  ]);

  final exams = List<Map<String, dynamic>>.from(results[1].data['data'] ?? [])
    ..removeWhere(
      (exam) => exam['status']?.toString() == 'result_published',
    );

  return {
    'classes': List<Map<String, dynamic>>.from(results[0].data['data'] ?? []),
    'exams': exams,
  };
});

final examSubjectsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, ({String examId, String classId})>(
        (ref, args) async {
  final resp = await ApiClient.instance
      .get('/exams/${args.examId}/subjects?class_id=${args.classId}');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? []);
});

final marksStudentsProvider = FutureProvider.autoDispose.family<
    List<_StudentMark>,
    ({String examId, String classId, String subjectId})>((ref, args) async {
  final resp = await ApiClient.instance.get(
      '/exams/${args.examId}/marks?class_id=${args.classId}&subject_id=${args.subjectId}');
  return List<Map<String, dynamic>>.from(resp.data['data'] ?? [])
      .map((student) => _StudentMark(
            id: student['student_id']?.toString() ?? '',
            name: student['name']?.toString() ?? '',
            rollNo: student['roll_no'] as int? ?? 0,
            theoryMarks: (student['theory_marks'] as num?)?.toDouble(),
            practicalMarks: (student['practical_marks'] as num?)?.toDouble(),
            fullMarks: (student['full_marks'] as num?)?.toDouble() ?? 100,
            passMarks: (student['pass_marks'] as num?)?.toDouble() ?? 32,
            hasPractical: student['has_practical'] == true,
          ))
      .toList();
});

class _MarksEntryNotifier
    extends StateNotifier<AsyncValue<List<_StudentMark>>> {
  final Ref ref;

  _MarksEntryNotifier(this.ref) : super(const AsyncData([]));

  void setStudents(List<_StudentMark> students) {
    state = AsyncData(students
        .map((student) => _StudentMark(
              id: student.id,
              name: student.name,
              rollNo: student.rollNo,
              theoryMarks: student.theoryMarks,
              practicalMarks: student.practicalMarks,
              fullMarks: student.fullMarks,
              passMarks: student.passMarks,
              hasPractical: student.hasPractical,
            ))
        .toList());
  }

  void updateMarks(
    int index, {
    bool updateTheory = false,
    double? theoryMarks,
    bool updatePractical = false,
    double? practicalMarks,
  }) {
    state.whenData((students) {
      final updated = List<_StudentMark>.from(students);
      final current = updated[index];
      updated[index] = current.copyWith(
        theoryMarks: updateTheory ? theoryMarks : current.theoryMarks,
        practicalMarks:
            updatePractical ? practicalMarks : current.practicalMarks,
      );
      state = AsyncData(updated);
    });
  }

  Future<void> submit(String examId, String classId, String subjectId) async {
    final students = state.value ?? [];
    try {
      await ApiClient.instance.post('/exams/$examId/marks', data: {
        'class_id': classId,
        'subject_id': subjectId,
        'marks': students
            .where(
              (student) =>
                  student.theoryMarks != null || student.practicalMarks != null,
            )
            .map((student) => {
                  'student_id': student.id,
                  'theory_marks': student.theoryMarks ?? 0,
                  'practical_marks': student.practicalMarks ?? 0,
                  'full_marks': student.fullMarks,
                  'pass_marks': student.passMarks,
                })
            .toList(),
      });
    } catch (e) {
      throw Exception('Failed to submit marks');
    }
  }
}

final marksEntryProvider = StateNotifierProvider.autoDispose<
    _MarksEntryNotifier, AsyncValue<List<_StudentMark>>>((ref) {
  return _MarksEntryNotifier(ref);
});

class MarksEntryScreen extends ConsumerStatefulWidget {
  const MarksEntryScreen({super.key});

  @override
  ConsumerState<MarksEntryScreen> createState() => _MarksEntryScreenState();
}

class _MarksEntryScreenState extends ConsumerState<MarksEntryScreen> {
  String? _selectedClass;
  String? _selectedExam;
  String? _selectedSubject;
  Map<String, dynamic>? _selectedExamMeta;
  Map<String, dynamic>? _selectedSubjectMeta;
  bool _submitting = false;
  bool _loadingStudents = false;
  int _editorVersion = 0;

  void _onClassOrExamChanged() {
    setState(() {
      _selectedSubject = null;
      _selectedSubjectMeta = null;
      _editorVersion++;
    });
    ref.read(marksEntryProvider.notifier).setStudents([]);
  }

  Future<void> _loadStudents() async {
    if (_selectedClass == null ||
        _selectedExam == null ||
        _selectedSubject == null) {
      return;
    }

    final examId = _selectedExam!;
    final classId = _selectedClass!;
    final subjectId = _selectedSubject!;

    setState(() => _loadingStudents = true);
    try {
      final asyncStudents = await ref.read(marksStudentsProvider((
        examId: examId,
        classId: classId,
        subjectId: subjectId,
      )).future);

      if (!mounted ||
          examId != _selectedExam ||
          classId != _selectedClass ||
          subjectId != _selectedSubject) {
        return;
      }

      ref.read(marksEntryProvider.notifier).setStudents(asyncStudents);
      setState(() => _editorVersion++);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Could not load marks for the selected class.'),
          backgroundColor: Colors.red,
        ));
      }
    } finally {
      if (mounted) setState(() => _loadingStudents = false);
    }
  }

  bool _usesPractical(_StudentMark student) {
    return (_selectedExamMeta?['is_practical'] == true) ||
        (_selectedSubjectMeta?['has_practical'] == true) ||
        student.hasPractical;
  }

  double _practicalLimit(_StudentMark student) {
    if (!_usesPractical(student)) return 0;
    return double.parse((student.fullMarks * 0.2).toStringAsFixed(1));
  }

  double _theoryLimit(_StudentMark student) {
    if (!_usesPractical(student)) return student.fullMarks;
    return double.parse(
      (student.fullMarks - _practicalLimit(student)).toStringAsFixed(1),
    );
  }

  String? _validateMarks() {
    final students = ref.read(marksEntryProvider).value ?? [];
    var hasAnyValue = false;

    for (final student in students) {
      final theory = student.theoryMarks ?? 0;
      final practical = student.practicalMarks ?? 0;
      final entered =
          student.theoryMarks != null || student.practicalMarks != null;

      if (!entered) continue;
      hasAnyValue = true;

      if (theory < 0 || practical < 0) {
        return 'Marks cannot be negative.';
      }

      final theoryLimit = _theoryLimit(student);
      final practicalLimit = _practicalLimit(student);

      if (theory > theoryLimit) {
        return '${student.name}: theory marks cannot exceed ${_formatMark(theoryLimit)}.';
      }

      if (_usesPractical(student) && practical > practicalLimit) {
        return '${student.name}: practical marks cannot exceed ${_formatMark(practicalLimit)}.';
      }

      if (!_usesPractical(student) && practical > 0) {
        return '${student.name}: practical marks are not enabled for this subject.';
      }

      if (theory + practical > student.fullMarks) {
        return '${student.name}: total marks cannot exceed ${_formatMark(student.fullMarks)}.';
      }
    }

    if (!hasAnyValue) {
      return 'Enter marks for at least one student before saving.';
    }

    return null;
  }

  Future<void> _save() async {
    if (_selectedClass == null ||
        _selectedExam == null ||
        _selectedSubject == null) {
      return;
    }

    final validationError = _validateMarks();
    if (validationError != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(validationError),
        backgroundColor: Colors.red,
      ));
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => ESchoolDialog(
        icon: Icons.rule_folder_outlined,
        title: 'Save Marks?',
        subtitle: 'You can still revise marks before final publication.',
        actions: [
          ESchoolSecondaryButton(
            label: 'Cancel',
            onPressed: () => Navigator.pop(dialogContext, false),
          ),
          ESchoolPrimaryButton(
            label: 'Save',
            icon: Icons.save_outlined,
            onPressed: () => Navigator.pop(dialogContext, true),
          ),
        ],
        child: const Text(
          'Ensure all entered marks are correct before saving. You can update them later if exam results are not yet published.',
        ),
      ),
    );

    if (confirmed != true) return;

    setState(() => _submitting = true);
    try {
      await ref
          .read(marksEntryProvider.notifier)
          .submit(_selectedExam!, _selectedClass!, _selectedSubject!);

      ref.invalidate(marksStudentsProvider((
        examId: _selectedExam!,
        classId: _selectedClass!,
        subjectId: _selectedSubject!,
      )));
      await _loadStudents();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Marks saved successfully!'),
          backgroundColor: Colors.green,
        ));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Failed to save marks. Please check your connection.'),
          backgroundColor: Colors.red,
        ));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          _buildSelectors(),
          const Divider(height: 1),
          Expanded(child: _buildMarksList()),
        ],
      ),
      bottomNavigationBar: _selectedSubject != null ? _buildBottomBar() : null,
    );
  }

  Widget _buildSelectors() {
    final dropdownsState = ref.watch(marksDropdownsProvider);

    return dropdownsState.when(
      loading: () => const Padding(
          padding: EdgeInsets.all(16), child: ShimmerLoadingList()),
      error: (err, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: ErrorContainer(
            errorMessage: err.toString(),
            onRetry: () => ref.refresh(marksDropdownsProvider.future)),
      ),
      data: (data) {
        final exams = data['exams'] as List<Map<String, dynamic>>;
        final classes = data['classes'] as List<Map<String, dynamic>>;

        return Container(
          color: Colors.white,
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _buildDropdown<String>(
                      label: 'Exam',
                      value: _selectedExam,
                      items: exams
                          .map((exam) => DropdownMenuItem(
                                value: exam['id']?.toString(),
                                child: Text(exam['name']?.toString() ?? ''),
                              ))
                          .toList(),
                      onChanged: (value) {
                        setState(() {
                          _selectedExam = value;
                          _selectedExamMeta = _findById(exams, value);
                        });
                        _onClassOrExamChanged();
                      },
                      icon: Icons.quiz_rounded,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildDropdown<String>(
                      label: 'Class Section',
                      value: _selectedClass,
                      items: classes
                          .map((klass) => DropdownMenuItem(
                                value: klass['id']?.toString(),
                                child: Text(klass['name']?.toString() ?? ''),
                              ))
                          .toList(),
                      onChanged: (value) {
                        setState(() => _selectedClass = value);
                        _onClassOrExamChanged();
                      },
                      icon: Icons.class_rounded,
                    ),
                  ),
                ],
              ),
              if (_selectedExam != null && _selectedClass != null) ...[
                const SizedBox(height: 16),
                _buildSubjectSelector(),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildSubjectSelector() {
    final subjectsState = ref.watch(examSubjectsProvider(
        (examId: _selectedExam!, classId: _selectedClass!)));

    return subjectsState.when(
      loading: () => const Center(
          child: Padding(
              padding: EdgeInsets.all(8.0),
              child: CircularProgressIndicator())),
      error: (err, _) => Text('Error loading subjects',
          style: TextStyle(color: Colors.red.shade400)),
      data: (subjects) {
        if (subjects.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 8.0),
            child: Text('No subjects found for this exam/class.',
                style: TextStyle(color: Colors.grey)),
          );
        }
        return _buildDropdown<String>(
          label: 'Subject',
          value: _selectedSubject,
          items: subjects
              .map((subject) => DropdownMenuItem(
                    value: subject['id']?.toString(),
                    child: Text(subject['name']?.toString() ?? ''),
                  ))
              .toList(),
          onChanged: (value) {
            setState(() {
              _selectedSubject = value;
              _selectedSubjectMeta = _findById(subjects, value);
              _editorVersion++;
            });
            _loadStudents();
          },
          icon: Icons.book_rounded,
        );
      },
    );
  }

  Widget _buildDropdown<T>({
    required String label,
    required T? value,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
    required IconData icon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(icon, size: 18, color: ASchoolTheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<T>(
                    value: value,
                    isExpanded: true,
                    hint: Text('Select $label',
                        style: TextStyle(
                            fontSize: 14, color: Colors.grey.shade400)),
                    items: items,
                    onChanged: onChanged,
                    dropdownColor: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMarksList() {
    if (_selectedSubject == null) {
      return const Center(
        child: NoDataContainer(
          title: 'Select a Subject',
          subtitle:
              'Please select an exam, class, and subject to begin entering marks.',
          icon: Icons.assignment_rounded,
        ),
      );
    }

    final studentsState = ref.watch(marksEntryProvider);
    final students = studentsState.value ?? [];
    final showPractical = students.any(_usesPractical) ||
        _selectedExamMeta?['is_practical'] == true ||
        _selectedSubjectMeta?['has_practical'] == true;

    if (_loadingStudents && students.isEmpty) {
      return const Padding(
          padding: EdgeInsets.all(16), child: ShimmerLoadingList());
    }

    if (students.isEmpty) {
      return const Center(
        child: NoDataContainer(
          title: 'No Students Found',
          subtitle: 'There are no students enrolled in this class.',
          icon: Icons.people_alt_rounded,
        ),
      );
    }

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          color: Colors.grey.shade50,
          child: Row(
            children: [
              const SizedBox(
                  width: 32,
                  child: Text('Roll',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                          fontSize: 12))),
              const Expanded(
                  child: Text('STUDENT NAME',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                          fontSize: 12))),
              Text(
                showPractical ? 'T / P' : 'MARKS',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.grey,
                  fontSize: 12,
                ),
              ),
              const SizedBox(width: 12),
              const SizedBox(
                width: 78,
                child: Text('TOTAL',
                    textAlign: TextAlign.right,
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                        fontSize: 12)),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: students.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) =>
                _markRow(index, showPractical: showPractical),
          ),
        ),
      ],
    );
  }

  Widget _markRow(int index, {required bool showPractical}) {
    final students = ref.read(marksEntryProvider).value ?? [];
    final student = students[index];
    final usesPractical = _usesPractical(student);
    final total = student.totalMarks;
    final hasEntered =
        student.theoryMarks != null || student.practicalMarks != null;
    final isFailing = hasEntered && total < student.passMarks;
    final grade = hasEntered && student.fullMarks > 0
        ? _nebGrade(total / student.fullMarks * 100)
        : null;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 32,
            child: Text('${student.rollNo}',
                style: TextStyle(
                    color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(student.name,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w500),
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text(
                  'Pass ${_formatMark(student.passMarks)} / Full ${_formatMark(student.fullMarks)}',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade500,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _markField(
                    key: ValueKey('theory-$_editorVersion-${student.id}'),
                    label: showPractical ? 'T' : 'M',
                    initialValue: _editableMarkText(student.theoryMarks),
                    onChanged: (value) {
                      ref.read(marksEntryProvider.notifier).updateMarks(
                            index,
                            updateTheory: true,
                            theoryMarks: _parseMark(value),
                          );
                    },
                    maxValue: _theoryLimit(student),
                    highlight: isFailing,
                  ),
                  if (showPractical) ...[
                    const SizedBox(width: 8),
                    _markField(
                      key: ValueKey('practical-$_editorVersion-${student.id}'),
                      label: 'P',
                      initialValue: _editableMarkText(student.practicalMarks),
                      onChanged: (value) {
                        ref.read(marksEntryProvider.notifier).updateMarks(
                              index,
                              updatePractical: true,
                              practicalMarks: _parseMark(value),
                            );
                      },
                      maxValue: usesPractical ? _practicalLimit(student) : 0,
                      enabled: usesPractical,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color:
                          isFailing ? Colors.red.shade50 : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '${_formatMark(total)}/${_formatMark(student.fullMarks)}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: isFailing ? Colors.red.shade700 : Colors.black87,
                      ),
                    ),
                  ),
                  if (grade != null) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: grade.background,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '${grade.grade} ${grade.gpa.toStringAsFixed(1)}',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          color: grade.foreground,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _markField({
    required Key key,
    required String label,
    required String initialValue,
    required ValueChanged<String> onChanged,
    required double maxValue,
    bool highlight = false,
    bool enabled = true,
  }) {
    return SizedBox(
      width: 58,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: enabled ? Colors.grey.shade600 : Colors.grey.shade400,
              ),
            ),
          ),
          TextFormField(
            key: key,
            enabled: enabled,
            initialValue: initialValue,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textAlign: TextAlign.center,
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
            ],
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 14,
              color: highlight ? Colors.red.shade700 : Colors.black87,
            ),
            decoration: InputDecoration(
              isDense: true,
              hintText: enabled ? '-' : 'N/A',
              helperText: enabled ? _formatMark(maxValue) : '0',
              helperStyle: TextStyle(
                fontSize: 10,
                color: Colors.grey.shade500,
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              filled: true,
              fillColor: !enabled
                  ? Colors.grey.shade100
                  : highlight
                      ? Colors.red.shade50
                      : Colors.grey.shade50,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                  color: highlight ? Colors.red.shade200 : Colors.grey.shade300,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                  color: highlight ? Colors.red.shade200 : Colors.grey.shade300,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide:
                    const BorderSide(color: ASchoolTheme.primary, width: 2),
              ),
            ),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    final usesPractical = _selectedExamMeta?['is_practical'] == true ||
        _selectedSubjectMeta?['has_practical'] == true;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: 54,
          child: FilledButton.icon(
            onPressed: _submitting ? null : _save,
            icon:
                _submitting ? const SizedBox() : const Icon(Icons.save_rounded),
            label: _submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : Text(
                    usesPractical ? 'Save Theory & Practical' : 'Save Marks',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold),
                  ),
            style: FilledButton.styleFrom(
              backgroundColor: ASchoolTheme.primary,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ),
    );
  }
}

class _StudentMark {
  final String id;
  final String name;
  final int rollNo;
  final double? theoryMarks;
  final double? practicalMarks;
  final double fullMarks;
  final double passMarks;
  final bool hasPractical;

  _StudentMark({
    required this.id,
    required this.name,
    required this.rollNo,
    this.theoryMarks,
    this.practicalMarks,
    required this.fullMarks,
    required this.passMarks,
    required this.hasPractical,
  });

  double get totalMarks => (theoryMarks ?? 0) + (practicalMarks ?? 0);

  _StudentMark copyWith({
    double? theoryMarks,
    double? practicalMarks,
  }) {
    return _StudentMark(
      id: id,
      name: name,
      rollNo: rollNo,
      theoryMarks: theoryMarks,
      practicalMarks: practicalMarks,
      fullMarks: fullMarks,
      passMarks: passMarks,
      hasPractical: hasPractical,
    );
  }
}

Map<String, dynamic>? _findById(List<Map<String, dynamic>> rows, String? id) {
  for (final row in rows) {
    if (row['id']?.toString() == id) return row;
  }
  return null;
}

double? _parseMark(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  return double.tryParse(trimmed);
}

String _editableMarkText(double? value) {
  if (value == null) return '';
  return _formatMark(value);
}

String _formatMark(double value) {
  if (value == value.roundToDouble()) {
    return value.toStringAsFixed(0);
  }
  return value.toStringAsFixed(1);
}

_NebGrade _nebGrade(double percentage) {
  if (percentage >= 90) {
    return _NebGrade(
        'A+', 4.0, const Color(0xFF166534), const Color(0xFFDCFCE7));
  }
  if (percentage >= 80) {
    return _NebGrade(
        'A', 3.6, const Color(0xFF15803D), const Color(0xFFDCFCE7));
  }
  if (percentage >= 70) {
    return _NebGrade(
        'B+', 3.2, const Color(0xFF1D4ED8), const Color(0xFFDBEAFE));
  }
  if (percentage >= 60) {
    return _NebGrade(
        'B', 2.8, const Color(0xFF0369A1), const Color(0xFFE0F2FE));
  }
  if (percentage >= 50) {
    return _NebGrade(
        'C+', 2.4, const Color(0xFFA16207), const Color(0xFFFEF3C7));
  }
  if (percentage >= 40) {
    return _NebGrade(
        'C', 2.0, const Color(0xFFB45309), const Color(0xFFFDE68A));
  }
  if (percentage >= 35) {
    return _NebGrade(
        'D', 1.6, const Color(0xFFB45309), const Color(0xFFFDE68A));
  }
  return _NebGrade('NG', 0.0, const Color(0xFFB91C1C), const Color(0xFFFEE2E2));
}

class _NebGrade {
  final String grade;
  final double gpa;
  final Color foreground;
  final Color background;

  const _NebGrade(this.grade, this.gpa, this.foreground, this.background);
}
