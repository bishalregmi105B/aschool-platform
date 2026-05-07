import { api, type ApiResponse } from "@/lib/api";

export interface TeacherDto {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  subjects?: string[];
  subject_ids?: string[];
  class_sections?: string[];
  class_section_ids?: string[];
  is_active: boolean;
  created_at: string;
}

export async function fetchTeachers() {
  const res = await api.get<ApiResponse<TeacherDto[]>>("/users?role=teacher");
  return res.data.data || [];
}

export async function createTeacher(payload: Record<string, unknown>) {
  return api.post("/users", { ...payload, role: "teacher" });
}

export async function updateTeacher(teacherId: string, payload: Record<string, unknown>) {
  return api.put(`/users/${teacherId}`, { ...payload, role: "teacher" });
}

export async function deleteTeacher(teacherId: string) {
  return api.delete(`/users/${teacherId}`);
}

export async function toggleTeacherActive(teacherId: string) {
  return api.post(`/users/${teacherId}/toggle-active`);
}
