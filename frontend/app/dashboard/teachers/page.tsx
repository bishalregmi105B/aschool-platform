"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTeacher,
  deleteTeacher,
  fetchTeachers,
  toggleTeacherActive,
  type TeacherDto,
  updateTeacher,
} from "@/lib/services/dashboard/teachers.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Plus, UserCog, Mail, Phone, Search, Upload, Pencil, Trash2 } from "lucide-react";

type Teacher = TeacherDto;

export default function TeachersPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Teacher | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: fetchTeachers,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createTeacher(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher added successfully");
      setShowAdd(false);
    },
    onError: () => toast.error("Failed to add teacher"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateTeacher(editItem?.id || "", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher updated successfully");
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update teacher"),
  });

  const deleteMutation = useMutation({
    mutationFn: (teacherId: string) => deleteTeacher(teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher deleted successfully");
    },
    onError: () => toast.error("Failed to delete teacher"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (teacherId: string) => toggleTeacherActive(teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher status updated");
    },
    onError: () => toast.error("Failed to update teacher status"),
  });

  if (isLoading) return <PageLoader />;

  const teachers = (data || []).filter((t: Teacher) =>
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6" /> Teachers
          </h1>
          <p className="text-muted-foreground">Manage school teaching staff</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" /> Bulk Upload
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Teacher
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Class Sections</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t: Teacher) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.full_name}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {t.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" /> {t.phone}
                        </div>
                      )}
                      {t.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" /> {t.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(t.subjects || []).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                      {(!t.subjects || t.subjects.length === 0) && (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(t.class_sections || []).map((section) => (
                        <Badge key={section} variant="outline" className="text-xs">{section}</Badge>
                      ))}
                      {(!t.class_sections || t.class_sections.length === 0) && (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? "success" : "destructive"}>
                      {t.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditItem(t)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActiveMutation.mutate(t.id)}
                        disabled={toggleActiveMutation.isPending}
                      >
                        {t.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Delete teacher \"${t.full_name}\"?`)) {
                            deleteMutation.mutate(t.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {teachers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No teachers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Teacher Dialog */}
      <Dialog
        open={showAdd || !!editItem}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setEditItem(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Teacher" : "Add Teacher"}</DialogTitle>
          </DialogHeader>
          <form
            key={editItem?.id || "new-teacher"}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const payload = {
                full_name: fd.get("full_name"),
                email: fd.get("email") || undefined,
                phone: fd.get("phone"),
                is_active: fd.get("is_active") === "on",
                password: fd.get("password") || undefined,
              };

              if (editItem) {
                updateMutation.mutate(payload);
              } else {
                createMutation.mutate(payload);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input name="full_name" required defaultValue={editItem?.full_name} placeholder="Teacher full name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input name="phone" required defaultValue={editItem?.phone} placeholder="+977..." />
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input name="email" type="email" defaultValue={editItem?.email} placeholder="teacher@school.edu.np" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{editItem ? "Update Password" : "Password"}</Label>
              <Input
                name="password"
                type="password"
                required={!editItem}
                placeholder={editItem ? "Leave blank to keep current password" : "Initial password"}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={editItem ? editItem.is_active : true}
                className="h-4 w-4 rounded border-input"
              />
              Active teacher account
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? <Spinner size="sm" /> : editItem ? "Save Changes" : "Add Teacher"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
