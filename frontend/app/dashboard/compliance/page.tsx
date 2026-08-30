"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
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

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card><CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load compliance reports. Please try again.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Compliance & Regulations</h1><p className="text-muted-foreground">Government compliance tracking and MoE reports</p></div>
        <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Generate MoE Report</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><ShieldCheck className="h-5 w-5 text-green-600 mb-2" /><p className="text-2xl font-bold">{items.length}</p><p className="text-sm text-muted-foreground">Total Compliance Items</p></CardContent></Card>
        <Card><CardContent className="pt-6"><FileText className="h-5 w-5 text-blue-600 mb-2" /><p className="text-2xl font-bold">{items.filter((c: any) => c.status === "compliant").length}</p><p className="text-sm text-muted-foreground">Compliant</p></CardContent></Card>
        <Card><CardContent className="pt-6"><AlertTriangle className="h-5 w-5 text-red-600 mb-2" /><p className="text-2xl font-bold text-red-600">{overdue}</p><p className="text-sm text-muted-foreground">Overdue / Expired</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Requirement</TableHead><TableHead>Category</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead><TableHead>Last Updated</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No compliance items configured</TableCell></TableRow>
              ) : items.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name || c.requirement}</TableCell>
                  <TableCell><Badge variant="outline">{c.category}</Badge></TableCell>
                  <TableCell>{c.due_date ? displayBS(c.due_date) : "—"}</TableCell>
                  <TableCell><Badge variant={c.status === "compliant" ? "default" : c.status === "pending" ? "secondary" : "destructive"}>{c.status}</Badge></TableCell>
                  <TableCell>{c.updated_at ? displayBS(c.updated_at) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
