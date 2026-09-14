"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Award, BadgeCheck, Plus, Search, Star, Trophy, Users, Loader2, X, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  KpiCard,
  StatGrid,
  FilterCommandBar,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import { ObjectHeader } from "@/components/aos/kit/detail-kit";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/lib/i18n";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";

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
  const { t } = useI18n();
  // Wave C (plan 34-27): A2 per student — ObjectHeader + tabs (Work /
  // Credentials / Files); the selected student is URL state (?student=<id>).
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const selectedStudentId = routeParams.get("student") || "";
  const setSelectedStudentId = (v: string) => {
    const pathname = windowRoute?.pathname ?? "/dashboard/portfolio";
    const next = new URLSearchParams(routeParams.toString());
    if (v) next.set("student", v);
    else next.delete("student");
    next.delete("tab");
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  };
  const tab = routeParams.get("tab") || "work";
  const setTab = (v: string) => {
    const pathname = windowRoute?.pathname ?? "/dashboard/portfolio";
    const next = new URLSearchParams(routeParams.toString());
    if (v === "work") next.delete("tab");
    else next.set("tab", v);
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  };
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

  const mediaFiles = (items || []).flatMap((item) =>
    (item.media_urls || []).map((url) => ({ url, title: item.title })),
  );
  const mediaCount = mediaFiles.length;

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
        title={t("Student Portfolio", "विद्यार्थी पोर्टफोलियो")}
        subtitle={t("Track achievements, credentials, and project showcases", "उपलब्धि, प्रमाणपत्र र प्रदर्शन ट्र्याक गर्नुहोस्")}
      />
      <AOSPageBody>
        {/* Dashboard KPIs — real counts from the data this page already loads */}
        <StatGrid>
          <KpiCard
            label="Students"
            value={students?.length ?? "—"}
            icon={<Users className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Achievements"
            value={selectedStudentId ? (items?.length ?? "—") : "—"}
            footnote={selectedStudent ? `for ${selectedStudent.first_name} ${selectedStudent.last_name}` : "select a student"}
            color="#107c10"
            icon={<Trophy className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label="Micro-credentials"
            value={selectedStudentId ? (credentials?.length ?? "—") : "—"}
            icon={<BadgeCheck className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label="Categories"
            value={selectedStudentId && items ? Object.keys(grouped).length : "—"}
            icon={<Star className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
          />
        </StatGrid>

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

        {/* A2: persona header + tabbed sections once a student is chosen */}
        {!selectedStudentId ? (
          <DataPanel>
            <AOSEmptyState
              icon={<Trophy className="h-12 w-12" />}
              title={t("Select a student to view their portfolio", "पोर्टफोलियो हेर्न विद्यार्थी छान्नुहोस्")}
              description={t("Achievements, credentials, and showcases are tracked per student", "उपलब्धि, प्रमाणपत्र र प्रदर्शन विद्यार्थीअनुसार ट्र्याक हुन्छन्")}
            />
          </DataPanel>
        ) : (
          <>
            {selectedStudent && (
              <ObjectHeader
                className="win11-card mb-4"
                name={`${selectedStudent.first_name} ${selectedStudent.last_name}`}
                codeLabel="ID"
                code={selectedStudent.id.slice(0, 8)}
                avatar={<Avatar name={`${selectedStudent.first_name} ${selectedStudent.last_name}`} src={(selectedStudent as any).photo_url} />}
                meta={<span className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{(items || []).length} {t("achievements", "उपलब्धि")} · {(credentials || []).length} {t("credentials", "प्रमाणपत्र")}</span>}
                actions={
                  <Button onClick={() => setShowAdd(true)} className="gap-2" size="sm">
                    <Plus className="h-4 w-4" /> {t("Add Achievement", "उपलब्धि थप्नुहोस्")}
                  </Button>
                }
              />
            )}
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="work" badge={items?.length || undefined}>{t("Work", "काम")}</TabsTrigger>
                <TabsTrigger value="credentials" badge={credentials?.length || undefined}>{t("Credentials", "प्रमाणपत्र")}</TabsTrigger>
                <TabsTrigger value="files" badge={mediaCount || undefined}>{t("Files", "फाइलहरू")}</TabsTrigger>
              </TabsList>

              <TabsContent value="work" className="space-y-8">
                {isError ? (
                  <DataPanel>
                    <div className="py-10 text-center space-y-3">
                      <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load this student's portfolio.", "यो विद्यार्थीको पोर्टफोलियो लोड गर्न असफल।")}</p>
                      <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
                    </div>
                  </DataPanel>
                ) : isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
                  </div>
                ) : Object.keys(grouped).length === 0 ? (
                  <DataPanel>
                    <AOSEmptyState
                      icon={<Trophy className="h-12 w-12" />}
                      title={search ? t("No achievements match your search", "खोजसँग मिल्ने उपलब्धि भेटिएन") : t("No achievements yet", "अझै कुनै उपलब्धि छैन")}
                      description={search ? t("Clear the search to see everything.", "सबै हेर्न खोज खाली गर्नुहोस्।") : t("Start by adding student achievements", "सुरुवातमा उपलब्धि थप्नुहोस्")}
                      action={search ? { label: t("Clear", "खाली"), onClick: () => setSearch("") } : (items && !items.length ? { label: t("Add Achievement", "उपलब्धि थप्नुहोस्"), onClick: () => setShowAdd(true) } : undefined)}
                    />
                  </DataPanel>
                ) : (
                  <>
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
                                    <p className="text-xs text-[color:var(--w11-text-secondary)]">{item.item_type}</p>
                                  </div>
                                </div>
                                {item.description && (
                                  <p className="text-sm text-[color:var(--w11-text-secondary)] line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                                {item.media_urls && item.media_urls.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs" style={{ color: "var(--w11-accent)" }}>
                                    <FileImage className="h-3.5 w-3.5" /> {item.media_urls.length} {t("file(s)", "फाइल")}
                                  </div>
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
                  </>
                )}
              </TabsContent>

              <TabsContent value="credentials" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-[color:var(--w11-text-secondary)]">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {t("Micro-credentials", "माइक्रो-प्रमाणपत्र")}
                  </h2>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAddCred(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    {t("Add Credential", "प्रमाणपत्र थप्नुहोस्")}
                  </Button>
                </div>
                {credsError ? (
                  <DataPanel>
                    <div className="py-6 text-center space-y-3">
                      <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load credentials. Please try again.", "प्रमाणपत्र लोड गर्न असफल।")}</p>
                      <Button variant="outline" size="sm" onClick={() => credsRefetch()}>{t("Retry", "पुनःप्रयास")}</Button>
                    </div>
                  </DataPanel>
                ) : credsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
                  </div>
                ) : !credentials || credentials.length === 0 ? (
                  <DataPanel>
                    <AOSEmptyState
                      icon={<BadgeCheck className="h-12 w-12" />}
                      title={t("No credentials recorded yet", "अझै प्रमाणपत्र छैन")}
                      description={t("Record certificates, badges and verified completions for this student.", "इस विद्यार्थीका प्रमाणपत्र र ब्याज रेकर्ड गर्नुहोस्।")}
                      action={{ label: t("Add Credential", "प्रमाणपत्र थप्नुहोस्"), onClick: () => setShowAddCred(true) }}
                    />
                  </DataPanel>
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
                                  {t("View credential", "प्रमाणपत्र हेर्नुहोस्")}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="files">
                {mediaFiles.length === 0 ? (
                  <DataPanel>
                    <AOSEmptyState
                      icon={<FileImage className="h-12 w-12" />}
                      title={t("No files attached yet", "अझै फाइल छैन")}
                      description={t("Media added to achievement items appears here.", "उपलब्धिका मिडिया यहाँ देखिन्छन्।")}
                    />
                  </DataPanel>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {mediaFiles.map((m, i) => (
                      <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="win11-card block" style={{ marginBottom: 0 }}>
                        <div className="p-3">
                          {/\.(png|jpe?g|gif|webp)$/i.test(m.url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.url} alt={m.title} className="h-28 w-full object-cover rounded-md" loading="lazy" />
                          ) : (
                            <div className="h-28 w-full rounded-md flex items-center justify-center" style={{ background: "var(--w11-control-hover)" }}>
                              <FileImage className="h-8 w-8" style={{ color: "var(--w11-text-tertiary)" }} />
                            </div>
                          )}
                          <p className="text-xs mt-2 truncate" title={m.title}>{m.title}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
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
