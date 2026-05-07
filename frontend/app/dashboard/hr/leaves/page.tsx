"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { ArrowLeft, Check, X, Calendar } from "lucide-react";
import Link from "next/link";

export default function LeavesPage() {
  return <PluginGate slug="hr"><LeavesContent /></PluginGate>;
}

function LeavesContent() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["leaves", filter],
    queryFn: async () => { const r = await api.get("/hr/leaves", { params: { status: filter !== "all" ? filter : undefined } }); return r.data; },
  });

  const leaves = data?.data || [];

  const approve = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => (await api.patch(`/hr/leaves/${id}`, { status: action })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leaves"] }); toast.success("Updated!"); },
    onError: () => toast.error("Action failed"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/hr"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1"><h1 className="text-2xl font-bold">Leave Management</h1><p className="text-muted-foreground">Review and manage staff leave requests</p></div>
      </div>

      <div className="flex gap-2">
        {["pending", "approved", "rejected", "all"].map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {leaves.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No leave requests</TableCell></TableRow>
              ) : leaves.map((l: any) => {
                const days = l.days || (l.from_date && l.to_date ? Math.ceil((new Date(l.to_date).getTime() - new Date(l.from_date).getTime()) / 86400000) + 1 : 1);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.staff_name}</TableCell>
                    <TableCell><Badge variant="outline">{l.leave_type || l.type}</Badge></TableCell>
                    <TableCell>{l.from_date ? new Date(l.from_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{l.to_date ? new Date(l.to_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{days}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{l.reason || "—"}</TableCell>
                    <TableCell><Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge></TableCell>
                    <TableCell>
                      {l.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="text-green-600" onClick={() => approve.mutate({ id: l.id, action: "approved" })}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-600" onClick={() => approve.mutate({ id: l.id, action: "rejected" })}><X className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
