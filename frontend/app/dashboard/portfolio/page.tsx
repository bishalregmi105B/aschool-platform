"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Award, BadgeCheck, Plus, Search, Star, Trophy, Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Contract: backend /portfolio/students/<uuid>/items (E-numbering: E72).
// Item serializer fields: id, portfolio_id, title, description, item_type,
// media_urls, tags, created_at. There is no cross-student listing or
// "verify" endpoint server-side, so items are browsed per student.
interface PortfolioItem {
  id: string;
  portfolio_id: string;
  title: string;
  description: string;
  item_type: string;
  media_urls: string[] | null;
  tags: string[] | null;
  created_at: string;
}

interface Credential {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  issuer: string | null;
  issued_at: string | null;
  credential_url: string | null;
  badge_url: string | null;
}

export default function PortfolioPage() {
  return (
    <PluginGate slug="student_portfolio">
      <PortfolioContent />
    </PluginGate>
  );
}

function PortfolioContent() {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    item_type: "academic",
  });
  const [showAddCred, setShowAddCred] = useState(false);
  const [credForm, setCredForm] = useState({ title: "", issuer: "", credential_url: "", issued_at: "" });
  const queryClient = useQueryClient();

  const { data: students } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const res = await api.get("/students?per_page=200");
      return res.data?.data || [];
    },
  });

  const {
    data: items,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["portfolio-items", selectedStudentId],
    queryFn: async () => {
      const res = await api.get(
        `/portfolio/students/${selectedStudentId}/items`,
      );
      return (res.data?.data || []) as PortfolioItem[];
    },
    enabled: !!selectedStudentId,
    retry: 1,
  });

  // Micro-credentials (GET/POST /portfolio/students/<id>/credentials) — the
  // page previously never rendered them.
  const {
    data: credentials,
    isLoading: credsLoading,
    isError: credsError,
    refetch: credsRefetch,
  } = useQuery({
    queryKey: ["portfolio-credentials", selectedStudentId],
    queryFn: async () => {
      const res = await api.get(
        `/portfolio/students/${selectedStudentId}/credentials`,
      );
      return (res.data?.data || []) as Credential[];
    },
    enabled: !!selectedStudentId,
    retry: 1,
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      api.post(`/portfolio/students/${selectedStudentId}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portfolio-items"],
      });
      setShowAdd(false);
      setFormData({ title: "", description: "", item_type: "academic" });
      toast.success("Achievement added");
    },
    onError: () => toast.error("Failed to add achievement"),
  });

  const addCredential = useMutation({
    mutationFn: () =>
      api.post(`/portfolio/students/${selectedStudentId}/credentials`, {
        title: credForm.title,
        issuer: credForm.issuer || undefined,
        credential_url: credForm.credential_url || undefined,
        issued_at: credForm.issued_at || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-credentials"] });
      setShowAddCred(false);
      setCredForm({ title: "", issuer: "", credential_url: "", issued_at: "" });
      toast.success("Credential added");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || "Failed to add credential"),
  });

  const categories = [
    "academic",
    "sports",
    "arts",
    "science",
    "community",
    "leadership",
    "other",
  ];

  const selectedStudent = (students || []).find(
    (s: { id: string }) => s.id === selectedStudentId,
  ) as { id: string; first_name: string; last_name: string } | undefined;

  const filtered = (items || []).filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q)
    );
  });

  const grouped = filtered.reduce(
    (acc: Record<string, PortfolioItem[]>, item) => {
      const cat = item.item_type || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {},
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Student Portfolio</h1>
          </div>
          <p className="text-muted-foreground">
            Track achievements, credentials, and project showcases
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          disabled={!selectedStudentId}
          title={
            selectedStudentId
              ? undefined
              : "Select a student first to add achievements"
          }
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Achievement
        </Button>
      </div>

      {/* Student selector + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <select
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 sm:max-w-xs"
        >
          <option value="">Select student…</option>
          {(students || []).map(
            (s: { id: string; first_name: string; last_name: string }) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </option>
            ),
          )}
        </select>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search achievements..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Content */}
      {!selectedStudentId ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Select a student to view their portfolio</p>
          <p className="text-sm mt-1">
            Achievements, credentials, and showcases are tracked per student
          </p>
        </div>
      ) : isError ? (
        <div className="max-w-2xl">
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-sm text-destructive">
                Failed to load this student&apos;s portfolio. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No achievements yet</p>
          <p className="text-sm mt-1">
            {search
              ? "No achievements match your search"
              : "Start by adding student achievements"}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Star className="h-3.5 w-3.5" />
                {category}
                <span className="bg-muted px-2 py-0.5 rounded-full text-xs">
                  {catItems.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {catItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedStudent
                              ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      {item.created_at && (
                        <p className="text-xs text-muted-foreground">
                          Added{" "}
                          {new Date(item.created_at).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Micro-credentials (GET/POST /portfolio/students/:id/credentials) */}
      {selectedStudentId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <BadgeCheck className="h-3.5 w-3.5" />
              Micro-credentials
              {credentials && credentials.length > 0 && (
                <span className="bg-muted px-2 py-0.5 rounded-full text-xs">
                  {credentials.length}
                </span>
              )}
            </h2>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAddCred(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Credential
            </Button>
          </div>
          {credsError ? (
            <Card>
              <CardContent className="py-6 text-center space-y-3">
                <p className="text-sm text-destructive">Failed to load credentials. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => credsRefetch()}>Retry</Button>
              </CardContent>
            </Card>
          ) : credsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !credentials || credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No credentials recorded for this student yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {credentials.map((cred) => (
                <Card key={cred.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <BadgeCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold">{cred.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {cred.issuer || "Issuer not set"}
                          {cred.issued_at
                            ? ` · ${new Date(cred.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                            : ""}
                        </p>
                        {cred.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{cred.description}</p>
                        )}
                        {cred.credential_url && (
                          <a
                            href={cred.credential_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline mt-1 inline-block"
                          >
                            View credential
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Achievement Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Add Achievement
                {selectedStudent && (
                  <span className="block text-sm font-normal text-muted-foreground">
                    for {selectedStudent.first_name}{" "}
                    {selectedStudent.last_name}
                  </span>
                )}
              </h2>
              <button
                onClick={() => setShowAdd(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Title</label>
                <input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, title: e.target.value }))
                  }
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Achievement title"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={formData.item_type}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, item_type: e.target.value }))
                  }
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} className="capitalize">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((d) => ({
                      ...d,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Describe the achievement..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => addMutation.mutate(formData)}
                disabled={addMutation.isPending || !formData.title}
                className="flex-1 gap-2"
              >
                {addMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Add Achievement
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credential Modal */}
      {showAddCred && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Add Credential
                {selectedStudent && (
                  <span className="block text-sm font-normal text-muted-foreground">
                    for {selectedStudent.first_name}{" "}
                    {selectedStudent.last_name}
                  </span>
                )}
              </h2>
              <button
                onClick={() => setShowAddCred(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Title</label>
                <input
                  value={credForm.title}
                  onChange={(e) =>
                    setCredForm((d) => ({ ...d, title: e.target.value }))
                  }
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. NEB SEE Merit Certificate"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Issuer</label>
                <input
                  value={credForm.issuer}
                  onChange={(e) =>
                    setCredForm((d) => ({ ...d, issuer: e.target.value }))
                  }
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. NEB, Coursera, Red Cross"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Credential URL</label>
                <input
                  value={credForm.credential_url}
                  onChange={(e) =>
                    setCredForm((d) => ({ ...d, credential_url: e.target.value }))
                  }
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="https://…"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Issued on</label>
                <input
                  type="date"
                  value={credForm.issued_at}
                  onChange={(e) =>
                    setCredForm((d) => ({ ...d, issued_at: e.target.value }))
                  }
                  className="w-full mt-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => addCredential.mutate()}
                disabled={addCredential.isPending || !credForm.title}
                className="flex-1 gap-2"
              >
                {addCredential.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Add Credential
              </Button>
              <Button variant="outline" onClick={() => setShowAddCred(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
