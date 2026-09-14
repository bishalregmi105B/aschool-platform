"use client";

/**
 * Students / Roll Numbers — A1 + inline-edit column (plan Part 34 row 1).
 *
 * Research (inline data-grid editing): edit in place, keep the edit column
 * narrow and numeric-only, make "unsaved changes" visible, and offer a bulk
 * default (auto-number) rather than making 40 rows be typed by hand.
 * Applied: URL-backed class/section pickers (?class=&section=), a visible
 * dirty counter with sticky Save, alphabetical auto-assign kept, and a
 * dependency-missing empty state when no class exists yet.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { ListOrdered, Save, Shuffle, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, FilterCommandBar,
} from "@/components/aos/kit/page-kit";
import { DependencyMissingEmptyState, EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n";

export default function RollNumbersPage() {
  const { t } = useI18n();
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/students/roll-numbers";

  const selectedClass = routeParams.get("class") ?? "";
  const selectedSection = routeParams.get("section") ?? "";

  const [rollNumbers, setRollNumbers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function setParam(patch: Record<string, string>) {
    const next = new URLSearchParams(routeParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    navigate(`${pathname}?${next.toString()}`);
  }

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/academics/classes");
      return res.data.data ?? [];
    },
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students-roll", selectedSection],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>(
        `/students?section_id=${selectedSection}&per_page=500`
      );
      return res.data.data ?? [];
    },
    enabled: !!selectedSection,
  });

  // Populate roll number inputs when students load
  useEffect(() => {
    if (!students) return;
    const map: Record<string, string> = {};
    for (const s of students) {
      map[s.id] = s.roll_number != null ? String(s.roll_number) : "";
    }
    setRollNumbers(map);
  }, [students]);

  const dirtyCount = useMemo(() => {
    if (!students) return 0;
    return students.filter(
      (s: any) => (rollNumbers[s.id] ?? "") !== (s.roll_number != null ? String(s.roll_number) : "")
    ).length;
  }, [students, rollNumbers]);

  const handleAutoAssign = () => {
    if (!students?.length) return;
    const sorted = [...students].sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    const map: Record<string, string> = {};
    sorted.forEach((s, i) => { map[s.id] = String(i + 1); });
    setRollNumbers(map);
    toast.success(
      t("Roll numbers auto-assigned alphabetically. Click Save to apply.", "रोल अक्षरक्रममा तयार — सेभ थिच्नुहोस्।")
    );
  };

  const handleSave = async () => {
    if (!students?.length) return;
    setSaving(true);
    try {
      const updates = students.map((s: any) => ({
        student_id: s.id,
        roll_number: rollNumbers[s.id] !== "" ? Number(rollNumbers[s.id]) : null,
      }));
      await api.post("/students/batch-roll-numbers", { updates });
      toast.success(t("Roll numbers saved successfully.", "रोल नम्बर सुरक्षित।"));
    } catch {
      toast.error(t("Failed to save roll numbers.", "सुरक्षित हुन सकेन।"));
    } finally {
      setSaving(false);
    }
  };

  const sectionList =
    selectedClass
      ? (classes || []).find((c: any) => c.id === selectedClass)?.sections ?? []
      : [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ListOrdered className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Assign Roll Numbers", "रोल नम्बर तोक्नुहोस्")}
        subtitle={t(
          "Edit rolls per section, or auto-assign alphabetically in one click.",
          "सेक्सन अनुसार रोल सम्पादन वा अक्षरक्रममा स्वतः तोक्नुहोस्।",
        )}
      />
      <AOSPageBody>
        {isLoading ? (
          <SkeletonTable rows={8} />
        ) : (classes || []).length === 0 ? (
          <DependencyMissingEmptyState
            icon={Inbox}
            title={t("No classes yet", "अझै कक्षा छैन")}
            prerequisiteName={t("Classes in Academics", "कक्षाहरू")}
            setupHref="/dashboard/academics"
            setupLabel={t("Create classes first →", "पहिले कक्षा बनाउनुहोस् →")}
            body={t(
              "Roll numbers are assigned within a class section — none exists yet.",
              "रोल कक्षा सेक्सनभित्र दिइन्छ — अहिले कुनै सेक्सन छैन।",
            )}
          />
        ) : (
          <>
            <FilterCommandBar>
              <Select
                value={selectedClass}
                onValueChange={(v) => { setParam({ class: v, section: "" }); }}
              >
                <SelectTrigger className="w-48"><SelectValue placeholder={t("Class", "कक्षा")} /></SelectTrigger>
                <SelectContent>
                  {(classes || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedSection}
                onValueChange={(v) => setParam({ section: v })}
                disabled={!selectedClass}
              >
                <SelectTrigger className="w-48"><SelectValue placeholder={t("Section", "सेक्सन")} /></SelectTrigger>
                <SelectContent>
                  {sectionList.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSection && !studentsLoading && !!students?.length && (
                <Button variant="outline" size="sm" onClick={handleAutoAssign}>
                  <Shuffle className="h-4 w-4 mr-2" /> {t("Auto-Assign (A–Z)", "स्वतः तोक्ने (अ–ज्ञ)")}
                </Button>
              )}
            </FilterCommandBar>

            {selectedSection ? (
              <DataPanel
                title={t("Roster", "भरना")}
                actions={
                  students?.length ? (
                    <Button size="sm" onClick={handleSave} disabled={saving || dirtyCount === 0}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving
                        ? t("Saving…", "सुरक्षित…")
                        : dirtyCount > 0
                        ? t(`Save (${dirtyCount} changed)`, `सेभ (${dirtyCount} परिवर्तन)`)
                        : t("Saved", "सुरक्षित")}
                    </Button>
                  ) : undefined
                }
                bodyClassName="p-0"
              >
                {studentsLoading ? (
                  <SkeletonTable rows={8} />
                ) : !students?.length ? (
                  <EmptyState
                    size="sm"
                    icon={Inbox}
                    title={t("No students in this section", "यो सेक्सनमा विद्यार्थी छैनन्")}
                    body={t("Enroll students into this section first.", "यस सेक्सनमा विद्यार्थी भर्ना गर्नुहोस्।")}
                    action={{ label: t("Add Student", "विद्यार्थी थप्नुहोस्"), href: "/dashboard/students/new" }}
                  />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-28">{t("Roll No.", "रोल नं.")}</TableHead>
                          <TableHead>{t("Student Name", "नाम")}</TableHead>
                          <TableHead>{t("Admission No.", "भर्ना नं.")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                className="w-20 h-8"
                                aria-label={`Roll for ${s.first_name} ${s.last_name}`}
                                value={rollNumbers[s.id] ?? ""}
                                onChange={(e) =>
                                  setRollNumbers((prev) => ({ ...prev, [s.id]: e.target.value }))
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {s.first_name} {s.last_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {s.student_id || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </DataPanel>
            ) : (
              <EmptyState
                size="sm"
                icon={ListOrdered}
                title={t("Pick a section to start", "सक्न सेक्सन छान्नुहोस्")}
                body={t("The class roster with editable roll numbers appears here.", "कक्षाको रोल सूची यहाँ देखिन्छ।")}
              />
            )}
          </>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
