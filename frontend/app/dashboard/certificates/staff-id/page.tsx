import { redirect } from "next/navigation";

export default function StaffIdRedirectPage() {
  redirect("/dashboard/certificates/staff");
}
