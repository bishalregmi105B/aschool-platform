export interface MarksConfigSubject {
  full_marks?: number | null;
  pass_marks?: number | null;
  has_practical?: boolean | null;
  practical_full_marks?: number | null;
  practical_pass_marks?: number | null;
}

export interface MarksConfigExam {
  total_marks?: number | null;
  full_marks?: number | null;
  pass_marks?: number | null;
  is_practical?: boolean | null;
  practical_marks?: number | null;
}

export interface ResolvedMarksConfig {
  hasPractical: boolean;
  usesSubjectPracticalConfig: boolean;
  theoryFullMarks: number;
  theoryPassMarks: number | null;
  practicalFullMarks: number;
  practicalPassMarks: number | null;
  totalFullMarks: number;
  totalPassMarks: number;
}

export function resolveExamMarkConfig(
  subject?: MarksConfigSubject | null,
  exam?: MarksConfigExam | null,
): ResolvedMarksConfig {
  const hasPractical = Boolean(subject?.has_practical ?? exam?.is_practical ?? false);
  const subjectPracticalFull = Number(subject?.practical_full_marks ?? 0);
  const usesSubjectPracticalConfig = hasPractical && subjectPracticalFull > 0;

  if (usesSubjectPracticalConfig) {
    const theoryFullMarks = Number(subject?.full_marks ?? 0);
    const theoryPassMarks = Number(subject?.pass_marks ?? 0);
    const practicalFullMarks = subjectPracticalFull;
    const practicalPassMarks = Number(subject?.practical_pass_marks ?? 0);

    return {
      hasPractical: true,
      usesSubjectPracticalConfig: true,
      theoryFullMarks,
      theoryPassMarks,
      practicalFullMarks,
      practicalPassMarks,
      totalFullMarks: theoryFullMarks + practicalFullMarks,
      totalPassMarks: theoryPassMarks + practicalPassMarks,
    };
  }

  const totalFullMarks = Number(subject?.full_marks ?? exam?.total_marks ?? exam?.full_marks ?? 100);
  const totalPassMarks = Number(subject?.pass_marks ?? exam?.pass_marks ?? 32);
  const practicalFullMarks = hasPractical
    ? Math.min(Number(exam?.practical_marks ?? Math.round(totalFullMarks * 0.2)), totalFullMarks)
    : 0;

  return {
    hasPractical,
    usesSubjectPracticalConfig: false,
    theoryFullMarks: hasPractical ? Math.max(totalFullMarks - practicalFullMarks, 0) : totalFullMarks,
    theoryPassMarks: null,
    practicalFullMarks,
    practicalPassMarks: null,
    totalFullMarks,
    totalPassMarks,
  };
}

export function isPassingResolvedMarksConfig(
  config: ResolvedMarksConfig,
  theoryMarks: number,
  practicalMarks = 0,
) {
  if (config.usesSubjectPracticalConfig) {
    const theoryPass = config.theoryPassMarks == null || theoryMarks >= config.theoryPassMarks;
    const practicalPass =
      config.practicalFullMarks <= 0 ||
      config.practicalPassMarks == null ||
      practicalMarks >= config.practicalPassMarks;
    return theoryPass && practicalPass;
  }

  return theoryMarks + practicalMarks >= config.totalPassMarks;
}