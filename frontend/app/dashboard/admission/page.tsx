"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, UserPlus, BarChart3, ArrowRight } from "lucide-react";

interface Inquiry {
  id: string;
  student_name: string;
  guardian_name: string;
  phone: string;
  class_applied: string;
  source: string;
  status: string;
  created_at: string;
}

interface Application {
  id: string;
  student_name: string;
  guardian_name: string;
  class_applied: string;
  status: string;
  created_at: string;
}

interface DashboardData {
  total_inquiries: number;
  pipeline: Record<string, number>;
}

export default function AdmissionPage() {
  return (
    <PluginGate slug="admission">
      <AdmissionContent />
    </PluginGate>
  );
}

function AdmissionContent() {
  const [tab, setTab] = useState<"dashboard" | "inquiries" | "applications">("dashboard");
  const [showInquiry, setShowInquiry] = useState(false);
  const queryClient = useQueryClient();

  const { data: dashboard } = useQuery({
    queryKey: ["admission-dashboard"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/admission/dashboard");
      return res.data.data as DashboardData;
    },
  });

  const { data: inquiries, isLoading: loadingInq } = useQuery({
    queryKey: ["admission-inquiries"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/admission/inquiries");
      return (res.data.data as Inquiry[]) || [];
    },
    enabled: tab === "inquiries",
  });

  const { data: applications, isLoading: loadingApps } = useQuery({
    queryKey: ["admission-applications"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/admission/applications");
      return (res.data.data as Application[]) || [];
    },
    enabled: tab === "applications",
  });

  const createInquiryMut = useMutation({
    mutationFn: async (data: Partial<Inquiry>) => {
      const res = await api.post<ApiResponse>("/admission/inquiries", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-inquiries", "admission-dashboard"] });
      setShowInquiry(false);
      toast.success("Inquiry added");
    },
  });

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.put<ApiResponse>(`/admission/applications/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admission-applications", "admission-dashboard"] });
      toast.success("Status updated");
    },
  });

  const pipeline = dashboard?.pipeline || {};
  const pipelineStages = ["submitted", "under_review", "interview", "accepted", "enrolled", "rejected"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admission CRM</h1>
          <p className="text-muted-foreground">Manage inquiries and applications pipeline</p>
        </div>
        <Dialog open={showInquiry} onOpenChange={setShowInquiry}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="h-4 w-4 mr-2" /> New Inquiry</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Inquiry</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createInquiryMut.mutate(Object.fromEntries(fd) as unknown as Partial<Inquiry>);
            }} className="space-y-4">
              <Input name="student_name" placeholder="Student Name" required />
              <Input name="guardian_name" placeholder="Guardian Name" required />
              <Input name="phone" placeholder="Phone" required />
              <Input name="class_applied" placeholder="Class Applied" />
              <Input name="source" placeholder="Source (walk-in, referral, online)" />
              <Textarea name="notes" placeholder="Notes" rows={2} />
              <Button type="submit" disabled={createInquiryMut.isPending} className="w-full">
                {createInquiryMut.isPending ? "Adding..." : "Add Inquiry"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {(["dashboard", "inquiries", "applications"] as const).map((t: any) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">
            {t === "dashboard" && <BarChart3 className="h-4 w-4 mr-2" />}
            {t === "inquiries" && <UserPlus className="h-4 w-4 mr-2" />}
            {t}
          </Button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Total Inquiries</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{dashboard?.total_inquiries || 0}</p></CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {pipelineStages.map((stage: any) => (
              <Card key={stage}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground capitalize">{stage.replace("_", " ")}</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{pipeline[stage] || 0}</p></CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "inquiries" && (loadingInq ? <PageLoader /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries?.map((inq: any) => (
                  <TableRow key={inq.id}>
                    <TableCell className="font-medium">{inq.student_name}</TableCell>
                    <TableCell>{inq.guardian_name}</TableCell>
                    <TableCell>{inq.phone}</TableCell>
                    <TableCell>{inq.class_applied}</TableCell>
                    <TableCell>{inq.source}</TableCell>
                    <TableCell><Badge variant="outline">{inq.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {tab === "applications" && (loadingApps ? <PageLoader /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications?.map((app: any) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.student_name}</TableCell>
                    <TableCell>{app.guardian_name}</TableCell>
                    <TableCell>{app.class_applied}</TableCell>
                    <TableCell><Badge>{app.status}</Badge></TableCell>
                    <TableCell>
                      <Select onValueChange={(val) => statusMut.mutate({ id: app.id, status: val })}>
                        <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Move to" /></SelectTrigger>
                        <SelectContent>
                          {pipelineStages.map((s: any) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
