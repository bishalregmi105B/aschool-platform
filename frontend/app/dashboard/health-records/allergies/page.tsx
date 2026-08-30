"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { AlertTriangle, Plus, Search } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  mild: "bg-yellow-100 text-yellow-800",
  moderate: "bg-orange-100 text-orange-800",
  severe: "bg-red-100 text-red-800",
  anaphylaxis: "bg-red-200 text-red-900 font-bold",
};

export default function AllergiesPage() {
  return <PluginGate slug="health_records"><AllergiesContent /></PluginGate>;
}

function AllergiesContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [profileData, setProfileData] = useState<any>(null);
  const [lookupId, setLookupId] = useState("");

  // The registry lists students from their health profiles (GET
  // /health-records/profiles) — visits don't carry allergy data.
  const { data: profiles, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["health-profiles", search],
    queryFn: async () => (await api.get("/health-records/profiles", { params: { search: search || undefined } })).data?.data || [],
  });

  const lookupProfile = useMutation({
    mutationFn: async (id: string) => (await api.get(`/health-records/students/${id}`)).data?.data,
    onSuccess: (d) => setProfileData(d),
    onError: () => toast.error("Student health profile not found"),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      // allergies / medical_conditions are text[] columns — send arrays
      const toList = (v: string) =>
        Array.isArray(v) ? v : (v || "").split(",").map((s) => s.trim()).filter(Boolean);
      return (await api.put(`/health-records/students/${lookupId}`, {
        ...profileData,
        allergies: toList(profileData.allergies),
        medical_conditions: toList(profileData.medical_conditions),
      })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-profiles"] });
      setShowDialog(false);
      toast.success("Allergy info updated");
    },
    onError: () => toast.error("Failed to update profile"),
  });

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load health profiles. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  const students: any[] = Array.isArray(profiles) ? profiles : [];
  const filtered = students.filter((s) =>
    (s.student_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-orange-500" /> Allergies & Conditions</h1>
          <p className="text-muted-foreground">Student allergy and medical condition registry</p>
        </div>
        <Button onClick={() => { setLookupId(""); setProfileData(null); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Update Student Profile
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Blood Group</TableHead>
              <TableHead>Allergies</TableHead>
              <TableHead>Medical Conditions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No health profiles found</TableCell></TableRow>
            ) : filtered.map((v: any) => (
              <TableRow key={v.student_id}>
                <TableCell className="font-medium">{v.student_name || v.student_id}</TableCell>
                <TableCell><Badge variant="outline">{v.blood_group || "—"}</Badge></TableCell>
                <TableCell className="text-sm">{Array.isArray(v.allergies) && v.allergies.length ? v.allergies.join(", ") : "None recorded"}</TableCell>
                <TableCell className="text-sm">{Array.isArray(v.medical_conditions) && v.medical_conditions.length ? v.medical_conditions.join(", ") : "None recorded"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Student Health Profile</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Student ID" value={lookupId} onChange={(e) => setLookupId(e.target.value)} />
              <Button variant="outline" onClick={() => lookupProfile.mutate(lookupId)} disabled={!lookupId || lookupProfile.isPending}>Lookup</Button>
            </div>
            {profileData && (
              <>
                <div className="space-y-2">
                  <Label>Allergies</Label>
                  <Input value={profileData.allergies || ""} onChange={(e) => setProfileData({ ...profileData, allergies: e.target.value })} placeholder="e.g. Peanuts, Penicillin" />
                </div>
                <div className="space-y-2">
                  <Label>Medical Conditions</Label>
                  <Input value={profileData.medical_conditions || ""} onChange={(e) => setProfileData({ ...profileData, medical_conditions: e.target.value })} placeholder="e.g. Asthma, Diabetes" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Blood Group</Label><Input value={profileData.blood_group || ""} onChange={(e) => setProfileData({ ...profileData, blood_group: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Height (cm)</Label><Input type="number" value={profileData.height_cm || ""} onChange={(e) => setProfileData({ ...profileData, height_cm: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Weight (kg)</Label><Input type="number" value={profileData.weight_kg || ""} onChange={(e) => setProfileData({ ...profileData, weight_kg: e.target.value })} /></div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => saveProfile.mutate()} disabled={!profileData || saveProfile.isPending}>
              {saveProfile.isPending ? <Spinner className="mr-2" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
