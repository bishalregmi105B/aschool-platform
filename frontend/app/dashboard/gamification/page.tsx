"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Award, Medal, Plus, Star, Trophy, Users } from "lucide-react";

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
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load gamification data. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => lbRefetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gamification</h1>
          <p className="text-muted-foreground">Points, badges, houses & leaderboard</p>
        </div>
        <AwardPointsDialog onAwarded={() => lbRefetch()} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{leaderboard?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Ranked Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{badges?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Badges</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{houses?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Houses</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
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
    </div>
  );
}

function LeaderboardTab({ data }: { data: LeaderEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Top Students</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Student</TableHead>
            <TableHead className="text-right">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                No points awarded yet
              </TableCell>
            </TableRow>
          ) : (
            data.map((entry, i) => (
              <TableRow key={entry.student_id}>
                <TableCell>
                  {i < 3 ? (
                    <span className="text-xl">{["🥇", "🥈", "🥉"][i]}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">#{entry.rank || i + 1}</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{entry.student_name}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline">
                    <Star className="h-3 w-3 mr-1 text-yellow-500" /> {entry.total_points}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
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
          <p className="text-muted-foreground col-span-full text-center py-8">No badges yet</p>
        ) : (
          data.map((badge) => (
            <Card key={badge.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <Medal className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{badge.name}</h3>
                    <p className="text-sm text-muted-foreground">{badge.description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">{badge.criteria}</Badge>
                      <Badge variant="secondary" className="text-xs">
                        <Star className="h-3 w-3 mr-1" /> {badge.points_value} pts
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <AwardBadgeDialog badgeId={badge.id} badgeName={badge.name} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                <span className="text-sm text-muted-foreground">House color</span>
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
          <p className="text-muted-foreground col-span-full text-center py-8">No houses yet</p>
        ) : (
          data.map((house) => (
            <Card key={house.id} className="overflow-hidden">
              <div className="h-2" style={{ backgroundColor: house.color }} />
              <CardContent className="pt-4">
                <h3 className="font-bold text-lg">{house.name}</h3>
                <p className="text-sm text-muted-foreground italic">{house.motto || "—"}</p>
                <div className="mt-3 flex items-center gap-1">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="font-bold text-lg">{house.total_points || 0}</span>
                  <span className="text-sm text-muted-foreground">points</span>
                </div>
              </CardContent>
            </Card>
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
    <select
      className="w-full border rounded-md p-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading}
      required
    >
      <option value="">{isLoading ? "Loading students…" : "Select student…"}</option>
      {(students || []).map((s) => (
        <option key={s.id} value={s.id}>
          {s.first_name} {s.last_name}
        </option>
      ))}
    </select>
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
              <select className="w-full border rounded-md p-2" value={category} onChange={(e) => setCategory(e.target.value)}>
                {POINT_CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
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
