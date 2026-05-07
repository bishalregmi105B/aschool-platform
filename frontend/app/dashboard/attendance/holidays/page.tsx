"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { PluginGate } from "@/lib/plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { CalendarOff, Plus, Pencil, Trash2 } from "lucide-react";

interface Holiday {
  id: string;
  title: string;
  start_date: string;
  end_date?: string;
  date_bs?: string;
  description?: string;
  event_type: string;
}

export default function HolidaysPage() {
  return (
    <PluginGate slug="notices">
      <HolidaysContent />
    </PluginGate>
  );
}

function HolidaysContent() {
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Holiday[]>>("/notices/events", { params: { type: "holiday" } });
      return res.data.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post("/notices/events", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Holiday added");
      setShowAdd(false);
    },
    onError: () => toast.error("Failed to add"),
  });

  if (isLoading) return <PageLoader />;
  const holidays = data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarOff className="h-6 w-6" /> Holiday List</h1>
          <p className="text-muted-foreground">Manage school holidays and vacation days</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" /> Add Holiday</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holiday</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.title}</TableCell>
                  <TableCell>{h.date_bs || h.start_date}</TableCell>
                  <TableCell><Badge variant="secondary">{h.event_type}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{h.description || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {holidays.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No holidays added yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Holiday</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const startDate = fd.get("date"); createMutation.mutate({ title: fd.get("title"), start_date: startDate, end_date: startDate, event_type: "holiday", is_holiday: true, description: fd.get("description") }); }} className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input name="title" required placeholder="Holiday name" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Date</Label><Input name="date" type="date" required /></div>
              <div className="space-y-2"><Label>Type</Label>
                <select name="type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="holiday">Holiday</option>
                  <option value="vacation">Vacation</option>
                  <option value="festival">Festival</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input name="description" placeholder="Optional description" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? <Spinner size="sm" /> : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
