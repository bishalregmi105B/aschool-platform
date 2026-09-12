"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { CheckCircle, TrendingUp } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function EscalationsPage() {
  return <PluginGate slug="incident_management"><EscalationsContent /></PluginGate>;
}

function EscalationsContent() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["escalations"],
    queryFn: async () => { const r = await api.get("/incidents/management/escalations"); return r.data?.data ?? r.data; },
    retry: 1,
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["escalations"] }); toast.success("Parent conference scheduled"); },
    onError: () => toast.error("Failed to schedule"),
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading escalated cases…" />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Escalated Cases" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load escalated cases. Please try again.</p>
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
        icon={<TrendingUp className="h-5 w-5" style={{ color: "#d83b01" }} />}
        title="Escalated Cases"
        subtitle={`${escalations.length} high-severity ${escalations.length === 1 ? "case" : "cases"} escalated to principal or management`}
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Case</TableHead><TableHead>Student</TableHead><TableHead>Severity</TableHead><TableHead>Escalated To</TableHead><TableHead>Escalated On</TableHead><TableHead>Conference</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {escalations.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>No escalated cases</TableCell></TableRow>
              ) : escalations.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium max-w-[180px] truncate">{e.title}</TableCell>
                  <TableCell>{e.student_name ?? "—"}</TableCell>
                  <TableCell><StatusChip status={e.severity === "high" ? "failed" : "pending"} label={e.severity} /></TableCell>
                  <TableCell>{e.escalated_to ?? "Principal"}</TableCell>
                  <TableCell>{e.escalated_at ? displayBS(e.escalated_at) : "—"}</TableCell>
                  <TableCell>
                    <span className={`win11-chip ${e.conference_scheduled ? "success" : "subtle"}`}>{e.conference_scheduled ? "Scheduled" : "Not yet"}</span>
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
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
