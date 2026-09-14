"use client";

/**
 * UDL Choice Board — POST /ai/generate/udl_choice_board.
 * Research: MagicSchool's Choice Board makes the 3×3 grid the star (rows =
 * readiness/support levels, columns = show-it / express-it / make-it-matter);
 * the artifact deserves the wide column, hence wide-result layout.
 */

import { Grid3X3 } from "lucide-react";
import { AiToolPage } from "../_components/ai-tool-page";

interface Cell { row: string; column: string; task: string }
interface Result { instructions?: string; cells: Cell[]; columns?: string[] }

export default function ChoiceBoardPage() {
  return (
    <AiToolPage
      icon={Grid3X3}
      title="UDL Choice Board"
      subtitle="3×3 boards: show it, express it, make it matter"
      subtitleNe="देखाउनुहोस्, व्यक्त गर्नुहोस्, अर्थमय बनाउनुहोस्"
      toolKey="udl_choice_board"
      generateLabel="Build board"
      resultTitle="Board"
      resultHint="Pick 3 tasks — one from each column."
      layout="wide-result"
      fields={[
        { key: "subject", label: "Subject", ne: "विषय", required: true, placeholder: "e.g. Science" },
        { key: "grade", label: "Grade", ne: "कक्षा", required: true, placeholder: "e.g. 6" },
        { key: "topic", label: "Topic (optional)", ne: "विषयवस्तु", placeholder: "e.g. Water cycle" },
      ]}
      renderResult={(data) => {
        const result = data as Result;
        const columns = result.columns || [];
        const rows = [...new Set((result.cells || []).map((c) => c.row))];
        return (
          <div className="overflow-x-auto">
            <p className="mb-3 text-xs text-[color:var(--w11-text-secondary)]">{result.instructions}</p>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2" />
                  {columns.map((c) => (
                    <th key={c} className="p-2 text-sm font-semibold border-b border-[color:var(--w11-border-subtle)] text-[color:var(--w11-text-secondary)]">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r}>
                    <td className="p-2 text-sm font-semibold whitespace-nowrap align-top text-[color:var(--w11-text-secondary)]">{r}</td>
                    {columns.map((c) => {
                      const cell = result.cells.find((x) => x.row === r && x.column === c);
                      return (
                        <td key={c} className="p-2 align-top">
                          <div className="h-full rounded-md border border-[color:var(--w11-border-subtle)] p-3 text-sm min-h-[80px]" style={{ background: "var(--w11-card-bg)" }}>
                            {cell?.task || "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    />
  );
}
