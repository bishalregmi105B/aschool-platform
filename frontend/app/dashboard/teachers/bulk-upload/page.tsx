import { redirect } from "next/navigation";

export default function TeacherBulkUploadPage() {
  redirect("/dashboard/bulk-uploads/csv");
}
