"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Award, Medal, Plus, Star, Trophy, Users } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  criteria: string;
  points_value: number;
}

interface LeaderEntry {
  student_id: string;
  student_name: string;
  total_points: number;
  rank: number;
}

interface House {
  id: string;
  name: string;
  color: string;
  motto: string;
  total_points: number;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
}

const POINT_CATEGORIES = ["academic", "behavior", "sports", "attendance", "general"];

export default function GamificationPage() {
  return (
    <PluginGate slug="gamification">
      <GamificationContent />
    </PluginGate>
  );
}

function GamificationContent() {
  const [tab, setTab] = useState<"leaderboard" | "badges" | "houses">("leaderboard");
  const queryClient = useQueryClient();

  const { data: leaderboard, isLoading: lbLoading, isError: lbError, refetch: lbRefetch } = useQuery<any>({
    queryKey: ["gamification-leaderboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/gamification/leaderboard", { params: { top: 20 } });
      return (Array.isArray(res.data.data) ? res.data.data : []) as LeaderEntry[];
    },
    retry: 1,
  });

  const { data: badges, isLoading: badgeLoading } = useQuery<any>({
    queryKey: ["gamification-badges"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/gamification/badges");
      return (Array.isArray(res.data.data) ? res.data.data : []) as BadgeItem[];
    },
  });

  const { data: houses, isLoading: houseLoading } = useQuery<any>({
    queryKey: ["gamification-houses"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/gamification/houses");
      return (Array.isArray(res.data.data) ? res.data.data : []) as House[];
    },
  });

  if (lbLoading) return <PageLoader />;
  if (lbError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<Trophy className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Gamification"
          subtitle="Points, badges, houses & leaderboard"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load gamification data. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => lbRefetch()}>Retry</Button>
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
        title="Gamification"
        subtitle="Points, badges, houses & leaderboard"
        actions={<AwardPointsDialog onAwarded={() => lbRefetch()} />}
      />
      <AOSPageBody>
        {/* Stats */}
        <StatGrid min={180}>
          <KpiCard label="Ranked Students" value={leaderboard?.length || 0} icon={<Trophy className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Badges" value={badges?.length || 0} icon={<Award className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Houses" value={houses?.length || 0} icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />} />
        </StatGrid>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[color:var(--w11-border-subtle)] pb-2 mb-4">
          <Button variant={tab === "leaderboard" ? "default" : "ghost"} size="sm" onClick={() => setTab("leaderboard")}>
            <Trophy className="h-4 w-4 mr-1" /> Leaderboard
          </Button>
          <Button variant={tab === "badges" ? "default" : "ghost"} size="sm" onClick={() => setTab("badges")}>
            <Medal className="h-4 w-4 mr-1" /> Badges
          </Button>
          <Button variant={tab === "houses" ? "default" : "ghost"} size="sm" onClick={() => setTab("houses")}>
            <Users className="h-4 w-4 mr-1" /> Houses
          </Button>
        </div>

        {tab === "leaderboard" && <LeaderboardTab data={leaderboard || []} />}
        {tab === "badges" && <BadgesTab data={badges || []} />}
        {tab === "houses" && <HousesTab data={houses || []} />}
      </AOSPageBody>
    </AOSPage>
  );
}

function LeaderboardTab({ data }: { data: LeaderEntry[] }) {
  const LEADER_COLUMNS: Column<LeaderEntry>[] = [
    {
      key: "rank",
      label: "Rank",
      sortable: true,
      value: (e) => e.rank ?? 0,
      render: (e, i) =>
        i < 3 ? (
          <span className="text-xl">{["🥇", "🥈", "🥉"][i]}</span>
        ) : (
          <span className="text-sm text-[color:var(--w11-text-secondary)]">#{e.rank || i + 1}</span>
        ),
    },
    { key: "student_name", label: "Student", sortable: true, value: (e) => e.student_name, render: (e) => <span className="font-medium">{e.student_name}</span> },
    {
      key: "total_points",
      label: "Points",
      align: "right",
      sortable: true,
      value: (e) => e.total_points,
      render: (e) => (
        <span className="win11-chip">
          <Star className="h-3 w-3 mr-1 inline" /> {e.total_points}
        </span>
      ),
    },
  ];
  return (
    <DataPanel title="Top Students">
      <DataTable<LeaderEntry>
        columns={LEADER_COLUMNS}
        rows={data}
        rowKey={(e) => e.student_id}
        searchable
        searchPlaceholder="Search students…"
        exportFileName="leaderboard"
        dense
      />
    </DataPanel>
  );
}

function BadgesTab({ data }: { data: BadgeItem[] }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const createMut = useMutation({
    mutationFn: async (body: { name: string; description: string; criteria: string; points_value: number }) => {
      const res = await api.post<ApiResponse>("/gamification/badges", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-badges"] });
      setOpen(false);
      toast.success("Badge created");
    },
    onError: () => toast.error("Failed to create badge"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Badge</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Badge</DialogTitle></DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createMut.mutate({
                  name: fd.get("name") as string,
                  description: fd.get("description") as string,
                  criteria: fd.get("criteria") as string,
                  points_value: parseInt(fd.get("points_value") as string, 10) || 10,
                });
              }}
            >
              <Input name="name" placeholder="Badge name" required />
              <Input name="description" placeholder="Description" />
              <Input name="criteria" placeholder="Criteria (e.g., 100% attendance)" required />
              <Input name="points_value" type="number" placeholder="Points value" defaultValue="10" />
              <Button type="submit" disabled={createMut.isPending} className="w-full">
                {createMut.isPending ? "Creating..." : "Create Badge"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.length === 0 ? (
          <p className="col-span-full text-center py-8 text-[color:var(--w11-text-secondary)]">No badges yet</p>
        ) : (
          data.map((badge) => (
            <div key={badge.id} className="win11-card" style={{ marginBottom: 0 }}>
              <div className="pt-2">
                <div className="flex items-start gap-3">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center"
                    style={{ background: "var(--w11-accent-light)" }}
                  >
                    <Medal className="h-6 w-6" style={{ color: "var(--w11-accent)" }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[color:var(--w11-text-primary)]">{badge.name}</h3>
                    <p className="text-sm text-[color:var(--w11-text-secondary)]">{badge.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="win11-chip text-xs">{badge.criteria}</span>
                      <span className="win11-chip accent text-xs">
                        <Star className="h-3 w-3 mr-1 inline" /> {badge.points_value} pts
                      </span>
                    </div>
                    <div className="mt-3">
                      <AwardBadgeDialog badgeId={badge.id} badgeName={badge.name} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function HousesTab({ data }: { data: House[] }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const createMut = useMutation({
    mutationFn: async (body: { name: string; color: string; motto: string }) => {
      const res = await api.post<ApiResponse>("/gamification/houses", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-houses"] });
      setOpen(false);
      toast.success("House created");
    },
    onError: () => toast.error("Failed to create house"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create House</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New House</DialogTitle></DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createMut.mutate({
                  name: fd.get("name") as string,
                  color: fd.get("color") as string,
                  motto: fd.get("motto") as string,
                });
              }}
            >
              <Input name="name" placeholder="House name (e.g., Red Eagles)" required />
              <div className="flex gap-2 items-center">
                <input name="color" type="color" defaultValue="#e11d48" className="h-10 w-14 rounded border" />
                <span className="text-sm text-[color:var(--w11-text-secondary)]">House color</span>
              </div>
              <Input name="motto" placeholder="Motto" />
              <Button type="submit" disabled={createMut.isPending} className="w-full">
                {createMut.isPending ? "Creating..." : "Create House"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {data.length === 0 ? (
          <p className="col-span-full text-center py-8 text-[color:var(--w11-text-secondary)]">No houses yet</p>
        ) : (
          data.map((house) => (
            <div key={house.id} className="win11-card overflow-hidden" style={{ marginBottom: 0 }}>
              <div className="h-2" style={{ backgroundColor: house.color }} />
              <div className="pt-4">
                <h3 className="font-bold text-lg text-[color:var(--w11-text-primary)]">{house.name}</h3>
                <p className="text-sm italic text-[color:var(--w11-text-secondary)]">{house.motto || "—"}</p>
                <div className="mt-3 flex items-center gap-1">
                  <Trophy className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
                  <span className="font-bold text-lg text-[color:var(--w11-text-primary)]">{house.total_points || 0}</span>
                  <span className="text-sm text-[color:var(--w11-text-secondary)]">points</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function useStudents() {
  return useQuery({
    queryKey: ["gamification-students"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/students?per_page=200");
      return ((res.data.data as StudentRow[]) || []).filter((s) => !!s.id);
    },
    retry: 1,
  });
}

function StudentSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: students, isLoading } = useStudents();
  return (
    <AdvancedSelect
      value={value}
      onChange={(v) => onChange(v)}
      disabled={isLoading}
      clearable
      searchable
      placeholder={isLoading ? "Loading students…" : "Select student…"}
      options={(students || []).map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
    />
  );
}

// POST /gamification/points {student_id, points, reason, category} — the only
// award path the backend exposes (this page previously had no way to award).
function AwardPointsDialog({ onAwarded }: { onAwarded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [points, setPoints] = useState("10");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("academic");
  const queryClient = useQueryClient();

  const award = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse>("/gamification/points", {
        student_id: studentId,
        points: parseInt(points, 10),
        reason: reason || undefined,
        category,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["gamification-leaderboard-full"] });
      setOpen(false);
      setStudentId("");
      setPoints("10");
      setReason("");
      toast.success("Points awarded");
      onAwarded?.();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to award points"),
  });

  const parsed = parseInt(points, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Award className="h-4 w-4 mr-2" /> Award Points</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Award Points</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (studentId && parsed) award.mutate(); }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Student</label>
            <StudentSelect value={studentId} onChange={setStudentId} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Points (negative = deduction)</label>
              <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <AdvancedSelect value={category} onChange={(v) => setCategory(v)}
                options={POINT_CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Won inter-school quiz" />
          </div>
          <Button type="submit" disabled={!studentId || !parsed || award.isPending} className="w-full">
            {award.isPending ? "Awarding..." : "Award Points"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// POST /gamification/award-badge {student_id, badge_id} — per-badge award action.
function AwardBadgeDialog({ badgeId, badgeName }: { badgeId: string; badgeName: string }) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const queryClient = useQueryClient();

  const award = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse>("/gamification/award-badge", {
        student_id: studentId,
        badge_id: badgeId,
      });
      return res.data;
    },
    onSuccess: () => {
      setOpen(false);
      setStudentId("");
      toast.success("Badge awarded");
      queryClient.invalidateQueries({ queryKey: ["gamification-leaderboard"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to award badge"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Award className="h-3 w-3 mr-1" /> Award to student</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Award &ldquo;{badgeName}&rdquo;</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (studentId) award.mutate(); }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Student</label>
            <StudentSelect value={studentId} onChange={setStudentId} />
          </div>
          <Button type="submit" disabled={!studentId || award.isPending} className="w-full">
            {award.isPending ? "Awarding..." : "Award Badge"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
