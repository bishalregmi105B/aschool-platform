"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";

export function ContactForm({ slug }: { slug: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSending(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      phone: fd.get("phone"),
      email: fd.get("email"),
      message: fd.get("message"),
    };

    try {
      // Shared client: relative /api/v1 (same-origin rewrite) + cookie session.
      await api.post(`/website/public/${slug}/contact`, body);
      setSent(true);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="border rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-lg font-semibold mb-1">Message Sent!</h3>
        <p className="text-gray-600 text-sm">Thank you for reaching out. We will get back to you soon.</p>
        <button
          onClick={() => setSent(false)}
          className="mt-4 text-sm underline"
          style={{ color: "var(--color-primary)" }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--color-primary)" }}>
        Send a Message
      </h2>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium mb-1">Full Name *</label>
          <input
            name="name"
            type="text"
            required
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone Number</label>
          <input
            name="phone"
            type="tel"
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
            placeholder="your@email.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message *</label>
          <textarea
            name="message"
            required
            className="w-full border rounded-md px-3 py-2 text-sm"
            rows={4}
            placeholder="Your message..."
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full py-2 rounded-md text-white font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {sending ? "Sending..." : "Send Message"}
        </button>
      </form>
    </div>
  );
}
