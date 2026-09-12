"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageLoader } from "@/components/ui/spinner";
import { Trophy, Medal, Star } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

const rankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />;
  if (rank === 2) return <Medal className="h-5 w-5 text-[color:var(--w11-text-secondary)]" />;
  if (rank === 3) return <Medal className="h-5 w-5" style={{ color: "#9d5d00" }} />;
  return <span className="text-sm font-bold w-5 text-center text-[color:var(--w11-text-secondary)]">{rank}</span>;
};

export default function LeaderboardPage() {
  return <PluginGate slug="gamification"><LeaderboardContent /></PluginGate>;
}

function LeaderboardContent() {
  const { isError, refetch, data, isLoading } = useQuery<any>({
    queryKey: ["gamification-leaderboard-full"],
    queryFn: async () => (await api.get("/gamification/leaderboard", { params: { top: 50 } })).data?.data || [],
  });

  const entries: any[] = Array.isArray(data) ? data : [];

  const LEADERBOARD_COLUMNS: Column<any>[] = [
    {
      key: "rank",
      label: "Rank",
      sortable: true,
      value: (e) => e.rank ?? 0,
      render: (e, i) => <div className="flex justify-center">{rankIcon(e.rank || (i ?? 0) + 1)}</div>,
    },
    { key: "student_name", label: "Student", sortable: true, value: (e) => e.student_name ?? "", render: (e) => <span className="font-medium">{e.student_name || e.student_id}</span> },
    { key: "class_name", label: "Class", sortable: true, value: (e) => e.class_name ?? "", render: (e) => <span className="text-sm text-[color:var(--w11-text-secondary)]">{e.class_name || "—"}</span> },
    {
      key: "total_points",
      label: "Total Points",
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

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<Trophy className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Leaderboard"
          subtitle="Top students ranked by total XP points"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load data. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Trophy className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Leaderboard"
        subtitle="Top students ranked by total XP points"
      />
      <AOSPageBody>
        {entries.length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              icon={<Star className="h-12 w-12" />}
              title="No rankings yet"
              description="Award points to students to populate the leaderboard."
            />
          </DataPanel>
        ) : (
          <DataPanel bodyClassName="p-0 pt-0">
            <DataTable
              columns={LEADERBOARD_COLUMNS}
              rows={entries}
              rowKey={(e: any) => e.student_id || `rank-${e.rank}`}
              searchable
              searchPlaceholder="Search students…"
              exportFileName="leaderboard"
              dense
            />
          </DataPanel>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
