import { redirect } from "next/navigation";

export default function StudentIdRedirectPage() {
  redirect("/dashboard/certificates/students");
}
