import {
  findSuggestedPromotionClass,
  getNextAcademicYear,
} from "@/lib/promotion-utils";

describe("promotion-utils", () => {
  it("finds the next academic year after the current one", () => {
    const academicYears = [
      { id: "year-2081", name: "2081", start_date_bs: "2081-01-01", is_current: false },
      { id: "year-2082", name: "2082", start_date_bs: "2082-01-01", is_current: true },
      { id: "year-2083", name: "2083", start_date_bs: "2083-01-01", is_current: false },
    ];

    expect(getNextAcademicYear(academicYears, "year-2082")?.id).toBe("year-2083");
  });

  it("suggests the next class by numeric grade when available", () => {
    const sourceClass = {
      id: "class-1",
      name: "Grade 1",
      numeric_grade: 1,
      sort_order: 1,
    };
    const targetClasses = [
      { id: "class-2", name: "Grade 2", numeric_grade: 2, sort_order: 2 },
      { id: "class-3", name: "Grade 3", numeric_grade: 3, sort_order: 3 },
    ];

    expect(findSuggestedPromotionClass(sourceClass, targetClasses)?.id).toBe("class-2");
  });

  it("falls back to sort order when numeric grade is missing", () => {
    const sourceClass = {
      id: "class-a",
      name: "Primary A",
      numeric_grade: null,
      sort_order: 4,
    };
    const targetClasses = [
      { id: "class-b", name: "Primary B", numeric_grade: null, sort_order: 5 },
    ];

    expect(findSuggestedPromotionClass(sourceClass, targetClasses)?.id).toBe("class-b");
  });
});