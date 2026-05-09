"use client";

import { useState, type FormEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function AdmissionForm({ slug }: { slug: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSending(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      student_name: fd.get("student_name"),
      guardian_name: fd.get("guardian_name"),
      phone: fd.get("phone"),
      email: fd.get("email"),
      class_applied: fd.get("class_applied"),
      previous_school: fd.get("previous_school"),
      notes: fd.get("notes"),
    };

    try {
      const res = await fetch(
        `${API_URL}/api/v1/website/public/${slug}/admission-inquiry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit inquiry");
      } else {
        setSent(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="border rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-lg font-semibold mb-1">Inquiry Submitted!</h3>
        <p className="text-gray-600 text-sm">
          Thank you for your interest. Our admission team will contact you shortly.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-4 text-sm underline"
          style={{ color: "var(--color-primary)" }}
        >
          Submit another inquiry
        </button>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--color-primary)" }}>
        Admission Inquiry Form
      </h2>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Student&apos;s Full Name *</label>
            <input
              name="student_name"
              type="text"
              required
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="विद्यार्थीको नाम"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Guardian&apos;s Name *</label>
            <input
              name="guardian_name"
              type="text"
              required
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="अभिभावकको नाम"
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number *</label>
            <input
              name="phone"
              type="tel"
              required
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="+977 98XXXXXXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              name="email"
              type="email"
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="email@example.com"
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Applying for Class *</label>
            <select name="class_applied" className="w-full border rounded-md px-3 py-2 text-sm" required>
              <option value="">Select class...</option>
              <option value="nursery">Nursery</option>
              <option value="lkg">LKG</option>
              <option value="ukg">UKG</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={`class-${i + 1}`}>
                  Class {i + 1}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Previous School</label>
            <input
              name="previous_school"
              type="text"
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Previous school name"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Additional Notes</label>
          <textarea
            name="notes"
            className="w-full border rounded-md px-3 py-2 text-sm"
            rows={3}
            placeholder="Any special requirements or questions..."
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full py-3 rounded-md text-white font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {sending ? "Submitting..." : "Submit Inquiry"}
        </button>
      </form>
    </div>
  );
}
