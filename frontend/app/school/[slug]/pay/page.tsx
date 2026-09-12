/** Public "Pay fees without login" — guest checkout shell (S-A5 A-22). */
import { PayFlow } from "./PayFlow";
import { getPublicSite } from "@/lib/public-site";

export default async function PayPage({ params }: { params: { slug: string } }) {
  const site = await getPublicSite(params.slug);
  if (!site.ok) {
    return <div className="p-8 text-center">School not found</div>;
  }
  const schoolName = site.data.school?.name || "the school";

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
      >
        💳 Pay School Fees
      </h1>
      <p className="text-gray-600 mb-8">
        Pay {schoolName} fees online — no account needed. Find the pending bills with an
        enrollment number or guardian phone, then pay with eSewa or Khalti.
      </p>

      <PayFlow slug={params.slug} />
    </div>
  );
}
