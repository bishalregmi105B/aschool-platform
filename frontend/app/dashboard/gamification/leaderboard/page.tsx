"use client";

/**
 * Leaderboard (plan 34 #45 + 8.20: "leaderboard print twin — schools print
 * these for walls").
 *
 * Research notes: (1) wall-poster leaderboards need a print twin: high
 * contrast, black-on-white, school header, rank/name/class/points only;
 * (2) on screen, the top three deserve a podium so the chart reads at a
 * glance while the table stays searchable/exportable for staff.
 *
 * Adds: segmented [Standings | Print sheet] view toggle (31.3 rule 3 — two
 * modes of one view), print-only sheet with @media print isolation (local,
 * no cross-module dependency), podium row, skeletons instead of PageLoader,
 * bilingual labels.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Star, Printer } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { MetricCard } from "@/components/ui/metric-card";

const rankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />;
  if (rank === 2) return <Medal className="h-5 w-5 text-[color:var(--w11-text-secondary)]" />;
  if (rank === 3) return <Medal className="h-5 w-5" style={{ color: "#9d5d00" }} />;
  return <span className="text-sm font-bold w-5 text-center text-[color:var(--w11-text-secondary)]">{rank}</span>;
};

export default function LeaderboardPage() {
  return <AppGate slug="gamification"><LeaderboardContent /></AppGate>;
}

function LeaderboardContent() {
  const { t } = useI18n();
  const [view, setView] = useState<"standings" | "print">("standings");
  const { isError, refetch, data, isLoading } = useQuery<any>({
    queryKey: ["gamification-leaderboard-full"],
    queryFn: async () => (await api.get("/gamification/leaderboard", { params: { top: 50 } })).data?.data || [],
  });

  const entries: any[] = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const podium = entries.slice(0, 3);

  const LEADERBOARD_COLUMNS: Column<any>[] = [
    {
      key: "rank",
      label: t("Rank", "स्थान"),
      sortable: true,
      value: (e) => e.rank ?? 0,
      render: (e, i) => <div className="flex justify-center">{rankIcon(e.rank || (i ?? 0) + 1)}</div>,
    },
    { key: "student_name", label: t("Student", "विद्यार्थी"), sortable: true, value: (e) => e.student_name ?? "", render: (e) => <span className="font-medium">{e.student_name || e.student_id}</span> },
    { key: "class_name", label: t("Class", "कक्षा"), sortable: true, value: (e) => e.class_name ?? "", render: (e) => <span className="text-sm text-[color:var(--w11-text-secondary)]">{e.class_name || "—"}</span> },
    {
      key: "total_points",
      label: t("Total Points", "कुल अंक"),
      align: "right",
      sortable: true,
      value: (e) => e.total_points ?? 0,
      render: (e, i) => (
        <span className={`win11-chip font-mono ${(i ?? 0) === 0 ? "accent" : ""}`}>
          {e.total_points?.toLocaleString() || 0} XP
        </span>
      ),
    },
  ];

  const print = () => {
    const prev = document.title;
    document.title = `Leaderboard ${new Date().toISOString().slice(0, 10)}`;
    window.print();
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
  };

  return (
    <AOSPage>
      {/* Local print isolation: only .as-print-sheet renders on paper. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .as-print-sheet, .as-print-sheet * { visibility: visible !important; }
          .as-print-sheet {
            position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important;
          }
          .as-print-sheet * { color: #000 !important; background: transparent !important; box-shadow: none !important; }
          .as-print-sheet table { width: 100% !important; border-collapse: collapse !important; }
          .as-print-sheet th, .as-print-sheet td { border: 1px solid #999 !important; padding: 4pt 6pt !important; font-size: 10pt !important; }
          .as-print-sheet tr { break-inside: avoid; }
          .no-print { display: none !important; }
        }
        @page { size: A4 portrait; margin: 12mm; }
      `}</style>

      <AOSPageHeader
        className="no-print"
        icon={<Trophy className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Leaderboard"
        subtitle={t("Top students ranked by total XP points", "कुल XP अंक अनुसार शीर्ष विद्यार्थी")}
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as "standings" | "print")}>
              <TabsList variant="segment">
                <TabsTrigger value="standings">{t("Standings", "स्थिति")}</TabsTrigger>
                <TabsTrigger value="print">{t("Print sheet", "प्रिन्ट शीट")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" onClick={print}>
              <Printer className="h-4 w-4 mr-2" /> {t("Print", "छाप")}
            </Button>
          </>
        }
      />
      <AOSPageBody>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <DataPanel className="max-w-2xl mx-auto no-print">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load data. Please try again.", "लोड गर्न असफल।")}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
            </div>
          </DataPanel>
        ) : entries.length === 0 ? (
            <DataPanel className="no-print">
              <AOSEmptyState
                icon={<Star className="h-12 w-12" />}
                title={t("No rankings yet", "अझै कुनै र्याङ्किङ छैन")}
                description={t("Award points to students to populate the leaderboard.", "अंक प्रदान गरे leaderboard भरिन्छ।")}
              />
            </DataPanel>
        ) : view === "standings" ? (
          <div className="no-print space-y-4">
            {/* Podium — the three leaders, glanceable. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {podium.map((p, i) => (
                <div key={p.student_id} style={{ borderTop: `3px solid ${["#d4af37", "#9aa5b1", "#b08d57"][i]}` }}>
                  <MetricCard
                    label={`#${p.rank || i + 1} · ${p.student_name || ""}`}
                    value={`${p.total_points?.toLocaleString() || 0}`}
                    denominator="XP"
                    footnote={p.class_name || undefined}
                  />
                </div>
              ))}
            </div>
            <DataPanel bodyClassName="p-0 pt-0">
              <DataTable
                columns={LEADERBOARD_COLUMNS}
                rows={entries}
                rowKey={(e: any) => e.student_id || `rank-${e.rank}`}
                searchable
                searchPlaceholder={t("Search students…", "विद्यार्थी खोज्नुहोस्…")}
                exportFileName="leaderboard"
                dense
              />
            </DataPanel>
          </div>
        ) : (
          /* Print-ready sheet: header + full ranking table, black-on-white. */
          <div className="as-print-sheet win11-card p-6" style={{ marginBottom: 0 }}>
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold">ASchool — {t("Student Leaderboard", "विद्यार्थी लिडरबोर्ड")}</h2>
              <p className="text-sm">{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th className="text-left">#</th>
                  <th className="text-left">{t("Student", "विद्यार्थी")}</th>
                  <th className="text-left">{t("Class", "कक्षा")}</th>
                  <th className="text-right">{t("Points", "अंक")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.student_id || i}>
                    <td>{e.rank || i + 1}</td>
                    <td>{e.student_name || e.student_id}</td>
                    <td>{e.class_name || "—"}</td>
                    <td className="text-right">{e.total_points?.toLocaleString() || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-center text-xs mt-4">{t("Posted by the student council · ASchool", "विद्यार्थी परिषदद्वारा प्रकाशित")}</p>
          </div>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
