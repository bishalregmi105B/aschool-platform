"use client";

/**
 * Teacher → AI Tools (de-stubbed, R4c).
 *
 * Was a 1-line re-export of the ADMIN 25-tool catalog. Now teacher-first:
 * lesson-planning and classroom tools at the top, then assessment and
 * communication — the catalog is filtered to what a teacher actually uses
 * (school-level insights/config tools excluded).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Search } from "lucide-react";
import { AI_TOOLS, GROUP_LABELS, GROUP_COLORS, type ToolGroup } from "../../dashboard/ai-tools/_components/tool-catalog";
import { KpiCard, StatGrid } from "@/components/aos/kit/page-kit";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

// Teacher-relevant tools; insights/admin tooling stays in the admin AI hub.
const TEACHER_EXCLUDE = new Set(["insights", "timetable", "exam-timetable-draft", "learning-paths"]);

// Display order: planning first — it's the daily job.
const GROUP_ORDER: ToolGroup[] = ["planning", "assessment", "communication"];

export default function TeacherAIToolsPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<"all" | ToolGroup>("all");

  const teacherTools = useMemo(
    () => AI_TOOLS.filter((tool) => !TEACHER_EXCLUDE.has(tool.key)),
    [],
  );

  const shown = useMemo(
    () =>
      teacherTools.filter(
        (tool) =>
          (group === "all" || tool.group === group) &&
          (!q.trim() ||
            (tool.label + " " + tool.desc).toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [teacherTools, q, group],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--w11-text-primary)" }}>
          {t("AI Teaching Tools", "एआई शिक्षण उपकरणहरू")}
        </h1>
        <p className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {t(
            "Plan lessons, build assessments and write communications — faster.",
            "पाठ योजना, परीक्षा र सञ्चार छिटो बनाउनुहोस्।",
          )}
        </p>
      </div>

      <StatGrid min={150}>
        {GROUP_ORDER.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(group === g ? "all" : g)}
            className="text-left"
            aria-pressed={group === g}
          >
            <KpiCard
              label={GROUP_LABELS[g]}
              value={teacherTools.filter((tool) => tool.group === g).length}
              color={GROUP_COLORS[g]}
              icon={<span className="h-4 w-4" style={{ background: GROUP_COLORS[g], borderRadius: 4, display: "inline-block" }} />}
            />
          </button>
        ))}
      </StatGrid>

      <div className="win11-searchbox flex items-center gap-2 rounded-lg border px-3" style={{ borderColor: "var(--w11-border-default)" }}>
        <Search className="h-4 w-4 shrink-0" style={{ color: "var(--w11-text-secondary)" }} />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Search tools…", "उपकरण खोज्नुहोस्…")}
          className="h-9 border-0 bg-transparent px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Search AI tools"
        />
        {group !== "all" && (
          <button
            type="button"
            onClick={() => setGroup("all")}
            className="text-xs font-medium text-[var(--w11-accent)] hover:underline"
          >
            {t("Clear filter", "फिल्टर हटाउनुहोस्")}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--w11-text-secondary)" }}>
          {t("No tools match your search.", "खोजीसँग मिल्ने उपकरण छैन।")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((tool) => (
            <Link
              key={tool.key}
              href={`/dashboard/ai-tools/${tool.key}`}
              className="group flex min-h-[110px] flex-col rounded-xl border p-4 transition-colors hover:bg-[var(--w11-control-hover)]"
              style={{ borderColor: "var(--w11-border-default)" }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  style={{ background: `${GROUP_COLORS[tool.group]}1a`, color: GROUP_COLORS[tool.group] }}
                >
                  <tool.icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                    {tool.label}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--w11-text-secondary)" }}>
                    {tool.desc}
                  </p>
                </div>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-[var(--w11-accent)]">
                <Sparkles className="h-3.5 w-3.5" />
                {t("Open", "खोल्नुहोस्")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
