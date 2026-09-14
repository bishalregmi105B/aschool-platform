"use client";

/**
 * Students / Reset Password — bulk utility (plan Part 34 row 1: "reset
 * password — dialog not page"; the page stays because the registry launches
 * it as a subroute, but the action is now guarded like one).
 *
 * Rewrite changes: the destructive bulk reset previously fired WITHOUT any
 * confirmation — it now goes through useConfirm (rule: no unguarded
 * destructive action). Class filter is URL-backed; the result table keeps
 * the school-default password format hint as an infobar; loading uses
 * skeletons; full bilingual chrome. Endpoints unchanged
 * (POST /students/bulk-reset-passwords).
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SkeletonTable } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useDebounced } from "@/components/ui/filter-bar";
import { KeyRound, Search, Inbox } from "lucide-react";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, FilterCommandBar,
} from "@/components/aos/kit/page-kit";
import { DependencyMissingEmptyState, EmptyState, ErrorState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n";

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  student_id?: string;
  login_id?: string;
  class_name?: string;
  status: string;
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/students/reset-password";

  const selectedClass = routeParams.get("class") ?? "";
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resetRows, setResetRows] = useState<Record<string, string>>({});
  const [resetting, setResetting] = useState(false);

  function setParam(patch: Record<string, string>) {
    const next = new URLSearchParams(routeParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    navigate(`${pathname}?${next.toString()}`);
  }

  const { data: classes, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["classes"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>("/academics/classes");
      return res.data.data;
    },
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students-reset-password", selectedClass],
    queryFn: async () => {
      const res = await api.get<ApiResponse<StudentRow[]>>("/students", {
        params: { class_id: selectedClass, per_page: 500 },
      });
      return res.data.data ?? [];
    },
    enabled: !!selectedClass,
  });

  useEffect(() => {
    setSelected(new Set());
    setResetRows({});
  }, [selectedClass]);

  const visible = useMemo(
    () => (students || []).filter((s) => {
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return (
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        (s.student_id || "").toLowerCase().includes(q)
      );
    }),
    [students, debouncedSearch]
  );

  async function handleReset() {
    if (selected.size === 0) return;
    // Destructive bulk action → explicit confirmation first (was missing).
    const ok = await confirm({
      title: t(`Reset ${selected.size} password(s)?`, `${selected.size} पासवर्ड रिसेट गर्ने?`),
      body: t(
        "Each selected student's login password is replaced with the school default immediately.",
        "चयनित प्रत्येक विद्यार्थीको पासवर्ड तुरुन्तै डिफल्टमा बदलिन्छ।",
      ),
      confirmLabel: t("Reset passwords", "पासवर्ड रिसेट"),
      tone: "danger",
    });
    if (!ok) return;
    setResetting(true);
    try {
      const res = await api.post("/students/bulk-reset-passwords", {
        student_ids: Array.from(selected),
      });
      const data = res.data?.data;
      const map: Record<string, string> = {};
      for (const p of data?.passwords || []) {
        map[p.student_id] = p.password;
      }
      setResetRows(map);
      toast.success(
        t(`Reset ${data?.reset ?? 0} password(s) to the school default`, `${data?.reset ?? 0} पासवर्ड रिसेट`)
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || t("Failed to reset passwords", "रिसेट हुन सकेन"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<KeyRound className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Reset Student Passwords", "विद्यार्थी पासवर्ड रिसेट")}
        subtitle={t(
          "Bulk reset student login passwords to the school default",
          "विद्यार्थी लगइन पासवर्ड विद्यालय डिफल्टमा रिसेट",
        )}
      />
      <AOSPageBody>
        {isError ? (
          <ErrorState
            body={t("Failed to load the class list.", "कक्षा सूची लोड हुन सकेन।")}
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <SkeletonTable rows={6} />
        ) : (classes || []).length === 0 ? (
          <DependencyMissingEmptyState
            icon={Inbox}
            title={t("No classes yet", "अझै कक्षा छैन")}
            prerequisiteName={t("Classes in Academics", "कक्षाहरू")}
            setupHref="/dashboard/academics"
            setupLabel={t("Create classes first →", "पहिले कक्षा बनाउनुहोस् →")}
            body={t(
              "Passwords are reset per class so the new defaults follow the class pattern.",
              "कक्षाअनुसार रिसेट हुन्छ ताकि नयाँ पासवर्ड ढाँचामा मिल्छ।",
            )}
          />
        ) : (
          <>
            <FilterCommandBar>
              <Select
                value={selectedClass}
                onValueChange={(v) => setParam({ class: v })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("Filter by class", "कक्षा अनुसार")} />
                </SelectTrigger>
                <SelectContent>
                  {(classes || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="win11-searchbox w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("Search students...", "विद्यार्थी खोज्नुहोस्…")}
                  className="border-0 bg-transparent pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </FilterCommandBar>

            <DataPanel
              title={t("Students", "विद्यार्थी")}
              actions={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selected.size === 0 || resetting}
                  onClick={() => void handleReset()}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {resetting
                    ? t("Resetting…", "रिसेट…")
                    : t(`Reset Selected (${selected.size})`, `चयनित रिसेट (${selected.size})`)}
                </Button>
              }
              bodyClassName="p-0"
            >
              {!selectedClass ? (
                <EmptyState
                  size="sm"
                  icon={KeyRound}
                  title={t("Choose a class to start", "सक्न कक्षा छान्नुहोस्")}
                  body={t("The class roster appears here with a reset checkbox.", "कक्षाको सूची यहाँ आउँछ।")}
                />
              ) : studentsLoading ? (
                <SkeletonTable rows={8} columns={4} />
              ) : visible.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={Inbox}
                  title={debouncedSearch ? t("No students match this search", "खोजसँग मिल्दा भेटिएन") : t("No students in this class", "यो कक्षामा विद्यार्थी छैनन्")}
                  body={debouncedSearch ? t("Clear the search to see everyone.", "खोज हटाउनुहोस्।") : undefined}
                  action={debouncedSearch ? { label: t("Clear search", "खोज हटाउनुहोस्"), onClick: () => setSearch("") } : undefined}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={visible.length > 0 && visible.every((s) => selected.has(s.id))}
                          onCheckedChange={(checked) =>
                            setSelected(checked === true ? new Set(visible.map((s) => s.id)) : new Set())
                          }
                          aria-label={t("Select all", "सबै चयन")}
                        />
                      </TableHead>
                      <TableHead>{t("Student Name", "नाम")}</TableHead>
                      <TableHead>{t("Class", "कक्षा")}</TableHead>
                      <TableHead>{t("Login ID", "लगइन")}</TableHead>
                      <TableHead>{t("New Password", "नयाँ पासवर्ड")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(s.id)}
                            onCheckedChange={(checked) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                checked === true ? next.add(s.id) : next.delete(s.id);
                                return next;
                              })
                            }
                            aria-label={`Select ${s.first_name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                        <TableCell>{s.class_name || "—"}</TableCell>
                        <TableCell>{s.student_id || s.login_id || "—"}</TableCell>
                        <TableCell>
                          {/* backend keys each password by the student's code (or the
                              student uuid when no code is set) */}
                          {resetRows[s.student_id || s.id] ? (
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{resetRows[s.student_id || s.id]}</code>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </DataPanel>

            <div className="win11-infobar info mt-4">
              {t(
                "Password format: {class}{section}{roll}.{first} (e.g. 7a12.ram) — the same school default issued at enrollment. Hand the printed list to the students after resetting.",
                "पासवर्ड ढाँचा: {कक्षा}{सेक्सन}{रोल}{नाम} (जस्तै 7a12.ram) — भर्नाकै डिफल्ट। रिसेटपछि विद्यार्थीलाई दिनुहोस्।",
              )}
            </div>
          </>
        )}
      </AOSPageBody>
    </AOSPage>
  );
}
