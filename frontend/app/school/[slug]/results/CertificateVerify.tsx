"use client";

/**
 * CertificateVerify — public document verification (the EduEx "verify URL"
 * steal, Part 3.5). Backed by the REAL public endpoint
 * GET /students/exit-documents/verify?number= (exact document-number match,
 * minimal PII, revoke flag surfaced). No auth, no enumeration beyond the
 * number itself.
 */

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { BadgeCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

type VerifyResult = {
  document_number: string;
  doc_type?: string | null;
  student_name?: string | null;
  class_name?: string | null;
  issued_on_bs?: string | null;
  revoked: boolean;
};

export function CertificateVerify() {
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);

  async function check(e: FormEvent) {
    e.preventDefault();
    const q = number.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.get(`/students/exit-documents/verify?number=${encodeURIComponent(q)}`);
      setResult(res.data?.data as VerifyResult);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "No certificate matches that number. Check with the school office.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="max-w-3xl mx-auto px-4 pb-16" aria-labelledby="cert-verify-title">
      <div className="border rounded-lg bg-white p-6">
        <h2 id="cert-verify-title" className="text-xl font-bold mb-1 inline-flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
          <ShieldQuestion className="h-5 w-5" /> Verify a Certificate / TC
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter the document number printed on a Transfer or Character Certificate to confirm the school issued it.
        </p>
        <form onSubmit={check} className="flex flex-col sm:flex-row gap-3">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="e.g. TC-2082-0045"
            aria-label="Certificate number"
            className="flex-1 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-50 min-h-[44px]"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {loading ? "Checking…" : "Verify"}
          </button>
        </form>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {result && (
          <div
            className={`mt-4 rounded-lg border p-4 ${
              result.revoked ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
            }`}
            role="status"
          >
            <p className={`flex items-center gap-2 font-bold text-sm ${result.revoked ? "text-red-700" : "text-green-700"}`}>
              {result.revoked ? <ShieldAlert className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
              {result.revoked ? "REVOKED — this document is no longer valid" : "Genuine — issued by the school"}
            </p>
            <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
              <span>Number: <b>{result.document_number}</b></span>
              <span>Type: <b>{result.doc_type || "—"}</b></span>
              {result.student_name && <span>Student: <b>{result.student_name}</b></span>}
              {result.class_name && <span>Class: <b>{result.class_name}</b></span>}
              {result.issued_on_bs && <span>Issued: <b>{result.issued_on_bs} BS</b></span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
