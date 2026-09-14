"use client";

/**
 * Students — A1 registry page (plan Part 32/34 row 1).
 *
 * Where am I: header "Students / N enrolled". What can I do: Add Student
 * (single primary action), quick-links to the 9 student utilities,
 * filter/search the roster. What's the state: 4 KPIs + the table.
 * What's next: the empty states chain to the blocker ("Create your first
 * class →" lives on students/new; here: enroll-first CTA / clear-filters).
 *
 * Rewrite-wave-A changes vs previous version:
 * - Class/gender/status/section filters + page live in the WINDOW ROUTE
 *   (?class=&gender=&status=&section=&page=) so filtered views survive
 *   refresh and are shareable (plan 5.1/33). Text search stays local +
 *   debounced (300 ms, audit 5.5) to avoid a URL push per keystroke.
 * - Quick Links panel → kit <QuickLinks/> (plan 31.3).
 * - Duplicate "Add Student" primary in the table toolbar removed (one
 *   primary per view); Import/Photos stay as secondary actions.
 * - Row delete → undoableDelete (G8/35.4) instead of confirm+hard-delete;
 *   bulk delete keeps ConfirmDialog (mass destructive).
 * - Loading: the table keeps its chrome and shows skeleton rows instead
 *   of an early-return full-page spinner (9.2).
 * - Bilingual chrome via t() (9.7) — the page was English-only.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useAOSRouterNavigate,
  useAOSRouteParams,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm, undoableDelete } from "@/components/ui/confirm-dialog";
import { useDebounced } from "@/components/ui/filter-bar";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, type Column, type BulkAction } from "@/components/ui/data-table";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FilterCommandBar,
  StatGrid,
  KpiCard,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import {
  Plus,
  Pencil,
  Upload,
  ImagePlus,
  Users,
  UserCheck,
  BookOpen,
  Layers,
} from "lucide-react";

/** Module dashboard quick links — mirrors the students plugin manifest
 * (ui.nav.subitems). */
const QUICK_LINK_ITEMS = [
  { labelEn: "Add Student", labelNe: "विद्यार्थी थप्नुहोस्", href: "/dashboard/students/new", icon: "UserPlus" },
  { labelEn: "Bulk Import", labelNe: "बल्क आयात", href: "/dashboard/students/bulk-import", icon: "Upload" },
  { labelEn: "Parents & Guardians", labelNe: "अभिभावक", href: "/dashboard/parents", icon: "Users" },
  { labelEn: "Admission Inquiries", labelNe: "भर्ना अनुरोध", href: "/dashboard/admission", icon: "ClipboardList" },
  { labelEn: "Assign Roll Numbers", labelNe: "रोल नम्बर तोक्नुहोस्", href: "/dashboard/students/roll-numbers", icon: "ListOrdered" },
  { labelEn: "Upload Profile Images", labelNe: "फोटो अपलोड", href: "/dashboard/students/profile-images", icon: "ImagePlus" },
  { labelEn: "Transfer Student", labelNe: "स्थानान्तरण", href: "/dashboard/students/transfers", icon: "ArrowRightLeft" },
  { labelEn: "Promote Students", labelNe: "उन्नतीकरण", href: "/dashboard/students/promote", icon: "TrendingUp" },
  { labelEn: "Reset Password", labelNe: "पासवर्ड रिसेट", href: "/dashboard/students/reset-password", icon: "KeyRound" },
];

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  transferred_in: "Transferred In",
  transferred_out: "Transferred Out",
  dropped_out: "Dropped Out",
  graduated: "Graduated",
  on_leave: "On Leave",
};

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  enrollment_number: string;
  class_id?: string;
  section_id?: string;
  gender: string;
  status: string;
  dob_bs?: string;
  blood_group?: string;
  phone?: string;
  email?: string;
  photo_url?: string | null;
  class_name?: string;
  section_name?: string;
  guardians?: Array<{
    id: string;
    full_name: string;
    phone: string;
    relationship: string;
  }>;
}

interface StudentListResponse {
  items: Student[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/** Write one query param into the enclosing AOS window's route (→ address
 * bar). `page` resets when any other filter changes, matching the
 * useUrlFilters contract from ui/filter-bar. */
function useRouteFilter() {
  const params = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/students";

  return useCallback(
    (patch: Record<string, string>, opts?: { keepPage?: boolean }) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!opts?.keepPage && !("page" in patch)) next.delete("page");
      const qs = next.toString();
      navigate(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, navigate, pathname]
  );
}

export default function StudentsPage() {
  const { t } = useI18n();
  const routeParams = useAOSRouteParams();
  const setRouteFilter = useRouteFilter();

  const pageSize = 20;
  // Text search is ephemeral (local, debounced); selects/pagination are URL
  // state so the filtered roster survives refresh + sharing (plan 5.1).
  const [search, setSearch] = useState(() => routeParams.get("q") ?? "");
  const debouncedSearch = useDebounced(search, 300);

  const filterClassId = routeParams.get("class") ?? "";
  const filterSectionId = routeParams.get("section") ?? "";
  const filterGender = routeParams.get("gender") ?? "";
  const filterStatus = routeParams.get("status") ?? "";
  const page = Number(routeParams.get("page") || "1");

  const [editStudent, setEditStudent] = useState<Student | null>(null);
  // Row drill-in drawer — a quick look without leaving the list.
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const navigate = useAOSRouterNavigate();

  // Classes feed the class/section filters and the Classes/Sections KPIs.
  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const r = await api.get("/academics/classes");
      return r.data?.data || [];
    },
  });
  const classes: Array<{
    id: string;
    name: string;
    sections?: Array<{ id: string; name: string }>;
  }> = classesData || [];
  const selectedClass = classes.find((c) => c.id === filterClassId);
  const sections = selectedClass?.sections || [];

  // Cheap count queries for the KPI row — per_page=1 so only the pagination
  // totals are read, never the rows.
  const { data: totalCount } = useQuery({
    queryKey: ["students", "count"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/students?per_page=1");
      return res.data?.meta?.pagination?.total as number | undefined;
    },
  });
  const { data: activeCount } = useQuery({
    queryKey: ["students", "count", "active"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/students?per_page=1&status=active");
      return res.data?.meta?.pagination?.total as number | undefined;
    },
  });

  const listQueryKey = useMemo(
    () => [
      "students",
      "list",
      page,
      debouncedSearch,
      filterGender,
      filterStatus,
      filterClassId,
      filterSectionId,
    ],
    [page, debouncedSearch, filterGender, filterStatus, filterClassId, filterSectionId]
  );

  const { data, isLoading, isError, refetch: refetchStudents } = useQuery({
    queryKey: listQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(pageSize),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterGender) params.set("gender", filterGender);
      if (filterStatus) params.set("status", filterStatus);
      if (filterClassId) {
        params.set("class_id", filterClassId);
        if (filterSectionId) params.set("section_id", filterSectionId);
      }
      const res = await api.get<ApiResponse<StudentListResponse>>(
        `/students?${params}`
      );
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/students/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => toast.error(t("Failed to delete student", "विद्यार्थी मेटाउन असफल")),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post("/students/bulk-delete", { ids }),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(
        t(`${ids.length} student(s) deleted`, `${ids.length} विद्यार्थी मेटाइयो`)
      );
    },
    onError: () => toast.error(t("Bulk delete failed", "बल्क मेटाउन असफल")),
  });

  const students = Array.isArray(data?.data) ? data.data : [];
  const pagination = data?.meta?.pagination;

  const hasActiveFilters =
    !!filterClassId || !!filterSectionId || !!filterGender || !!filterStatus;

  function clearFilters() {
    setRouteFilter({ class: "", section: "", gender: "", status: "", page: "" });
  }

  async function handleBulkDelete(rows: Student[]) {
    const ok = await confirm({
      title: t(
        `Delete ${rows.length} selected student(s)?`,
        `चयनित ${rows.length} विद्यार्थी मेटाउने?`
      ),
      body: t(
        "This cannot be undone — their login and guardian links are removed too.",
        "यो फिर्ता हुँदैन — तिनको लगइन र अभिभावक लिंक हट्छ।"
      ),
      confirmLabel: t("Delete students", "विद्यार्थी मेटाउनुहोस्"),
      tone: "danger",
    });
    if (!ok) return;
    bulkDeleteMutation.mutate(rows.map((r) => r.id));
  }

  // G8: single-row delete is undoable (optimistic hide + 5 s grace) instead
  // of a scary confirm for a routine tidy-up.
  function handleDeleteRow(s: Student) {
    undoableDelete({
      label: t(`${s.first_name} ${s.last_name}`, `${s.first_name} ${s.last_name}`),
      optimistic: () => {
        queryClient.setQueryData(listQueryKey, (prev: ApiResponse<StudentListResponse> | undefined) => {
          if (!prev?.data) return prev;
          const rows = prev.data as unknown as Student[];
          return { ...prev, data: rows.filter((x) => x.id !== s.id) as unknown as typeof prev.data };
        });
      },
      commit: async () => {
        await deleteMutation.mutateAsync(s.id);
      },
      rollback: () => {
        queryClient.invalidateQueries({ queryKey: ["students"] });
      },
    });
  }

  const classLabel = (s: Student) =>
    s.class_name
      ? `Class ${s.class_name.replace(/^\s*class\s+/i, "")}${s.section_name ? ` - ${s.section_name}` : ""}`
      : "—";

  // ── DataTable wiring ──────────────────────────────────────────────────
  const COLUMNS: Column<Student>[] = [
    {
      key: "student",
      label: t("Student", "विद्यार्थी"),
      sortable: true,
      value: (s) => `${s.first_name} ${s.last_name}`,
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar
            src={s.photo_url}
            name={`${s.first_name} ${s.last_name}`}
            size="sm"
          />
          <span className="font-medium">
            {s.first_name} {s.last_name}
          </span>
        </div>
      ),
    },
    { key: "enrollment_number", label: t("Enrollment No.", "भर्ना नम्बर"), sortable: true, value: (s) => s.enrollment_number },
    {
      key: "class_name",
      label: t("Class", "कक्षा"),
      sortable: true,
      value: (s) => s.class_name ?? "",
      render: (s) =>
        // E204: class names can already carry the "Class " prefix (legacy
        // rows store "Class 10") — strip before prepending.
        classLabel(s),
    },
    {
      key: "gender",
      label: t("Gender", "लिङ्ग"),
      sortable: true,
      value: (s) => s.gender ?? "",
      render: (s) => <span className="capitalize">{s.gender || "—"}</span>,
    },
    {
      key: "status",
      label: t("Status", "अवस्था"),
      sortable: true,
      value: (s) => s.status,
      render: (s) => (
        <StatusChip status={s.status} label={STATUS_LABELS[s.status] ?? s.status} />
      ),
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (s) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => setEditStudent(s)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {t("Edit", "सम्पादन")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#c42b1c]"
            onClick={() => handleDeleteRow(s)}
          >
            {t("Delete", "मेटाउनुहोस्")}
          </Button>
        </div>
      ),
    },
  ];

  const BULK_ACTIONS: BulkAction<Student>[] = [
    {
      key: "delete",
      label: t("Delete selected", "चयनित मेटाउनुहोस्"),
      tone: "danger",
      onClick: (rows) => void handleBulkDelete(rows),
    },
    {
      key: "promote",
      label: t("Promote…", "उन्नतीकरण…"),
      onClick: () => navigate("/dashboard/students/promote"),
    },
    {
      key: "reset-pw",
      label: t("Reset passwords…", "पासवर्ड रिसेट…"),
      onClick: () => navigate("/dashboard/students/reset-password"),
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Users className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Students", "विद्यार्थी")}
        subtitle={t(
          `${pagination?.total ?? totalCount ?? 0} students enrolled`,
          `${pagination?.total ?? totalCount ?? 0} विद्यार्थी भर्ना`
        )}
        actions={
          <Button onClick={() => navigate("/dashboard/students/new")}>
            <Plus className="h-4 w-4 mr-2" />
            {t("Add Student", "विद्यार्थी थप्नुहोस्")}
          </Button>
        }
      />
      <AOSPageBody>
        {/* Module dashboard — KPIs + quick links above the list (A1+hub) */}
        <StatGrid min={170}>
          <KpiCard
            label={t("Total Students", "कुल विद्यार्थी")}
            value={totalCount ?? "—"}
            icon={<Users className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Active", "सक्रिय")}
            value={activeCount ?? "—"}
            denominator={totalCount != null ? `/ ${totalCount}` : undefined}
            color="#107c10"
            icon={<UserCheck className="h-4 w-4" style={{ color: "#107c10" }} />}
          />
          <KpiCard
            label={t("Classes", "कक्षा")}
            value={classes.length}
            icon={<BookOpen className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            color="var(--w11-text-primary)"
          />
          <KpiCard
            label={t("Sections", "सेक्सन")}
            value={classes.reduce((sum, c) => sum + (c.sections?.length ?? 0), 0)}
            icon={<Layers className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            color="var(--w11-text-primary)"
          />
        </StatGrid>

        <QuickLinks
          section="Core"
          className="mb-4"
          links={QUICK_LINK_ITEMS.map((l) => ({
            href: l.href,
            icon: l.icon,
            label: t(l.labelEn, l.labelNe),
          }))}
        />

        {/* URL-backed filters (class → section, gender, status) above the
            table; DataTable keeps search + Columns + Export. */}
        <FilterCommandBar>
          <AdvancedSelect
            className="w-36"
            value={filterClassId}
            onChange={(v) =>
              setRouteFilter({ class: v || "", section: "" })
            }
            clearable
            placeholder={t("All Classes", "सबै कक्षा")}
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          {filterClassId && sections.length > 0 && (
            <AdvancedSelect
              className="w-32"
              value={filterSectionId}
              onChange={(v) => setRouteFilter({ section: v || "" })}
              clearable
              placeholder={t("All Sections", "सबै सेक्सन")}
              options={sections.map((sec) => ({ value: sec.id, label: sec.name }))}
            />
          )}
          <AdvancedSelect
            className="w-32"
            value={filterGender}
            onChange={(v) => setRouteFilter({ gender: v || "" })}
            clearable
            placeholder={t("All Genders", "सबै लिङ्ग")}
            options={[
              { value: "male", label: t("Male", "पुरुष") },
              { value: "female", label: t("Female", "महिला") },
              { value: "other", label: t("Other", "अन्य") },
            ]}
          />
          <AdvancedSelect
            className="w-36"
            value={filterStatus}
            onChange={(v) => setRouteFilter({ status: v || "" })}
            clearable
            placeholder={t("All Statuses", "सबै अवस्था")}
            options={Object.entries(STATUS_LABELS).map(([val, label]) => ({ value: val, label }))}
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="text-[12px]" onClick={clearFilters}>
              {t(`Clear filters`, "फिल्टर हटाउनुहोस्")}
            </Button>
          )}
        </FilterCommandBar>

        {/* Students table — one component for selection, sort, pagination,
            export; row click opens the detail drawer. */}
        <DataPanel bodyClassName="p-0">
          <DataTable<Student>
            columns={COLUMNS}
            rows={students}
            rowKey={(s) => s.id}
            loading={isLoading}
            error={isError ? t("Failed to load students.", "विद्यार्थी लोड हुन सकेन।") : null}
            onRetry={isError ? () => void refetchStudents() : undefined}
            searchable
            searchValue={search}
            onSearchChange={(v) => setSearch(v)}
            searchPlaceholder={t(
              "Search by name or enrollment number...",
              "नाम वा भर्ना नम्बरले खोज्नुहोस्…"
            )}
            selectable
            bulkActions={BULK_ACTIONS}
            onRowClick={(s) => setViewStudent(s)}
            activeRowKey={viewStudent?.id ?? null}
            pagination={pagination ? {
              page: pagination.page,
              pages: pagination.pages,
              total: pagination.total,
              per_page: pagination.per_page,
              has_next: pagination.has_next ?? pagination.page < pagination.pages,
              has_prev: pagination.has_prev ?? pagination.page > 1,
            } : undefined}
            onPageChange={(p) => setRouteFilter({ page: String(p) }, { keepPage: true })}
            exportFileName="students"
            empty={
              hasActiveFilters || debouncedSearch
                ? {
                    icon: Users,
                    title: t("No students match this search", "यस खोजसँग कुनै विद्यार्थी भेटिएन"),
                    body: t(
                      "Widen the filters or clear them to see the full roster.",
                      "फिल्टर फराकिलो पार्नुहोस् वा हटाउनुहोस्।"
                    ),
                    action: {
                      label: t("Clear filters", "फिल्टर हटाउनुहोस्"),
                      onClick: () => {
                        clearFilters();
                        setSearch("");
                      },
                    },
                  }
                : {
                    icon: Users,
                    title: t("No students found", "कुनै विद्यार्थी भेटिएन"),
                    body: t(
                      "Enroll your first student to get started.",
                      "सुरु गर्न पहिलो विद्यार्थी भर्ना गर्नुहोस्।"
                    ),
                    action: { label: t("Add Student", "विद्यार्थी थप्नुहोस्"), href: "/dashboard/students/new" },
                  }
            }
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/students/bulk-import")}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> {t("Import", "आयात")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/students/profile-images")}>
                  <ImagePlus className="h-3.5 w-3.5 mr-1" /> {t("Photos", "फोटो")}
                </Button>
              </div>
            }
          />
        </DataPanel>

        {/* Detail drawer — the quick view without leaving the list */}
        <Sheet open={!!viewStudent} onOpenChange={(open) => !open && setViewStudent(null)}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <div className="border-b border-[color:var(--w11-border-subtle)] px-4 py-3">
              <SheetTitle className="text-[15px] font-semibold">
                {t("Student Details", "विद्यार्थी विवरण")}
              </SheetTitle>
            </div>
            {viewStudent && (
              <div className="space-y-5 px-4 pb-6">
                <div className="flex items-center gap-4">
                  <Avatar
                    src={viewStudent.photo_url}
                    name={`${viewStudent.first_name} ${viewStudent.last_name}`}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="text-base font-semibold truncate">
                      {viewStudent.first_name} {viewStudent.last_name}
                    </p>
                    <p className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
                      {viewStudent.enrollment_number || t("No enrollment no.", "भर्ना नम्बर छैन")}
                    </p>
                    <StatusChip
                      status={viewStudent.status}
                      label={STATUS_LABELS[viewStudent.status] ?? viewStudent.status}
                      className="mt-1"
                    />
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                  {[
                    [t("Class", "कक्षा"), classLabel(viewStudent)],
                    [
                      t("Gender", "लिङ्ग"),
                      viewStudent.gender
                        ? viewStudent.gender.charAt(0).toUpperCase() + viewStudent.gender.slice(1)
                        : "—",
                    ],
                    [t("Guardian", "अभिभावक"), viewStudent.guardians?.[0]?.full_name || "—"],
                    [t("Guardian Phone", "अभिभावक फोन"), viewStudent.guardians?.[0]?.phone || "—"],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <dt
                        className="text-[10px] font-medium uppercase tracking-wide"
                        style={{ color: "var(--w11-text-secondary)" }}
                      >
                        {k}
                      </dt>
                      <dd className="mt-0.5 font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex gap-2 border-t border-[color:var(--w11-border-subtle)] pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setEditStudent(viewStudent);
                      setViewStudent(null);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> {t("Edit", "सम्पादन")}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/dashboard/students/${viewStudent.id}`)}
                  >
                    {t("Full Profile", "पूरा प्रोफाइल")}
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {editStudent && (
          <EditStudentDialog
            student={editStudent}
            onOpenChange={(open) => {
              if (!open) setEditStudent(null);
            }}
          />
        )}
      </AOSPageBody>
    </AOSPage>
  );
}

function EditStudentDialog({
  student,
  onOpenChange,
}: {
  student: Student;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState(student.first_name);
  const [lastName, setLastName] = useState(student.last_name);
  const [gender, setGender] = useState(student.gender || "unknown");
  const [status, setStatus] = useState(student.status || "active");
  const [classId, setClassId] = useState(student.class_id || "none");
  const [sectionId, setSectionId] = useState(student.section_id || "none");
  const [phone, setPhone] = useState(student.phone || "");
  const [email, setEmail] = useState(student.email || "");
  const [dobBs, setDobBs] = useState(student.dob_bs || "");
  const [bloodGroup, setBloodGroup] = useState(student.blood_group || "");
  const [password, setPassword] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  const selectedClass = (classes || []).find((c: any) => c.id === classId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/students/${student.id}`, {
        first_name: firstName,
        last_name: lastName,
        gender: gender === "unknown" ? null : gender,
        status,
        class_id: classId === "none" ? null : classId,
        section_id: sectionId === "none" ? null : sectionId,
        phone: phone || null,
        email: email || null,
        dob_bs: dobBs || null,
        blood_group: bloodGroup || null,
        password: password || undefined,
      });
      toast.success(t("Student updated", "विद्यार्थी अद्यावधिक भयो"));
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", student.id] });
      onOpenChange(false);
    } catch {
      toast.error(t("Failed to update student", "अद्यावधिक हुन सकेन"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Edit Student", "विद्यार्थी सम्पादन")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("First Name", "पहिलो नाम")}</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{t("Last Name", "थर")}</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Class / Grade", "कक्षा")}</Label>
              <Select
                value={classId}
                onValueChange={(value) => {
                  setClassId(value);
                  setSectionId("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select class", "कक्षा छान्नुहोस्")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("Not assigned", "तोकिएको छैन")}</SelectItem>
                  {(classes || []).map((klass: any) => (
                    <SelectItem key={klass.id} value={klass.id}>
                      {klass.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Section", "सेक्सन")}</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Select section", "सेक्सन छान्नुहोस्")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("Not assigned", "तोकिएको छैन")}</SelectItem>
                  {(selectedClass?.sections || []).map((section: any) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Gender", "लिङ्ग")}</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">{t("Not specified", "तोकिएको छैन")}</SelectItem>
                  <SelectItem value="male">{t("Male", "पुरुष")}</SelectItem>
                  <SelectItem value="female">{t("Female", "महिला")}</SelectItem>
                  <SelectItem value="other">{t("Other", "अन्य")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Status", "अवस्था")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Phone", "फोन")}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98XXXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Email", "इमेल")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@email.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Date of Birth (BS)", "जन्म मिति (बि.सं.)")}</Label>
              <BSDateInput value={dobBs} onChange={(v) => setDobBs(v)} emit="bs" />
            </div>
            <div className="space-y-2">
              <Label>{t("Blood Group", "रगत समूह")}</Label>
              <Input
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                placeholder="e.g. A+"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_password">{t("Update Password", "पासवर्ड अद्यावधिक")}</Label>
            <Input
              id="edit_password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("Leave blank to keep current", "हालको राख्न खालि छोड्नुहोस्")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancel", "रद्द")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : t("Save Changes", "सुरक्षित")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
