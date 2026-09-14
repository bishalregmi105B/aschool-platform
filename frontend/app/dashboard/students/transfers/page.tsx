"use client";

/**
 * Students / Transfers — A1 registry + A3 dialog (plan Part 34 row 1).
 *
 * Kept anatomy: AOSPageHeader with the single primary action (New
 * Transfer), debounced search now mirrored to the URL (?q=) so a filtered
 * transfer ledger is shareable, StatusChip instead of raw badges, honest
 * filtered-empty vs never-used states, ErrorState + retry. Create dialog:
 * 4 fields (student, type, destination, reason), Enter-to-submit, disabled
 * until a student is chosen. Endpoints/payload unchanged.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { useDebounced } from "@/components/ui/filter-bar";
import { ErrorState } from "@/components/ui/empty-state";
import { ArrowLeftRight, Plus } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";
import {
  useAOSRouteParams,
  useAOSRouterNavigate,
  useAOSWindowRoute,
} from "@/lib/aos-window-route";
import {
  AOSPage, AOSPageHeader, AOSPageBody, DataPanel, StatusChip,
} from "@/components/aos/kit/page-kit";
import { useI18n } from "@/lib/i18n";

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
  student_id?: string;
  class_name?: string;
  status: string;
}

interface TransferRow {
  id: string;
  student_name?: string;
  student_code?: string;
  transfer_type: string;
  reason?: string;
  destination_school?: string;
  status: string;
  created_at?: string;
}

export default function TransfersPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const routeParams = useAOSRouteParams();
  const navigate = useAOSRouterNavigate();
  const windowRoute = useAOSWindowRoute();
  const pathname = windowRoute?.pathname ?? "/dashboard/students/transfers";

  const [search, setSearch] = useState(routeParams.get("q") ?? "");
  const debouncedSearch = useDebounced(search, 300);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    student_id: "",
    transfer_type: "tc",
    reason: "",
    destination_school: "",
  });

  // Mirror the settled search into the window URL (→ address bar).
  const urlQ = routeParams.get("q") ?? "";
  useEffect(() => {
    if (debouncedSearch === urlQ) return;
    const next = new URLSearchParams(routeParams.toString());
    if (debouncedSearch) next.set("q", debouncedSearch);
    else next.delete("q");
    navigate(`${pathname}?${next.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["transfers", debouncedSearch],
    queryFn: async () => {
      const r = await api.get("/students/transfers", {
        params: { search: debouncedSearch || undefined },
      });
      return r.data;
    },
  });

  const { data: studentOptions } = useQuery({
    queryKey: ["students-for-transfer"],
    queryFn: async () => {
      const r = await api.get("/students", { params: { per_page: 500 } });
      return (r.data?.data || []) as StudentOption[];
    },
    enabled: showDialog,
  });

  const transfers: TransferRow[] = data?.data || [];

  const create = useMutation({
    mutationFn: async () => (await api.post("/students/transfers", form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setShowDialog(false);
      setForm({ student_id: "", transfer_type: "tc", reason: "", destination_school: "" });
      toast.success(
        t("Transfer initiated — student marked transferred out", "स्थानान्तरण सुरु — विद्यार्थी 'बाहिरिएको' चिन्ह")
      );
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || t("Failed to create transfer", "स्थानान्तरण बनेन"));
    },
  });

  const TYPE_LABEL: Record<string, string> = {
    tc: t("Transfer Certificate", "स्थानान्तरण प्रमाणपत्र"),
    withdrawal: t("Withdrawal", "विदारी"),
    migration: t("Migration", "स्थानान्तरण"),
  };

  const TRANSFER_COLUMNS: Column<TransferRow>[] = [
    {
      key: "student",
      label: t("Student", "विद्यार्थी"),
      sortable: true,
      value: (row) => row.student_name ?? "",
      render: (row) => (
        <span className="font-medium">
          {row.student_name || "—"}
          {row.student_code && <span className="ml-2 text-xs text-muted-foreground">{row.student_code}</span>}
        </span>
      ),
    },
    { key: "type", label: t("Type", "प्रकार"), sortable: true, value: (row) => row.transfer_type ?? "", render: (row) => <StatusChip status={row.transfer_type} label={TYPE_LABEL[row.transfer_type] || row.transfer_type} /> },
    { key: "reason", label: t("Reason", "कारण"), value: (row) => row.reason ?? "", render: (row) => row.reason || "—" },
    { key: "destination_school", label: t("Destination", "गन्तव्य"), value: (row) => row.destination_school ?? "", render: (row) => row.destination_school || "—" },
    { key: "created_at", label: t("Date", "मिति"), sortable: true, value: (row) => row.created_at ?? "", render: (row) => (row.created_at ? displayBS(row.created_at) : "—") },
    { key: "status", label: t("Status", "अवस्था"), sortable: true, value: (row) => row.status ?? "", render: (row) => <StatusChip status={String(row.status)} /> },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<ArrowLeftRight className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title={t("Student Transfers", "विद्यार्थी स्थानान्तरण")}
        subtitle={t(
          "Transfer certificates and student withdrawals",
          "स्थानान्तरण प्रमाणपत्र र विद्यार्थी विदारी",
        )}
        actions={
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t("New Transfer", "नयाँ स्थानान्तरण")}
          </Button>
        }
      />
      <AOSPageBody>
        <DataPanel bodyClassName="p-0">
          {isError ? (
            <ErrorState
              body={t("Failed to load transfers.", "स्थानान्तरण लोड हुन सकेन।")}
              onRetry={() => void refetch()}
            />
          ) : (
            <DataTable<TransferRow>
              columns={TRANSFER_COLUMNS}
              rows={transfers}
              rowKey={(row) => row.id}
              loading={isLoading}
              searchable
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder={t(
                "Search transfers by student name or ID...",
                "नाम वा आईडीले खोज्नुहोस्…",
              )}
              exportFileName="student-transfers"
              empty={
                debouncedSearch
                  ? {
                      icon: ArrowLeftRight,
                      title: t("No transfers match this search", "यस खोजसँग मिल्दा भेटिएन"),
                      body: t("Clear the search to see the full ledger.", "पूरी खाता हेर्न खोज हटाउनुहोस्।"),
                      action: { label: t("Clear search", "खोज हटाउनुहोस्"), onClick: () => setSearch("") },
                    }
                  : {
                      icon: ArrowLeftRight,
                      title: t("No transfers yet", "अझै स्थानान्तरण छैन"),
                      body: t("Issue transfer certificates and record withdrawals here.", "TC र विदारी यहाँ दर्ता हुन्छ।"),
                      action: { label: t("New Transfer", "नयाँ स्थानान्तरण"), onClick: () => setShowDialog(true) },
                    }
              }
            />
          )}
        </DataPanel>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{t("Initiate Transfer", "स्थानान्तरण सुरु")}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.student_id) create.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>{t("Student", "विद्यार्थी")} *</Label>
                <AdvancedSelect
                  value={form.student_id}
                  onChange={(v) => setForm({ ...form, student_id: v ?? "" })}
                  clearable
                  searchable
                  placeholder={t("Select a student…", "विद्यार्थी छान्नुहोस्…")}
                  options={(studentOptions || []).map((s) => ({
                    value: s.id,
                    label: `${s.first_name} ${s.last_name}${s.class_name ? ` — ${s.class_name}` : ""}${s.student_id ? ` (${s.student_id})` : ""}`,
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  {t("Only active students at your school are listed.", "तपाईंको विद्यालयका सक्रिय विद्यार्थी मात्र।")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t("Transfer Type", "प्रकार")}</Label>
                <AdvancedSelect
                  value={form.transfer_type}
                  onChange={(v) => setForm({ ...form, transfer_type: v ?? "tc" })}
                  options={[
                    { value: "tc", label: t("Transfer Certificate", "स्थानान्तरण प्रमाणपत्र") },
                    { value: "withdrawal", label: t("Withdrawal", "विदारी") },
                    { value: "migration", label: t("Migration", "स्थानान्तरण") },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Destination School", "गन्तव्य विद्यालय")}</Label>
                <Input value={form.destination_school} onChange={(e) => setForm({ ...form, destination_school: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("Reason", "कारण")}</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  {t("Cancel", "रद्द")}
                </Button>
                <Button type="submit" disabled={!form.student_id || create.isPending}>
                  {create.isPending ? <Spinner className="mr-2" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />}
                  {t("Create Transfer", "स्थानान्तरण बनाउनुहोस्")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
