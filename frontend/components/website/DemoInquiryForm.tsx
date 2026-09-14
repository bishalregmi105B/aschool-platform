"use client";

/**
 * DemoInquiryForm — the landing page's contact section.
 *
 * It used to be a dead form: <form> with no handler, so pressing "Send
 * Inquiry" silently did nothing (fabricated trust — the submit was theatre).
 * No platform-level public inquiry endpoint exists on the API (checked
 * app/api/v1: contact/demo POSTs are school-slug scoped), so the honest
 * wiring is a mailto compose pre-filled from the fields — clearly labelled.
 */

import { useState, type FormEvent } from "react";

const CONTACT_EMAIL = "info@brighternepal.com";

export function DemoInquiryForm() {
  const [schoolName, setSchoolName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const subject = `Demo request — ${schoolName || "New school"}`;
    const body = [
      `School / College: ${schoolName}`,
      `Contact person: ${contactName}`,
      `Phone: ${phone}`,
      `District: ${district}`,
      "",
      message || "(no additional message)",
    ].join("\n");
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const field =
    "w-full rounded-xl border border-black/15 bg-[color:var(--fog)] px-4 py-2.5 text-sm placeholder:text-black/30 focus:outline-none focus:border-[color:var(--ocean)] focus:ring-2 focus:ring-[color:var(--ocean)]/10";

  return (
    <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="d-school" className="text-xs font-semibold text-[color:var(--ink)] block mb-1.5">
            School / College Name *
          </label>
          <input id="d-school" type="text" required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. Green Valley School" className={field} />
        </div>
        <div>
          <label htmlFor="d-contact" className="text-xs font-semibold text-[color:var(--ink)] block mb-1.5">
            Contact Person *
          </label>
          <input id="d-contact" type="text" required value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your full name" className={field} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="d-phone" className="text-xs font-semibold text-[color:var(--ink)] block mb-1.5">
            Phone Number *
          </label>
          <input id="d-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" className={field} />
        </div>
        <div>
          <label htmlFor="d-district" className="text-xs font-semibold text-[color:var(--ink)] block mb-1.5">
            District / Location
          </label>
          <input id="d-district" type="text" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Kathmandu" className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="d-msg" className="text-xs font-semibold text-[color:var(--ink)] block mb-1.5">
          Message
        </label>
        <textarea id="d-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us about your school and requirements..." className={`${field} resize-none`} />
      </div>
      <button
        type="submit"
        className="w-full rounded-full bg-[color:var(--ocean)] py-3 min-h-[44px] text-sm font-bold text-white shadow-sm hover:bg-[color:var(--ocean-light)] transition-colors"
      >
        Send via your email app →
      </button>
      <p className="text-[11px] text-[color:var(--muted)] text-center">
        Opens your mail app with everything filled in to {CONTACT_EMAIL}. Prefer self-serve?{" "}
        <a href="/register" className="font-semibold underline">Create your school account</a>.
      </p>
    </form>
  );
}
