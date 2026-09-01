"use client";

/** Interactive results checker (client) — wrapped by the results server page
 *  so a builder-designed Results page can replace the classic layout. */
import { useState } from "react";

import { BSDateInput } from "@/components/ui/bs-date-input";
import { api } from "@/lib/api";

interface ResultEntry {
  subject: string;
  full_marks: number;
  pass_marks: number;
  obtained_marks: number;
  grade: string;
  grade_point: number;
}

interface ResultData {
  student_name: string;
  class_name: string;
  section: string;
  roll_number: number;
  exam_name: string;
  academic_year: string;
  results: ResultEntry[];
  total_marks: number;
  percentage: number;
  gpa: number;
  rank: number | null;
  remarks: string;
}

export function ResultsChecker({ slug }: { slug: string }) {
  const [symbolNo, setSymbolNo] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState("");

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbolNo.trim() || !dob.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      // Shared client: relative /api/v1 (same-origin rewrite) + cookie session.
      const res = await api.get(
        `/website/public/${slug}/results?symbol_no=${encodeURIComponent(symbolNo)}&dob=${encodeURIComponent(dob)}`
      );
      setResult(res.data.data);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Unable to fetch results. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
      >
        📊 Results Checker
      </h1>
      <p className="text-gray-600 mb-8">
        Enter your symbol number and date of birth to check your exam results.
      </p>

      <form
        onSubmit={handleCheck}
        className="bg-white border rounded-lg p-6 mb-8 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Symbol Number / Roll No.
          </label>
          <input
            type="text"
            value={symbolNo}
            onChange={(e) => setSymbolNo(e.target.value)}
            placeholder="Enter your symbol number"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date of Birth (BS)
          </label>
          <BSDateInput
            value={dob}
            onChange={setDob}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded text-white font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {loading ? "Checking..." : "Check Result"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {result && (
        <div className="border rounded-lg overflow-x-auto">
          <div className="p-6" style={{ backgroundColor: "var(--color-primary)", color: "white" }}>
            <h2 className="text-xl font-bold">{result.student_name}</h2>
            <p className="text-sm opacity-90">
              {result.class_name} - {result.section} | Roll: {result.roll_number}
            </p>
            <p className="text-sm opacity-90">
              {result.exam_name} — {result.academic_year}
            </p>
          </div>

          <div className="p-6">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-gray-500">
                  <th className="pb-2">Subject</th>
                  <th className="pb-2 text-center">Full</th>
                  <th className="pb-2 text-center">Pass</th>
                  <th className="pb-2 text-center">Obtained</th>
                  <th className="pb-2 text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 text-sm">{r.subject}</td>
                    <td className="py-2 text-center text-sm">{r.full_marks}</td>
                    <td className="py-2 text-center text-sm">{r.pass_marks}</td>
                    <td className="py-2 text-center text-sm font-medium">
                      {r.obtained_marks}
                    </td>
                    <td className="py-2 text-center text-sm">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          r.grade !== "NG"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded p-3">
                <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
                  {result.percentage.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">Percentage</p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
                  {result.gpa.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">GPA</p>
              </div>
              {result.rank && (
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
                    #{result.rank}
                  </p>
                  <p className="text-xs text-gray-500">Rank</p>
                </div>
              )}
            </div>

            {result.remarks && (
              <p className="mt-4 text-sm text-gray-600 italic">
                Remarks: {result.remarks}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
