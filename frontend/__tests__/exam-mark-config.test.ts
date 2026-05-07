import {
  isPassingResolvedMarksConfig,
  resolveExamMarkConfig,
} from "@/lib/exam-mark-config";

describe("resolveExamMarkConfig", () => {
  it("prefers subject practical full/pass marks when configured", () => {
    const config = resolveExamMarkConfig(
      {
        full_marks: 75,
        pass_marks: 27,
        has_practical: true,
        practical_full_marks: 25,
        practical_pass_marks: 10,
      },
      {
        total_marks: 100,
        pass_marks: 35,
        is_practical: true,
        practical_marks: 20,
      },
    );

    expect(config).toEqual({
      hasPractical: true,
      usesSubjectPracticalConfig: true,
      theoryFullMarks: 75,
      theoryPassMarks: 27,
      practicalFullMarks: 25,
      practicalPassMarks: 10,
      totalFullMarks: 100,
      totalPassMarks: 37,
    });
    expect(isPassingResolvedMarksConfig(config, 27, 10)).toBe(true);
    expect(isPassingResolvedMarksConfig(config, 27, 9)).toBe(false);
  });

  it("falls back to the legacy exam-level practical split", () => {
    const config = resolveExamMarkConfig(
      {
        full_marks: 100,
        pass_marks: 35,
        has_practical: true,
      },
      {
        total_marks: 100,
        pass_marks: 35,
        is_practical: true,
        practical_marks: 20,
      },
    );

    expect(config.usesSubjectPracticalConfig).toBe(false);
    expect(config.theoryFullMarks).toBe(80);
    expect(config.practicalFullMarks).toBe(20);
    expect(isPassingResolvedMarksConfig(config, 20, 15)).toBe(true);
  });

  it("supports theory-only subjects", () => {
    const config = resolveExamMarkConfig(
      {
        full_marks: 75,
        pass_marks: 27,
        has_practical: false,
      },
      {
        total_marks: 100,
        pass_marks: 35,
        is_practical: false,
      },
    );

    expect(config).toEqual({
      hasPractical: false,
      usesSubjectPracticalConfig: false,
      theoryFullMarks: 75,
      theoryPassMarks: null,
      practicalFullMarks: 0,
      practicalPassMarks: null,
      totalFullMarks: 75,
      totalPassMarks: 27,
    });
  });
});