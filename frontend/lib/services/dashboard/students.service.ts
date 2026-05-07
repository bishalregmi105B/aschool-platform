import { api } from "@/lib/api";

export async function fetchStudentById(studentId: string) {
  const res = await api.get(`/students/${studentId}`);
  return res.data?.data;
}

export async function fetchStudentFeeCollections(studentId: string) {
  const res = await api.get("/fees/collections", { params: { student_id: studentId } });
  return res.data?.data || [];
}

export async function fetchStudentAttendance(studentId: string) {
  const res = await api.get("/attendance/list", { params: { student_id: studentId } });
  return res.data?.data || [];
}
