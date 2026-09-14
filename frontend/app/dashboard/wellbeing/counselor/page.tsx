"use client";

/**
 * Counselor Notes (archetype A1, confidential register — plan 34 #43 + 8.19).
 *
 * Research notes: (1) counseling logs are the most sensitive records a school
 * holds — a persistent confidentiality banner + explicit per-note
 * confidential flag is the standard trust pattern; (2) never ask staff to
 * paste raw UUIDs — searchable entity pickers eliminate the top data-entry
 * error class.
 *
 * Changes: raw "Student ID" text input → EntityPicker; dropped the
 * "Action Taken" textarea (the backend POST contract is {student_id, type,
 * content, is_confidential} — it silently discarded action_taken before);
 * confidentiality infobar + is_confidential switch added; bilingual labels;
 * confidential chips in the table.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { AdvancedSelect } from "@/components/ui/advanced-select";
import { EntityPicker } from "@/components/ui/entity-picker";
import { Switch } from "@/components/ui/switch";
import { Brain, Plus, ShieldAlert, Lock } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";
import { displayBS } from "@/lib/nepali_date";

export default function CounselorPage() {
  return <AppGate slug="wellbeing"><CounselorContent /></AppGate>;
}

function CounselorContent() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ student_id: "", content: "", type: "individual", is_confidential: true });

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["counselor-notes"],
    queryFn: async () => (await api.get("/wellbeing/counselor-notes")).data?.data || [],
    retry: 1,
  });

  const notes: any[] = Array.isArray(data) ? data : [];

  const create = useMutation({
    // Backend contract (POST /wellbeing/counselor-notes):
    // {student_id, type, content, is_confidential}.
    mutationFn: async () =>
      (await api.post("/wellbeing/counselor-notes", {
        student_id: form.student_id.trim(),
        type: form.type,
        content: form.content,
        is_confidential: form.is_confidential,
      })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counselor-notes"] });
      setShowDialog(false);
      setForm({ student_id: "", content: "", type: "individual", is_confidential: true });
      toast.success(t("Note saved", "नोट सुरक्षित भयो"));
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || t("Failed to save note", "नोट सुरक्षित गर्न असफल")),
  });

  if (isLoading) return <AOSModuleLoadingState label={t("Loading counselor notes…", "काउन्सेलर नोट लोड हुँदैछ…")} />;
  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader
          icon={<Brain className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="Counselor Notes"
        />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "#c42b1c" }}>{t("Failed to load counselor notes. Please try again.", "लोड गर्न असफल। फेरि प्रयास गर्नुहोस्।")}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>{t("Retry", "पुनःप्रयास")}</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  const NOTE_COLUMNS: Column<any>[] = [
    {
      key: "student_name",
      label: t("Student", "विद्यार्थी"),
      sortable: true,
      value: (n) => n.student_name ?? "",
      render: (n) => <span className="font-medium">{n.student_name || n.student_id}</span>,
    },
    {
      key: "note_type",
      label: t("Session", "सत्र"),
      sortable: true,
      value: (n) => n.note_type ?? "",
      render: (n) => <StatusChip status={n.note_type || "general"} />,
    },
    {
      key: "content",
      label: t("Note", "नोट"),
      value: (n) => n.content ?? "",
      render: (n) => (
        <span className="text-sm max-w-xs truncate block inline-flex items-center gap-1">
          {n.is_confidential && <Lock className="h-3 w-3 shrink-0" style={{ color: "#8a6116" }} />}
          {n.content || "—"}
        </span>
      ),
    },
    {
      key: "is_confidential",
      label: t("Confidential", "गोपनीय"),
      value: (n) => (n.is_confidential ? "yes" : "no"),
      render: (n) =>
        n.is_confidential ? (
          <StatusChip status="hold" label={t("Confidential", "गोपनीय")} />
        ) : (
          <span className="text-xs" style={{ color: "var(--w11-text-tertiary)" }}>{t("Shared", "साझा")}</span>
        ),
    },
    {
      key: "created_at",
      label: t("Date", "मिति"),
      sortable: true,
      value: (n) => n.created_at ?? "",
      render: (n) => <span className="text-sm">{n.created_at ? displayBS(n.created_at) : "—"}</span>,
    },
  ];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Brain className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Counselor Notes"
        subtitle={t(
          `${notes.length} counseling sessions recorded`,
          `${notes.length} काउन्सेलिङ सत्रहरू`
        )}
        actions={
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t("New Note", "नयाँ नोट")}
          </Button>
        }
      />
      <AOSPageBody>
        <div className="win11-infobar warning mb-4 flex items-start gap-2" role="note">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-[13px]">
            {t(
              "Confidential by default. These notes are restricted to counselors and administrators — do not open them in shared screens, and never share content with parents or staff without a counseling need.",
              "यो रेकर्ड गोपनीय हुन्छ। काउन्सेलर र प्रशासकसम्म मात्र सीमित — साझा स्क्रिनमा नखोल्नुहोस्।"
            )}
          </p>
        </div>

        <DataPanel bodyClassName="p-0 pt-0">
          <DataTable
            columns={NOTE_COLUMNS}
            rows={notes}
            rowKey={(n: any) => n.id}
            searchable
            searchPlaceholder={t("Search notes…", "नोट खोज्नुहोस्…")}
            exportFileName="counselor-notes"
            empty={{
              icon: Brain,
              title: t("No counselor notes yet", "अझै कुनै काउन्सेलर नोट छैन"),
              body: t("Record a session to start the counseling log.", "सत्र रेकर्ड गरी लग सुरु गर्नुहोस्।"),
              action: { label: t("New Note", "नयाँ नोट"), onClick: () => setShowDialog(true) },
            }}
          />
        </DataPanel>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("New Counselor Note", "नयाँ काउन्सेलर नोट")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("Student", "विद्यार्थी")}</Label>
                <EntityPicker
                  value={form.student_id}
                  onChange={(id) => setForm((f) => ({ ...f, student_id: id }))}
                  query={{ path: "/students", searchKey: "q", perPage: 20 }}
                  getOptions={(rows) =>
                    (rows as any[]).map((s) => ({
                      value: s.id,
                      label: s.full_name || `${s.first_name} ${s.last_name}`,
                      ne: s.full_name_nepali,
                      hint: s.enrollment_number || s.roll_number,
                    }))
                  }
                  placeholder={t("Search student…", "विद्यार्थी खोज्नुहोस्…")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Session type", "सत्र प्रकार")}</Label>
                <AdvancedSelect
                  value={form.type}
                  onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                  options={[
                    { value: "individual", label: t("Individual", "व्यक्तिगत") },
                    { value: "group", label: t("Group", "समूह") },
                    { value: "parent", label: t("Parent Meeting", "अभिभावक भेट") },
                    { value: "referral", label: t("External Referral", "बाहिरी रेफरल") },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Note", "नोट")}</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={4}
                  placeholder={t("Observations, follow-ups, agreed actions…", "अवलोकन, अनुगमन…")}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--w11-border-default)] px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{t("Confidential", "गोपनीय")}</p>
                  <p className="text-[11px]" style={{ color: "var(--w11-text-tertiary)" }}>
                    {t("Hide content outside the counseling role", "काउन्सेलिङ भूमिका बाहिर सामग्री लुकाउनुहोस्")}
                  </p>
                </div>
                <Switch
                  checked={form.is_confidential}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_confidential: v }))}
                  aria-label={t("Confidential", "गोपनीय")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>{t("Cancel", "रद्द")}</Button>
              <Button onClick={() => create.mutate()} disabled={!form.student_id || !form.content || create.isPending}>
                {create.isPending ? <Spinner className="mr-2" /> : null}
                {t("Save Note", "नोट सुरक्षित")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}
