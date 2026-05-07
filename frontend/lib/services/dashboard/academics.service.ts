import { api, type ApiResponse } from "@/lib/api";

export interface AcademicYearDto {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface SectionDto {
  id: string;
  name: string;
  capacity: number | null;
  class_teacher_id?: string | null;
}

export interface ClassDto {
  id: string;
  name: string;
  name_nepali?: string;
  numeric_grade: number | null;
  sections: SectionDto[];
}

export interface SubjectDto {
  id: string;
  name: string;
  code: string;
  credit_hours: number;
  is_optional: boolean;
  full_marks?: number | null;
  pass_marks?: number | null;
  has_practical?: boolean;
  practical_full_marks?: number | null;
  practical_pass_marks?: number | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  class_ids?: string[];
}

export async function fetchAcademicYears() {
  const res = await api.get<ApiResponse<AcademicYearDto[]>>("/academics/years");
  return res.data.data || [];
}

export async function createAcademicYear(payload: Record<string, unknown>) {
  return api.post("/academics/years", payload);
}

export async function updateAcademicYear(yearId: string, payload: Record<string, unknown>) {
  return api.put(`/academics/years/${yearId}`, payload);
}

export async function deleteAcademicYear(yearId: string) {
  return api.delete(`/academics/years/${yearId}`);
}

export async function fetchClasses() {
  const res = await api.get<ApiResponse<ClassDto[]>>("/academics/classes");
  return res.data.data || [];
}

export async function createClass(payload: Record<string, unknown>) {
  const res = await api.post<ApiResponse<ClassDto>>("/academics/classes", payload);
  return res.data.data;
}

export async function updateClass(classId: string, payload: Record<string, unknown>) {
  return api.put(`/academics/classes/${classId}`, payload);
}

export async function deleteClass(classId: string) {
  return api.delete(`/academics/classes/${classId}`);
}

export async function createSection(classId: string, payload: Record<string, unknown>) {
  return api.post(`/academics/classes/${classId}/sections`, payload);
}

export async function updateSection(classId: string, sectionId: string, payload: Record<string, unknown>) {
  return api.put(`/academics/classes/${classId}/sections/${sectionId}`, payload);
}

export async function deleteSection(classId: string, sectionId: string) {
  return api.delete(`/academics/classes/${classId}/sections/${sectionId}`);
}

export async function fetchSubjects() {
  const res = await api.get<ApiResponse<SubjectDto[]>>("/academics/subjects");
  return res.data.data || [];
}

export async function createSubject(payload: Record<string, unknown>) {
  return api.post("/academics/subjects", payload);
}

export async function updateSubject(subjectId: string, payload: Record<string, unknown>) {
  return api.put(`/academics/subjects/${subjectId}`, payload);
}

export async function deleteSubject(subjectId: string) {
  return api.delete(`/academics/subjects/${subjectId}`);
}

export async function fetchClassSubjects(classId: string) {
  const res = await api.get<ApiResponse<SubjectDto[]>>(`/academics/classes/${classId}/subjects`);
  return res.data.data || [];
}

export async function assignSubjectToClass(classId: string, subjectId: string) {
  return api.post(`/academics/classes/${classId}/subjects`, { subject_id: subjectId });
}

export async function fetchTeachers() {
  const res = await api.get<ApiResponse<any[]>>("/users?role=teacher");
  return res.data.data || [];
}
