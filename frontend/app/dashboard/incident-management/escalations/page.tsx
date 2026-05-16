"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { CheckCircle, TrendingUp } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function EscalationsPage() {
  return <PluginGate slug="incident_management"><EscalationsContent /></PluginGate>;
}

function EscalationsContent() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["escalations"],
    queryFn: async () => { const r = await api.get("/incidents/management/escalations"); return r.data?.data ?? r.data; },
  });

  const escalations: any[] = Array.isArray(data) ? data : data?.items ?? [];

  const resolve = useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) =>
      (await api.patch(`/incidents/management/${id}/resolve`, { resolution })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["escalations"] }); toast.success("Case resolved"); },
    onError: () => toast.error("Failed to resolve"),
  });

  const scheduleConference = useMutation({
    mutationFn: async (id: string) => (await api.post(`/incidents/management/${id}/conference`)).data,
    onSuccess: () => toast.success("Parent conference scheduled"),
    onError: () => toast.error("Failed to schedule"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-orange-600" />
        <div><h1 className="text-2xl font-bold">Escalated Cases</h1><p className="text-muted-foreground">High-severity incidents escalated to principal or management</p></div>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Case</TableHead><TableHead>Student</TableHead><TableHead>Severity</TableHead><TableHead>Escalated To</TableHead><TableHead>Escalated On</TableHead><TableHead>Conference</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {escalations.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No escalated cases</TableCell></TableRow>
            ) : escalations.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium max-w-[180px] truncate">{e.title}</TableCell>
                <TableCell>{e.student_name ?? "—"}</TableCell>
                <TableCell><Badge variant={e.severity === "high" ? "destructive" : "secondary"}>{e.severity}</Badge></TableCell>
                <TableCell>{e.escalated_to ?? "Principal"}</TableCell>
                <TableCell>{e.escalated_at ? displayBS(e.escalated_at) : "—"}</TableCell>
                <TableCell>
                  <Badge variant={e.conference_scheduled ? "default" : "outline"}>{e.conference_scheduled ? "Scheduled" : "Not yet"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {!e.conference_scheduled && <Button size="sm" variant="outline" onClick={() => scheduleConference.mutate(e.id)}>Schedule Conf.</Button>}
                    <Button size="sm" variant="default" onClick={() => resolve.mutate({ id: e.id, resolution: "resolved" })}><CheckCircle className="h-3 w-3 mr-1" />Resolve</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
