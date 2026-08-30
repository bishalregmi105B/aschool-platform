"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { AlertTriangle, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayBS } from "@/lib/nepali_date";

export default function DefaultersPage() {
  return <PluginGate slug="fees"><DefaultersContent /></PluginGate>;
}

function DefaultersContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["fee-defaulters"],
    queryFn: async () => { const r = await api.get("/fees/defaulters"); return r.data; },
  });

  const defaulters = data?.data || [];
  const totalDue = defaulters.reduce((sum: number, d: any) => sum + (d.total_due || 0), 0);

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load defaulters list. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Fee Defaulters</h1><p className="text-muted-foreground">Students with overdue fee payments</p></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Defaulters</p><p className="text-2xl font-bold text-red-600">{defaulters.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Outstanding</p><p className="text-2xl font-bold">Rs. {totalDue.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Average Due</p><p className="text-2xl font-bold">Rs. {defaulters.length ? Math.round(totalDue / defaulters.length).toLocaleString() : 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" /> Defaulters List</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Due Amount</TableHead><TableHead>Overdue Since</TableHead><TableHead>Parent Contact</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {defaulters.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No defaulters — great!</TableCell></TableRow>
              ) : defaulters.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.student_name}</TableCell>
                  <TableCell>{d.class_name || "—"}</TableCell>
                  <TableCell className="font-bold text-red-600">Rs. {d.total_due?.toLocaleString()}</TableCell>
                  <TableCell>{d.overdue_since ? displayBS(d.overdue_since) : "—"}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {d.parent_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {d.parent_phone}</span>}
                      {d.parent_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {d.parent_email}</span>}
                    </div>
                  </TableCell>
                  <TableCell><Button size="sm" variant="outline">Send Reminder</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
