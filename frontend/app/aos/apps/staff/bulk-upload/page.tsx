import { redirect } from "next/navigation";

export default function StaffBulkUploadPage() {
  redirect("/dashboard/bulk-uploads/csv");
}
