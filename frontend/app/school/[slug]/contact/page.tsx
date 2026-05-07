/** Public Contact Page — form + OpenStreetMap */
import { ContactForm } from "./ContactForm";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return (await res.json()).data;
}

export default async function ContactPage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center">School not found</div>;

  const { school } = data;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1
        className="text-3xl font-bold mb-8"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
      >
        📞 Contact Us
      </h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Contact Info */}
        <div className="space-y-6">
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--color-primary)" }}>
              Get in Touch
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-xl">📍</span>
                <div>
                  <p className="font-medium">Address</p>
                  <p className="text-gray-600">{school.municipality}, {school.district}, Nepal</p>
                </div>
              </div>
              {school.phone && (
                <div className="flex items-start gap-3">
                  <span className="text-xl">📞</span>
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-gray-600">{school.phone}</p>
                  </div>
                </div>
              )}
              {school.email && (
                <div className="flex items-start gap-3">
                  <span className="text-xl">📧</span>
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-gray-600">{school.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2" style={{ color: "var(--color-primary)" }}>
              Office Hours
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Sunday - Friday: 10:00 AM - 4:00 PM</li>
              <li>Saturday: Closed</li>
            </ul>
          </div>
        </div>

        {/* Contact Form */}
        <ContactForm slug={params.slug} />
      </div>
    </div>
  );
}
