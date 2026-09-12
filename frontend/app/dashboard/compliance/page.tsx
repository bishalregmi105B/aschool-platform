"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { ShieldCheck, FileText, AlertTriangle, Download } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function CompliancePage() {
  return <PluginGate slug="compliance"><ComplianceContent /></PluginGate>;
}

function ComplianceContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["compliance"],
    queryFn: async () => { const r = await api.get("/compliance/reports"); return r.data; },
    retry: 1,
  });

  const items = data?.data || [];
  const overdue = items.filter((c: any) => c.status === "overdue" || c.status === "expired").length;

  if (isLoading) return <AOSModuleLoadingState label="Loading compliance…" />;

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="Compliance & Regulations" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load compliance reports. Please try again.</p>
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
        icon={<ShieldCheck className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Compliance &amp; Regulations"
        subtitle={`${items.length} compliance ${items.length === 1 ? "item" : "items"} · ${overdue} overdue or expired`}
        actions={
          <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Generate MoE Report</Button>
        }
      />
      <AOSPageBody>
        <StatGrid>
          <KpiCard label="Total Compliance Items" value={items.length} icon={<ShieldCheck className="h-4 w-4" style={{ color: "#107c10" }} />} />
          <KpiCard label="Compliant" value={items.filter((c: any) => c.status === "compliant").length} color="#107c10" icon={<FileText className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />} />
          <KpiCard label="Overdue / Expired" value={overdue} color="#c42b1c" icon={<AlertTriangle className="h-4 w-4" style={{ color: "#c42b1c" }} />} />
        </StatGrid>

        <DataPanel bodyClassName="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Requirement</TableHead><TableHead>Category</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead><TableHead>Last Updated</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8" style={{ color: "var(--w11-text-secondary)" }}>No compliance items configured</TableCell></TableRow>
              ) : items.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name || c.requirement}</TableCell>
                  <TableCell><span className="win11-chip subtle">{c.category}</span></TableCell>
                  <TableCell>{c.due_date ? displayBS(c.due_date) : "—"}</TableCell>
                  <TableCell><StatusChip status={c.status === "compliant" ? "active" : c.status === "pending" ? "pending" : "overdue"} label={c.status} /></TableCell>
                  <TableCell>{c.updated_at ? displayBS(c.updated_at) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
