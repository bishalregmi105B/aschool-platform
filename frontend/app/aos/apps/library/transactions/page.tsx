import { redirect } from "next/navigation";

export default function LibraryTransactionsRedirectPage() {
  redirect("/dashboard/library?tab=issues");
}