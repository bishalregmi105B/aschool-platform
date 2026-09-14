"use client";

/**
 * Academics — A5 hub with tabbed master data (plan Part 34 row 3, 8.1).
 *
 * Rewrite changes vs the 1,285-L previous version:
 * - Hand-rolled button tab strip (plan G2 offender) → kit <Tabs> with
 *   Fluent win11-tablist styling + Radix keyboard nav, synced to the window
 *   route (?tab=years|classes|subjects). Legacy subroutes launched from the
 *   AOS menu (class-sections / subjects re-export this page) resolve to the
 *   right tab via the window path — the "subroute deep-links into a tab"
 *   standard from Part 33.
 * - Quick Links now point AT the tabs (?tab=) instead of the four dead-end
 *   stub URLs, and merge the old ACADEMIC_TOOLS cards into the same
 *   QuickLinks grid (one launcher grammar, one fewer section).
 * - RowActions' bespoke delete Dialog → useConfirm() (single grammar).
 * - Academic-year made a visible axis (8.1): header chip shows the current
 *   session; Classes tab gains a year filter when the payload carries
 *   academic_year_id.
 * - Skeletons instead of early-return PageLoader; tab count badges;
 *   bilingual chrome (the page was English-only).
 * Endpoints/service calls and every payload are unchanged.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import {
  createAcademicYear,
  createClass,
  createSection,
  createSubject,
  deleteAcademicYear,
  deleteClass,
  deleteSection,
  deleteSubject,
  fetchAcademicYears,
  fetchClasses,
  fetchSubjects,
  updateAcademicYear,
  updateClass,
  updateSection,
  updateSubject,
} from "@/lib/services/dashboard/academics.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SkeletonTable } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { displayBS } from "@/lib/nepali_date";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  FormSection,
  StatGrid,
  KpiCard,
  StatusChip,
} from "@/components/aos/kit/page-kit";
import { QuickLinks } from "@/components/aos/kit/quick-links";
import {
  BookMarked,
  BookOpen,
  CalendarRange,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

type AcademicsTab = "years" | "classes" | "subjects";

interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface SectionItem {
  id: string;
  name: string;
  capacity: number | null;
  class_teacher_id?: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  name_nepali?: string;
  numeric_grade: number | null;
  academic_year_id?: string | null;
  sections: SectionItem[];
}

interface Subject {
  id: string;
  name: string;
  name_nepali?: string;
  code: string;
  credit_hours: number;
  is_optional: boolean;
  full_marks?: number | null;
  pass_marks?: number | null;
  has_practical?: boolean;
  practical_full_marks?: number | null;
  practical_pass_marks?: number | null;
}

function getDateInputValue(value?: string | null) {
  if (!value) return "";
  const trimmed = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

/** Resolve the initial tab from the window route: `?tab=` wins; the legacy
 * re-export subroutes (class-sections / subjects mount this same page via
 * the registry) map onto their tab. */
function tabFromRoute(tabParam: string | null, path: string): AcademicsTab {
  if (tabParam === "years" || tabParam === "classes" || tabParam === "subjects") {
    return tabParam;
  }
  if (path.includes("class-sections") || path.includes("class-teachers")) return "classes";
  if (path.endsWith("/subjects")) return "subjects";
  return "years";
}

export default function AcademicsPage() {
  const { t } = useI18n();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const routeParams = useAOSRouteParams();

  const tab = tabFromRoute(routeParams.get("tab"), windowRoute?.pathname ?? "/dashboard/academics");

  function setTab(next: AcademicsTab) {
    const base = windowRoute?.pathname?.endsWith("/academics")
      ? windowRoute.pathname
      : "/dashboard/academics";
    navigate(`${base}?tab=${next}`);
  }

  // Dashboard KPI queries — same query keys as the tabs below, so the counts
  // double as pre-warmed tab data (no extra fetches beyond what tabs load).
  const { data: yearsData } = useQuery({
    queryKey: ["academic-years"],
    queryFn: fetchAcademicYears,
  });
  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: fetchClasses,
  });
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: fetchSubjects,
  });

  const years = yearsData || [];
  const classes = classesData || [];
  const subjects = subjectsData || [];
  const currentYear = years.find((y) => y.is_current);
  const sectionsCount = classes.reduce((sum, c) => sum + (c.sections?.length ?? 0), 0);

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BookOpen className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Academics", "शैक्षिक संरचना")}
        subtitle={t(
          `${classes.length} classes · ${sectionsCount} sections · ${subjects.length} subjects · ${years.length} academic years`,
          `${classes.length} कक्षा · ${sectionsCount} सेक्सन · ${subjects.length} विषय · ${years.length} शैक्षिक वर्ष`,
        )}
        actions={
          currentYear ? (
            <StatusChip status="active" label={`${t("Session", "सत्र")}: ${currentYear.name}`} />
          ) : (
            <StatusChip status="pending" label={t("No current session", "वर्तमान सत्र छैन")} />
          )
        }
      />
      <AOSPageBody>
        {/* Launcher row — tabs + the two mapping subpages, all in one grid */}
        <QuickLinks
          section="Academics"
          className="mb-4"
          links={[
            { label: t("Academic Years", "शैक्षिक वर्ष"), href: "/dashboard/academics?tab=years", icon: "CalendarRange" },
            { label: t("Classes & Sections", "कक्षा र सेक्सन"), href: "/dashboard/academics?tab=classes", icon: "Users" },
            { label: t("Subjects", "विषयहरू"), href: "/dashboard/academics?tab=subjects", icon: "BookMarked" },
            { label: t("Class Subjects", "कक्षा-विषय"), href: "/dashboard/academics/class-subjects", icon: "Link2" },
            { label: t("Class Teachers", "कक्षा-शिक्षक"), href: "/dashboard/academics/class-teachers", icon: "UserCog" },
          ]}
        />

        <StatGrid min={170}>
          <KpiCard
            label={t("Academic Years", "शैक्षिक वर्ष")}
            value={yearsData ? years.length : "—"}
            icon={<BookOpen className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />}
          />
          <KpiCard
            label={t("Current Year", "वर्तमान वर्ष")}
            value={currentYear?.name ?? "—"}
            footnote={currentYear ? t("set as current", "वर्तमान") : t("none marked current", "कुनै छैन")}
            icon={<CalendarRange className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            color="var(--w11-text-primary)"
          />
          <KpiCard
            label={t("Classes", "कक्षा")}
            value={classesData ? classes.length : "—"}
            denominator={`/ ${sectionsCount} ${t("sections", "सेक्सन")}`}
            icon={<Users className="h-4 w-4" style={{ color: "var(--w11-text-secondary)" }} />}
            color="var(--w11-text-primary)"
          />
          <KpiCard
            label={t("Subjects", "विषय")}
            value={subjectsData ? subjects.length : "—"}
            icon={<BookMarked className="h-4 w-4" style={{ color: "#107c10" }} />}
            color="#107c10"
          />
        </StatGrid>

        {/* Fluent pivot tabs — kit Tabs, URL-synced, keyboard-navigable */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as AcademicsTab)}>
          <TabsList variant="underline">
            <TabsTrigger value="years" badge={years.length || undefined}>
              {t("Academic Years", "शैक्षिक वर्ष")}
            </TabsTrigger>
            <TabsTrigger value="classes" badge={classes.length || undefined}>
              {t("Classes & Sections", "कक्षा र सेक्सन")}
            </TabsTrigger>
            <TabsTrigger value="subjects" badge={subjects.length || undefined}>
              {t("Subjects", "विषयहरू")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="years" className="mt-4">
            <AcademicYearsTab />
          </TabsContent>
          <TabsContent value="classes" className="mt-4">
            <ClassesTab years={years} />
          </TabsContent>
          <TabsContent value="subjects" className="mt-4">
            <SubjectsTab />
          </TabsContent>
        </Tabs>
      </AOSPageBody>
    </AOSPage>
  );
}

function RowActions({
  onEdit,
  onDelete,
  deleteLabel,
  deleting = false,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel: string;
  deleting?: boolean;
}) {
  const { t } = useI18n();
  const confirm = useConfirm();
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t("Edit item", "सम्पादन")}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={deleting}
        aria-label={t("Delete item", "मेटाउनुहोस्")}
        onClick={() => {
          void (async () => {
            const ok = await confirm({
              title: t("Delete?", "मेटाउने?"),
              body: deleteLabel,
              confirmLabel: t("Delete", "मेटाउनुहोस्"),
              tone: "danger",
            });
            if (ok) onDelete();
          })();
        }}
      >
        {deleting ? <Spinner size="sm" /> : <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />}
      </Button>
    </div>
  );
}

function AcademicYearsTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<AcademicYear | null>(null);
  // E219: Start/End are REQUIRED — a year without dates is meaningless
  // (the seeded "2082" had none). BSDateInput's hidden input always carries a
  // value (it defaults to today), so "required" is enforced here by only
  // accepting a submission once the user has actually picked both dates
  // (edit dialogs start from the stored dates instead).
  const [pickedDates, setPickedDates] = useState<{ start?: string; end?: string }>({});
  const [isCurrentYear, setIsCurrentYear] = useState(false);

  const openYearDialog = (year: AcademicYear | null) => {
    setPickedDates(
      year
        ? { start: getDateInputValue(year.start_date) || undefined, end: getDateInputValue(year.end_date) || undefined }
        : {}
    );
    setIsCurrentYear(Boolean(year?.is_current));
    if (year) {
      setEditItem(year);
    } else {
      setShowAdd(true);
    }
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["academic-years"],
    queryFn: fetchAcademicYears,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createAcademicYear(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success(t("Academic year created", "शैक्षिक वर्ष बन्यो"));
      setShowAdd(false);
    },
    onError: () => toast.error(t("Failed to create academic year", "वर्ष बनेन")),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateAcademicYear(editItem?.id || "", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success(t("Academic year updated", "वर्ष अद्यावधिक"));
      setEditItem(null);
    },
    onError: () => toast.error(t("Failed to update academic year", "अद्यावधिक भएन")),
  });

  const deleteMutation = useMutation({
    mutationFn: (yearId: string) => deleteAcademicYear(yearId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success(t("Academic year deleted", "वर्ष मेटियो"));
    },
    onError: () => toast.error(t("Failed to delete academic year", "मेटिएन")),
  });

  if (isError) return <ErrorState body={t("Failed to load academic years.", "वर्ष लोड हुन सकेन।")} onRetry={() => void refetch()} />;
  if (isLoading) return <SkeletonTable rows={5} columns={4} />;

  const years = data || [];

  const YEAR_COLUMNS: Column<AcademicYear>[] = [
    { key: "name", label: t("Name", "नाम"), sortable: true, value: (y) => y.name, render: (y) => <span className="font-medium">{y.name}</span> },
    { key: "start_date", label: t("Start Date", "सुरु मिति"), sortable: true, value: (y) => y.start_date, render: (y) => displayBS(y.start_date) || "-" },
    { key: "end_date", label: t("End Date", "अन्त्य मिति"), sortable: true, value: (y) => y.end_date, render: (y) => displayBS(y.end_date) || "-" },
    {
      key: "is_current",
      label: t("Status", "अवस्था"),
      sortable: true,
      value: (y) => (y.is_current ? "current" : "past"),
      render: (y) => (
        <StatusChip status={y.is_current ? "active" : "pending"} label={y.is_current ? t("Current", "वर्तमान") : t("Past", "पुरानो")} />
      ),
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (y) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => openYearDialog(y)}
            onDelete={() => deleteMutation.mutate(y.id)}
            deleteLabel={t(`Delete academic year "${y.name}"? Classes and exams referencing it may fail to load.`, `"${y.name}" वर्ष मेटाउने?`)}
            deleting={deleteMutation.isPending}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <DataPanel
        title={t("Academic Years", "शैक्षिक वर्ष")}
        actions={
          <Button size="sm" onClick={() => openYearDialog(null)}>
            <Plus className="mr-2 h-4 w-4" /> {t("Add Year", "वर्ष थप्नुहोस्")}
          </Button>
        }
        bodyClassName="p-0"
      >
        <DataTable<AcademicYear>
          columns={YEAR_COLUMNS}
          rows={years}
          rowKey={(y) => y.id}
          searchable
          searchPlaceholder={t("Search years…", "वर्ष खोज्नुहोस्…")}
          exportFileName="academic-years"
          empty={{
            icon: BookOpen,
            title: t("No academic years yet", "अझै शैक्षिक वर्ष छैन"),
            body: t("Create your first academic year — everything (classes, exams, fees) hangs off it.", "पहिलो शैक्षिक वर्ष बनाउनुहोस् — सबै कुरा यसमा टाँसिन्छ।"),
            action: { label: t("Add Year", "वर्ष थप्नुहोस्"), onClick: () => openYearDialog(null) },
          }}
        />
      </DataPanel>

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
            <DialogTitle>{editItem ? t("Edit Academic Year", "वर्ष सम्पादन") : t("Add Academic Year", "वर्ष थप्नुहोस्")}</DialogTitle>
          </DialogHeader>
          <form
            key={editItem?.id || "new-year"}
            onSubmit={(event) => {
              event.preventDefault();
              // E219: a year without Start/End is rejected with feedback
              // (previously it silently saved, leaving the "N/A" row).
              if (!pickedDates.start || !pickedDates.end) {
                toast.error(t("Start date and End date are both required", "सुरु र अन्त्य मिति अनिवार्य"));
                return;
              }
              const formData = new FormData(event.currentTarget);
              const payload = {
                name: formData.get("name"),
                start_date: pickedDates.start,
                end_date: pickedDates.end,
                is_current: formData.get("is_current") === "on",
              };

              if (editItem) {
                updateMutation.mutate(payload);
              } else {
                createMutation.mutate(payload);
              }
            }}
            className="space-y-4"
          >
            <FormSection title={t("Year Details", "वर्ण विवरण")}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("Name", "नाम")} *</Label>
                  <Input name="name" required defaultValue={editItem?.name} placeholder="2082" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("Start Date", "सुरु मिति")} *</Label>
                    <BSDateInput
                      name="start_date"
                      value={pickedDates.start}
                      onChange={(ad) => setPickedDates((p) => ({ ...p, start: ad }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("End Date", "अन्त्य मिति")} *</Label>
                    <BSDateInput
                      name="end_date"
                      value={pickedDates.end}
                      onChange={(ad) => setPickedDates((p) => ({ ...p, end: ad }))}
                    />
                  </div>
                </div>
                <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                  {t("BS calendar dates (e.g. a school year 2082 runs Baisakh 1, 2082 → Chaitra 30, 2082).", "बि.सं. मिति (२०८२ = बैशाख १ → चैत ३०)।")}
                </p>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={isCurrentYear}
                    onCheckedChange={(v) => setIsCurrentYear(v === true)}
                    aria-label={t("Set as current academic year", "वर्तमान वर्ष तोक्नुहोस्")}
                  />
                  {t("Set as current academic year", "वर्तमान शैक्षिक वर्ष तोक्नुहोस्")}
                </label>
                {/* Radix Checkbox doesn't submit — mirror into FormData */}
                <input type="hidden" name="is_current" value={isCurrentYear ? "on" : ""} />
              </div>
            </FormSection>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAdd(false);
                  setEditItem(null);
                }}
              >
                {t("Cancel", "रद्द")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? <Spinner size="sm" /> : editItem ? t("Update", "अद्यावधिक") : t("Create", "बनाउनुहोस्")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClassesTab({ years }: { years: AcademicYear[] }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [showAddClass, setShowAddClass] = useState(false);
  const [editClass, setEditClass] = useState<ClassItem | null>(null);
  const [addSectionFor, setAddSectionFor] = useState<ClassItem | null>(null);
  const [editSection, setEditSection] = useState<{ klass: ClassItem; section: SectionItem } | null>(null);
  const [yearFilter, setYearFilter] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["classes"],
    queryFn: fetchClasses,
  });

  const createClassMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      numeric_grade: number;
      initial_section_name?: string;
      initial_section_capacity?: number;
    }) => {
      const createdClass = await createClass({
        name: payload.name,
        numeric_grade: payload.numeric_grade,
      });

      const sectionName = payload.initial_section_name?.trim();
      if (sectionName) {
        await createSection(createdClass.id, {
          name: sectionName,
          capacity: payload.initial_section_capacity,
        });
      }

      return createdClass;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(t("Class created", "कक्षा बन्यो"));
      setShowAddClass(false);
    },
    onError: () => toast.error(t("Failed to create class", "कक्षा बनेन")),
  });

  const updateClassMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      updateClass(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(t("Class updated", "कक्षा अद्यावधिक"));
      setEditClass(null);
    },
    onError: () => toast.error(t("Failed to update class", "अद्यावधिक भएन")),
  });

  const deleteClassMutation = useMutation({
    mutationFn: (classId: string) => deleteClass(classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(t("Class deleted", "कक्षा मेटियो"));
    },
    onError: () => toast.error(t("Failed to delete class", "मेटिएन")),
  });

  const createSectionMutation = useMutation({
    mutationFn: (payload: { classId: string; data: Record<string, unknown> }) =>
      createSection(payload.classId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(t("Section created", "सेक्सन बन्यो"));
      setAddSectionFor(null);
    },
    onError: () => toast.error(t("Failed to create section", "सेक्सन बनेन")),
  });

  const updateSectionMutation = useMutation({
    mutationFn: (payload: { classId: string; sectionId: string; data: Record<string, unknown> }) =>
      updateSection(payload.classId, payload.sectionId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(t("Section updated", "सेक्सन अद्यावधिक"));
      setEditSection(null);
    },
    onError: () => toast.error(t("Failed to update section", "सेक्सन अद्यावधिक भएन")),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (payload: { classId: string; sectionId: string }) =>
      deleteSection(payload.classId, payload.sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(t("Section deleted", "सेक्सन मेटियो"));
    },
    onError: () => toast.error(t("Failed to delete section", "सेक्सन मेटिएन")),
  });

  if (isError) return <ErrorState body={t("Failed to load classes.", "कक्षा लोड हुन सकेन।")} onRetry={() => void refetch()} />;
  if (isLoading) return <SkeletonTable rows={6} columns={3} />;

  // The API carries academic_year_id (see PromotionClassOption); ClassDto in
  // lib predates it — widen locally rather than editing shared lib.
  const classes = (data || []) as unknown as ClassItem[];
  // 8.1 year-axis: only offer the filter when the payload actually carries
  // the year binding (avoids a control that filters everything to none).
  const hasYearAxis = classes.some((c) => !!c.academic_year_id);
  const visibleClasses =
    hasYearAxis && yearFilter ? classes.filter((c) => c.academic_year_id === yearFilter) : classes;

  const CLASS_COLUMNS: Column<ClassItem>[] = [
    {
      key: "name",
      label: t("Class", "कक्षा"),
      sortable: true,
      value: (k) => k.name,
      render: (k) => (
        <div>
          <div className="font-medium">{k.name}</div>
          {k.name_nepali && (
            <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>{k.name_nepali}</div>
          )}
        </div>
      ),
    },
    { key: "numeric_grade", label: t("Grade", "ग्रेड"), align: "right", sortable: true, value: (k) => k.numeric_grade ?? 0, render: (k) => <span className="text-sm">{k.numeric_grade ?? "-"}</span> },
    {
      key: "sections",
      label: t("Sections", "सेक्सन"),
      value: (k) => (k.sections || []).length,
      render: (k) => (
        <div className="space-y-2">
          {(k.sections || []).map((section) => (
            <div
              key={section.id}
              className="flex items-center justify-between rounded-[var(--w11-radius-md)] border border-[var(--w11-border-subtle)] px-3 py-2"
            >
              <div>
                <div className="font-medium">{t("Section", "सेक्सन")} {section.name}</div>
                <div className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                  {t("Capacity", "अनुमति")}: {section.capacity ?? "-"}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); setEditSection({ klass: k, section }); }}
                  aria-label={`Edit section ${section.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      const ok = await confirm({
                        title: t(`Delete section "${section.name}"?`, `"${section.name}" सेक्सन मेटाउने?`),
                        body: t("It will be removed from the class. Students stay enrolled in the class.", "विद्यार्थी कक्षामै रहन्छन्।"),
                        confirmLabel: t("Delete section", "मेटाउनुहोस्"),
                        tone: "danger",
                      });
                      if (ok) {
                        deleteSectionMutation.mutate({ classId: k.id, sectionId: section.id });
                      }
                    })();
                  }}
                  aria-label={`Delete section ${section.name}`}
                >
                  <Trash2 className="h-4 w-4" style={{ color: "#c42b1c" }} />
                </Button>
              </div>
            </div>
          ))}
          {(k.sections || []).length === 0 && (
            <div className="text-sm" style={{ color: "var(--w11-text-secondary)" }}>{t("No sections yet.", "सेक्सन छैन।")}</div>
          )}
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setAddSectionFor(k); }}>
            <Plus className="mr-2 h-3.5 w-3.5" /> {t("Add Section", "सेक्सन थप्नुहोस्")}
          </Button>
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (k) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => setEditClass(k)}
            onDelete={() => deleteClassMutation.mutate(k.id)}
            deleteLabel={t(`Delete class "${k.name}"? Only empty classes can be deleted.`, `"${k.name}" मेटाउने?`)}
            deleting={deleteClassMutation.isPending}
          />
        </div>
      ),
    },
  ];
  const sectionDialogClass = addSectionFor || editSection?.klass || null;
  const sectionDialogItem = editSection?.section || null;

  return (
    <>
      <DataPanel
        title={t("Classes & Sections", "कक्षा र सेक्सन")}
        actions={
          <div className="flex items-center gap-2">
            {hasYearAxis && (
              <AdvancedSelect
                className="w-40"
                value={yearFilter}
                onChange={(v) => setYearFilter(v || "")}
                clearable
                placeholder={t("All sessions", "सबै सत्र")}
                options={years.map((y) => ({ value: y.id, label: y.name }))}
              />
            )}
            <Button size="sm" onClick={() => setShowAddClass(true)}>
              <Plus className="mr-2 h-4 w-4" /> {t("Add Class", "कक्षा थप्नुहोस्")}
            </Button>
          </div>
        }
        bodyClassName="p-0"
      >
        <DataTable<ClassItem>
          columns={CLASS_COLUMNS}
          rows={visibleClasses}
          rowKey={(k) => k.id}
          searchable
          searchPlaceholder={t("Search classes…", "कक्षा खोज्नुहोस्…")}
          exportFileName="classes-sections"
          empty={{
            icon: Users,
            title: t("No classes created yet", "अझै कक्षा छैन"),
            body: t("Create your first class — sections and teachers hang off it.", "पहिलो कक्षा बनाउनुहोस् — सेक्सन र शिक्षक यसमा टाँसिन्छ।"),
            action: { label: t("Add Class", "कक्षा थप्नुहोस्"), onClick: () => setShowAddClass(true) },
          }}
        />
      </DataPanel>

      <Dialog
        open={showAddClass || !!editClass}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddClass(false);
            setEditClass(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editClass ? t("Edit Class", "कक्षा सम्पादन") : t("Add Class", "कक्षा थप्नुहोस्")}</DialogTitle>
          </DialogHeader>
          <form
            key={editClass?.id || "new-class"}
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const payload = {
                name: String(formData.get("name") || ""),
                numeric_grade: Number(formData.get("numeric_grade")),
              };

              if (editClass) {
                updateClassMutation.mutate({ id: editClass.id, data: payload });
                return;
              }

              createClassMutation.mutate({
                ...payload,
                initial_section_name: String(formData.get("initial_section_name") || "").trim() || undefined,
                initial_section_capacity: formData.get("initial_section_capacity")
                  ? Number(formData.get("initial_section_capacity"))
                  : undefined,
              });
            }}
            className="space-y-4"
          >
            <FormSection title={t("Class Details", "कक्षा विवरण")}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("Class Name", "कक्षा नाम")}</Label>
                  <Input name="name" required defaultValue={editClass?.name} placeholder="Class 10" />
                </div>
                <div className="space-y-2">
                  <Label>{t("Grade Number", "ग्रेड नम्बर")}</Label>
                  <Input
                    name="numeric_grade"
                    type="number"
                    min={1}
                    max={12}
                    required
                    defaultValue={editClass?.numeric_grade ?? undefined}
                  />
                </div>
                {!editClass && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("Initial Section", "पहिलो सेक्सन")}</Label>
                      <Input name="initial_section_name" placeholder="A" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("Section Capacity", "अनुमति संख्या")}</Label>
                      <Input name="initial_section_capacity" type="number" min={1} placeholder="40" />
                    </div>
                  </div>
                )}
              </div>
            </FormSection>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddClass(false);
                  setEditClass(null);
                }}
              >
                {t("Cancel", "रद्द")}
              </Button>
              <Button type="submit" disabled={createClassMutation.isPending || updateClassMutation.isPending}>
                {createClassMutation.isPending || updateClassMutation.isPending ? <Spinner size="sm" /> : editClass ? t("Update", "अद्यावधिक") : t("Create", "बनाउनुहोस्")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!sectionDialogClass}
        onOpenChange={(open) => {
          if (!open) {
            setAddSectionFor(null);
            setEditSection(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sectionDialogItem ? t("Edit Section", "सेक्सन सम्पादन") : t("Add Section", "सेक्सन थप्नुहोस्")}
              {sectionDialogClass ? ` — ${sectionDialogClass.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <form
            key={sectionDialogItem?.id || `${sectionDialogClass?.id || "new"}-section`}
            onSubmit={(event) => {
              event.preventDefault();
              if (!sectionDialogClass) return;

              const formData = new FormData(event.currentTarget);
              const payload = {
                name: String(formData.get("name") || "").trim(),
                capacity: formData.get("capacity") ? Number(formData.get("capacity")) : undefined,
              };

              if (sectionDialogItem) {
                updateSectionMutation.mutate({
                  classId: sectionDialogClass.id,
                  sectionId: sectionDialogItem.id,
                  data: payload,
                });
              } else {
                createSectionMutation.mutate({
                  classId: sectionDialogClass.id,
                  data: payload,
                });
              }
            }}
            className="space-y-4"
          >
            <FormSection title={t("Section Details", "सेक्सन विवरण")}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("Section Name", "सेक्सन नाम")}</Label>
                  <Input name="name" required defaultValue={sectionDialogItem?.name} placeholder="A" />
                </div>
                <div className="space-y-2">
                  <Label>{t("Capacity", "अनुमति संख्या")}</Label>
                  <Input
                    name="capacity"
                    type="number"
                    min={1}
                    defaultValue={sectionDialogItem?.capacity ?? 40}
                  />
                </div>
              </div>
            </FormSection>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddSectionFor(null);
                  setEditSection(null);
                }}
              >
                {t("Cancel", "रद्द")}
              </Button>
              <Button type="submit" disabled={createSectionMutation.isPending || updateSectionMutation.isPending}>
                {createSectionMutation.isPending || updateSectionMutation.isPending ? <Spinner size="sm" /> : sectionDialogItem ? t("Update", "अद्यावधिक") : t("Create", "बनाउनुहोस्")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SubjectsTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Subject | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["subjects"],
    queryFn: fetchSubjects,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createSubject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(t("Subject created", "विषय बन्यो"));
      setShowAdd(false);
    },
    onError: () => toast.error(t("Failed to create subject", "विषय बनेन")),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateSubject(editItem?.id || "", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(t("Subject updated", "विषय अद्यावधिक"));
      setEditItem(null);
    },
    onError: () => toast.error(t("Failed to update subject", "अद्यावधिक भएन")),
  });

  const deleteMutation = useMutation({
    mutationFn: (subjectId: string) => deleteSubject(subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(t("Subject deleted", "विषय मेटियो"));
    },
    onError: () => toast.error(t("Failed to delete subject", "मेटिएन")),
  });

  if (isError) return <ErrorState body={t("Failed to load subjects.", "विषय लोड हुन सकेन।")} onRetry={() => void refetch()} />;
  if (isLoading) return <SkeletonTable rows={6} columns={4} />;

  const subjects = data || [];

  const SUBJECT_COLUMNS: Column<Subject>[] = [
    { key: "name", label: t("Name", "नाम"), sortable: true, value: (s) => s.name, render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "code", label: t("Code", "कोड"), sortable: true, value: (s) => s.code || "" },
    { key: "credit_hours", label: t("Credit Hours", "क्रेडिट"), sortable: true, align: "right", value: (s) => s.credit_hours ?? 0 },
    {
      key: "marks",
      label: t("Marks", "अंक"),
      render: (s) =>
        s.has_practical && (s.practical_full_marks ?? 0) > 0 ? (
          <div className="text-sm leading-tight">
            <p>Th {s.full_marks ?? 0} / {s.pass_marks ?? 0}</p>
            <p style={{ color: "var(--w11-text-secondary)" }}>
              Pr {s.practical_full_marks} / {s.practical_pass_marks ?? 0}
            </p>
          </div>
        ) : (
          <span className="text-sm">
            {s.full_marks ?? 100} / {s.pass_marks ?? 32}
          </span>
        ),
    },
    {
      key: "is_optional",
      label: t("Type", "प्रकार"),
      sortable: true,
      value: (s) => (s.is_optional ? "optional" : "compulsory"),
      render: (s) => <StatusChip status={s.is_optional ? "pending" : "active"} label={s.is_optional ? t("Optional", "ऐच्छिक") : t("Compulsory", "अनिवार्य")} />,
    },
    {
      key: "has_practical",
      label: t("Practical", "प्रायोगिक"),
      value: (s) => (s.has_practical ? "yes" : "no"),
      render: (s) => <span className="text-sm">{s.has_practical ? t("Yes", "छ") : t("No", "छैन")}</span>,
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (s) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onEdit={() => setEditItem(s)}
            onDelete={() => deleteMutation.mutate(s.id)}
            deleteLabel={t(`Delete subject "${s.name}"? Class-subject mappings referencing it will need re-mapping.`, `"${s.name}" विषय मेटाउने?`)}
            deleting={deleteMutation.isPending}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <DataPanel
        title={t("Subjects", "विषयहरू")}
        actions={
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("Add Subject", "विषय थप्नुहोस्")}
          </Button>
        }
        bodyClassName="p-0"
      >
        <DataTable<Subject>
          columns={SUBJECT_COLUMNS}
          rows={subjects}
          rowKey={(s) => s.id}
          searchable
          searchPlaceholder={t("Search subjects…", "विषय खोज्नुहोस्…")}
          exportFileName="subjects"
          empty={{
            icon: BookMarked,
            title: t("No subjects yet", "अझै विषय छैन"),
            body: t("Add your first subject to start recording marks.", "अंक भर्न पहिलो विषय थप्नुहोस्।"),
            action: { label: t("Add Subject", "विषय थप्नुहोस्"), onClick: () => setShowAdd(true) },
          }}
        />
      </DataPanel>

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
            <DialogTitle>{editItem ? t("Edit Subject", "विषय सम्पादन") : t("Add Subject", "विषय थप्नुहोस्")}</DialogTitle>
          </DialogHeader>
          <form
            key={editItem?.id || "new-subject"}
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const hasPractical = formData.get("has_practical") === "true";
              const payload = {
                name: formData.get("name"),
                code: formData.get("code"),
                credit_hours: Number(formData.get("credit_hours")),
                is_optional: formData.get("is_optional") === "true",
                full_marks: Number(formData.get("full_marks") || 100),
                pass_marks: Number(formData.get("pass_marks") || 32),
                has_practical: hasPractical,
                practical_full_marks: hasPractical
                  ? Number(formData.get("practical_full_marks") || 0)
                  : null,
                practical_pass_marks: hasPractical
                  ? Number(formData.get("practical_pass_marks") || 0)
                  : null,
              };

              if (editItem) {
                updateMutation.mutate(payload);
              } else {
                createMutation.mutate(payload);
              }
            }}
            className="space-y-4"
          >
            <FormSection title={t("Subject Details", "विषय विवरण")}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("Subject Name", "विषयको नाम")}</Label>
                    <Input name="name" required defaultValue={editItem?.name} placeholder="Mathematics" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Code", "कोड")}</Label>
                    <Input name="code" required defaultValue={editItem?.code} placeholder="MATH" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("Credit Hours", "क्रेडिट घण्टा")}</Label>
                    <Input
                      name="credit_hours"
                      type="number"
                      min={1}
                      required
                      defaultValue={editItem?.credit_hours ?? 4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Type", "प्रकार")}</Label>
                    <AdvancedSelect
                      name="is_optional"
                      defaultValue={String(Boolean(editItem?.is_optional))}
                      options={[
                        { value: "false", label: t("Compulsory", "अनिवार्य") },
                        { value: "true", label: t("Optional", "ऐच्छिक") },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </FormSection>
            <details className="win11-expander">
              <summary>{t("Marks & practical component", "अंक र प्रायोगिक भाग")}</summary>
              <div className="expander-content">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("Full Marks", "पूर्णांक")}</Label>
                      <Input
                        name="full_marks"
                        type="number"
                        min={1}
                        required
                        defaultValue={editItem?.full_marks ?? 100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("Pass Marks", "उत्तीर्णांक")}</Label>
                      <Input
                        name="pass_marks"
                        type="number"
                        min={0}
                        required
                        defaultValue={editItem?.pass_marks ?? 32}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Practical Component", "प्रायोगिक भाग")}</Label>
                    <AdvancedSelect
                      name="has_practical"
                      defaultValue={String(Boolean(editItem?.has_practical))}
                      options={[
                        { value: "false", label: t("No practical", "छैन") },
                        { value: "true", label: t("Has practical", "छ") },
                      ]}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("Practical Full Marks", "प्रा. पूर्णांक")}</Label>
                      <Input
                        name="practical_full_marks"
                        type="number"
                        min={0}
                        defaultValue={editItem?.practical_full_marks ?? ""}
                        placeholder="25"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("Practical Pass Marks", "प्रा. उत्तीर्णांक")}</Label>
                      <Input
                        name="practical_pass_marks"
                        type="number"
                        min={0}
                        defaultValue={editItem?.practical_pass_marks ?? ""}
                        placeholder="10"
                      />
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                    {t("Set practical full/pass marks to use subject-specific NEB grading. Leave them empty to keep the legacy exam-level split.", "NEB विषयगत अंकका लागि प्रायोगिक अंक तोक्नुहोस्; खाली परीक्षास्तर विभाजन।")}
                  </p>
                </div>
              </div>
            </details>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAdd(false);
                  setEditItem(null);
                }}
              >
                {t("Cancel", "रद्द")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? <Spinner size="sm" /> : editItem ? t("Update", "अद्यावधिक") : t("Create", "बनाउनुहोस्")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
