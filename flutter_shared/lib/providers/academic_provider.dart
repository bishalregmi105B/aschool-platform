import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'repository_providers.dart';

class AcademicData {
  final List<AcademicYear> years;
  final List<ClassModel> classes;
  final List<Subject> subjects;

  const AcademicData({
    this.years = const [],
    this.classes = const [],
    this.subjects = const [],
  });
}

class AcademicNotifier extends AsyncNotifier<AcademicData> {
  @override
  Future<AcademicData> build() async {
    return _fetchData();
  }

  Future<AcademicData> _fetchData() async {
    final repo = ref.read(academicRepositoryProvider);
    
    final years = await repo.getYears();
    final classes = await repo.getClasses();
    final subjects = await repo.getSubjects();

    return AcademicData(
      years: years,
      classes: classes,
      subjects: subjects,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchData());
  }
}

final academicProvider = AsyncNotifierProvider<AcademicNotifier, AcademicData>(() {
  return AcademicNotifier();
});
