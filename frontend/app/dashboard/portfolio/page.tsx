"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Award, BadgeCheck, Plus, Search, Star, Trophy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

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

const inputStyle = {
  background: "var(--w11-control-bg)",
  color: "var(--w11-text-primary)",
  border: "1px solid var(--w11-border-default)",
  borderRadius: "var(--w11-radius-md)",
};

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
    <AOSPage>
      {/* Header */}
      <AOSPageHeader
        icon={
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--w11-accent-light)" }}>
            <Award className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />
          </div>
        }
        title="Student Portfolio"
        subtitle="Track achievements, credentials, and project showcases"
        actions={
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
        }
      />
      <AOSPageBody>
        {/* Student selector + Search */}
        <FilterCommandBar>
          <AdvancedSelect
            className="sm:max-w-xs"
            value={selectedStudentId}
            onChange={(v) => setSelectedStudentId(v)}
            clearable
            searchable
            placeholder="Select student…"
            options={(students || []).map(
              (s: { id: string; first_name: string; last_name: string }) => ({
                value: s.id,
                label: `${s.first_name} ${s.last_name}`,
              }),
            )}
          />
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--w11-text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search achievements..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
              style={inputStyle}
            />
          </div>
        </FilterCommandBar>

        {/* Content */}
        {!selectedStudentId ? (
          <DataPanel>
            <AOSEmptyState
              icon={<Trophy className="h-12 w-12" />}
              title="Select a student to view their portfolio"
              description="Achievements, credentials, and showcases are tracked per student"
            />
          </DataPanel>
        ) : isError ? (
          <div className="max-w-2xl">
            <DataPanel>
              <div className="py-10 text-center space-y-3">
                <p className="text-sm" style={{ color: "#c42b1c" }}>
                  Failed to load this student&apos;s portfolio. Please try again.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </DataPanel>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[color:var(--w11-text-secondary)]" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              icon={<Trophy className="h-12 w-12" />}
              title="No achievements yet"
              description={
                search
                  ? "No achievements match your search"
                  : "Start by adding student achievements"
              }
            />
          </DataPanel>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, catItems]) => (
              <div key={category}>
                <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-[color:var(--w11-text-secondary)]">
                  <Star className="h-3.5 w-3.5" />
                  {category}
                  <span className="win11-chip">{catItems.length}</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catItems.map((item) => (
                    <div key={item.id} className="win11-card" style={{ marginBottom: 0 }}>
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{item.title}</p>
                            <p className="text-sm text-[color:var(--w11-text-secondary)]">
                              {selectedStudent
                                ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        {item.description && (
                          <p className="text-sm text-[color:var(--w11-text-secondary)] line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        {item.created_at && (
                          <p className="text-xs text-[color:var(--w11-text-secondary)]">
                            Added{" "}
                            {new Date(item.created_at).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short", year: "numeric" },
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Micro-credentials (GET/POST /portfolio/students/:id/credentials) */}
        {selectedStudentId && (
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-[color:var(--w11-text-secondary)]">
                <BadgeCheck className="h-3.5 w-3.5" />
                Micro-credentials
                {credentials && credentials.length > 0 && (
                  <span className="win11-chip">{credentials.length}</span>
                )}
              </h2>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAddCred(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add Credential
              </Button>
            </div>
            {credsError ? (
              <DataPanel>
                <div className="py-6 text-center space-y-3">
                  <p className="text-sm" style={{ color: "#c42b1c" }}>Failed to load credentials. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={() => credsRefetch()}>Retry</Button>
                </div>
              </DataPanel>
            ) : credsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[color:var(--w11-text-secondary)]" />
              </div>
            ) : !credentials || credentials.length === 0 ? (
              <p className="text-sm py-4 text-[color:var(--w11-text-secondary)]">
                No credentials recorded for this student yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {credentials.map((cred) => (
                  <div key={cred.id} className="win11-card" style={{ marginBottom: 0 }}>
                    <div className="p-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <BadgeCheck className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--w11-accent)" }} />
                        <div className="min-w-0">
                          <p className="font-semibold">{cred.title}</p>
                          <p className="text-sm text-[color:var(--w11-text-secondary)]">
                            {cred.issuer || "Issuer not set"}
                            {cred.issued_at
                              ? ` · ${new Date(cred.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                              : ""}
                          </p>
                          {cred.description && (
                            <p className="text-sm text-[color:var(--w11-text-secondary)] line-clamp-2 mt-1">{cred.description}</p>
                          )}
                          {cred.credential_url && (
                            <a
                              href={cred.credential_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline mt-1 inline-block"
                              style={{ color: "var(--w11-accent)" }}
                            >
                              View credential
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Achievement Modal */}
        {showAdd && (
          <div className="win11-modal-backdrop fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="win11-dialog max-w-md w-full p-6 space-y-4" style={{ background: "var(--w11-surface-solid)" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[color:var(--w11-text-primary)]">
                  Add Achievement
                  {selectedStudent && (
                    <span className="block text-sm font-normal text-[color:var(--w11-text-secondary)]">
                      for {selectedStudent.first_name}{" "}
                      {selectedStudent.last_name}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setShowAdd(false)}
                  className="text-[color:var(--w11-text-secondary)] hover:text-[color:var(--w11-text-primary)]"
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
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                    placeholder="Achievement title"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Category</label>
                  <AdvancedSelect
                    value={formData.item_type}
                    onChange={(v) => setFormData((d) => ({ ...d, item_type: v }))}
                    options={(categories || []).map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
                  />
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
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm resize-none"
                    style={inputStyle}
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
          <div className="win11-modal-backdrop fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="win11-dialog max-w-md w-full p-6 space-y-4" style={{ background: "var(--w11-surface-solid)" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[color:var(--w11-text-primary)]">
                  Add Credential
                  {selectedStudent && (
                    <span className="block text-sm font-normal text-[color:var(--w11-text-secondary)]">
                      for {selectedStudent.first_name}{" "}
                      {selectedStudent.last_name}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setShowAddCred(false)}
                  className="text-[color:var(--w11-text-secondary)] hover:text-[color:var(--w11-text-primary)]"
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
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
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
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
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
                    className="w-full mt-1 rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Issued on</label>
                  <BSDateInput
                    value={credForm.issued_at}
                    onChange={(v) =>
                      setCredForm((d) => ({ ...d, issued_at: v }))
                    }
                    className="w-full mt-1"
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
      </AOSPageBody>
    </AOSPage>
  );
}
