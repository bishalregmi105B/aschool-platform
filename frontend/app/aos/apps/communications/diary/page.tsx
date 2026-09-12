"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PluginGate } from "@/lib/plugins";
import { api, type ApiResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookMarked, Plus, Folder } from "lucide-react";
import Link from "next/link";
import { PageLoader } from "@/components/ui/spinner";

import { BSDateInput } from "@/components/ui/bs-date-input";
interface DiaryCategory {
  id: string;
  name: string;
  color: string;
}

interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  category_name?: string;
  student_name?: string;
  class_name?: string;
  entry_date?: string;
}

interface ClassItem {
  id: string;
  name: string;
}

export default function DiaryPage() {
  return (
    <PluginGate slug="notices">
      <DiaryContent />
    </PluginGate>
  );
}

function DiaryContent() {
  const queryClient = useQueryClient();
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [categoryId, setCategoryId] = useState("none");
  const [classId, setClassId] = useState("none");

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["diary-entries"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DiaryEntry[]>>("/communications/diary");
      return res.data.data ?? [];
    },
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["diary-categories"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DiaryCategory[]>>("/communications/diary/categories");
      return res.data.data ?? [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["academic-classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ClassItem[]>>("/academics/classes?per_page=200");
      return res.data.data ?? [];
    },
  });

  const createEntry = useMutation({
    mutationFn: async (formData: FormData) => {
      const title = String(formData.get("title") || "").trim();
      const content = String(formData.get("content") || "").trim();
      const entryDate = String(formData.get("entry_date") || "").trim();
      const attachmentText = String(formData.get("attachment_urls") || "").trim();
      const attachmentUrls = attachmentText
        ? attachmentText.split(",").map((value) => value.trim()).filter(Boolean)
        : [];

      if (!title || !content) {
        throw new Error("Title and content are required");
      }

      return api.post("/communications/diary", {
        title,
        content,
        entry_date: entryDate || undefined,
        category_id: categoryId !== "none" ? categoryId : undefined,
        class_id: classId !== "none" ? classId : undefined,
        attachment_urls: attachmentUrls,
        is_published: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary-entries"] });
      setShowAddEntry(false);
      setCategoryId("none");
      setClassId("none");
      toast.success("Diary entry created");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.message || "Failed to create diary entry");
    },
  });

  if (entriesLoading || categoriesLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookMarked className="h-6 w-6" /> Student Diary</h1>
          <p className="text-muted-foreground">Create and manage diary entries for students</p>
        </div>
        <Button onClick={() => setShowAddEntry(true)}><Plus className="h-4 w-4 mr-2" /> Add Diary Entry</Button>
      </div>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">Diary Entries</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookMarked className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No diary entries yet</p>
                  <p className="text-sm mt-1">Create diary entries for students with homework, reminders, and notes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <div key={entry.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">{entry.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {[entry.category_name, entry.student_name || entry.class_name, entry.entry_date].filter(Boolean).join(" • ")}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-sm">{entry.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Diary Categories</CardTitle>
              <Button size="sm" asChild><Link href="/dashboard/communications/diary/categories"><Plus className="h-4 w-4 mr-2" /> Add Category</Link></Button>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No diary categories configured.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Folder className="h-5 w-5 text-primary" />
                      <span className="font-medium">{category.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Diary Entry</DialogTitle>
          </DialogHeader>
          <form action={(formData) => createEntry.mutate(formData)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input name="title" required placeholder="Homework reminder" />
              </div>
              <div className="space-y-2">
                <Label>Entry Date</Label>
                <BSDateInput name="entry_date" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All classes</SelectItem>
                    {classes.map((klass) => (
                      <SelectItem key={klass.id} value={klass.id}>{klass.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea name="content" required rows={5} placeholder="Write the diary note for students or guardians." />
            </div>
            <div className="space-y-2">
              <Label>Attachment URLs</Label>
              <Input name="attachment_urls" placeholder="https://example.com/file.pdf, https://example.com/image.jpg" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddEntry(false)}>Cancel</Button>
              <Button type="submit" disabled={createEntry.isPending}>
                {createEntry.isPending ? "Saving..." : "Create Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
