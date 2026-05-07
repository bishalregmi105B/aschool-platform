export interface PromotionAcademicYear {
  id: string;
  name: string;
  is_current?: boolean;
  start_date?: string | null;
  start_date_ad?: string | null;
  start_date_bs?: string | null;
}

export interface PromotionClassOption {
  id: string;
  name: string;
  academic_year_id?: string | null;
  numeric_grade?: number | null;
  sort_order?: number | null;
}

function getAcademicYearOrderKey(year: PromotionAcademicYear): number {
  const rawValue = year.start_date_ad || year.start_date || year.start_date_bs || year.name;
  const parsedDate = Date.parse(String(rawValue || ""));
  if (!Number.isNaN(parsedDate)) {
    return parsedDate;
  }

  const numericMatch = String(rawValue || "").match(/\d+/);
  return numericMatch ? Number(numericMatch[0]) : 0;
}

export function getNextAcademicYear(
  academicYears: PromotionAcademicYear[],
  currentYearId: string | null,
): PromotionAcademicYear | null {
  if (!academicYears.length || !currentYearId) {
    return null;
  }

  const orderedYears = [...academicYears].sort(
    (left, right) => getAcademicYearOrderKey(left) - getAcademicYearOrderKey(right),
  );
  const currentIndex = orderedYears.findIndex((year) => year.id === currentYearId);
  if (currentIndex === -1) {
    return null;
  }

  return orderedYears[currentIndex + 1] || null;
}

export function findSuggestedPromotionClass(
  sourceClass: PromotionClassOption,
  targetClasses: PromotionClassOption[],
): PromotionClassOption | null {
  const sourceNumericGrade = sourceClass.numeric_grade;
  const numericGradeTarget =
    sourceNumericGrade != null
      ? targetClasses.find((targetClass) => targetClass.numeric_grade === sourceNumericGrade + 1)
      : null;
  if (numericGradeTarget) {
    return numericGradeTarget;
  }

  const sourceOrder = sourceClass.sort_order ?? sourceNumericGrade ?? null;
  if (sourceOrder == null) {
    return null;
  }

  return (
    targetClasses.find(
      (targetClass) => (targetClass.sort_order ?? targetClass.numeric_grade ?? null) === sourceOrder + 1,
    ) || null
  );
}