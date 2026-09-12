"use client";

/**
 * S-A5 (A-09): the public-application review queue — staging rows from the
 * school's public site, reviewed here, converted into guardian + student in
 * one transaction (seat-cap 409s surface with the counts).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, UserCheck, Globe } from "lucide-react";
import { PluginGate } from "@/lib/plugins";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  FilterCommandBar,
  DataPanel,
  AOSEmptyState,
} from "@/components/aos/kit/page-kit";

interface Registration {
  id: string;
  registration_number: string;
  status: string;
  student_name: string;
  student_dob_bs?: string | null;
  gender?: string | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_email?: string | null;
  previous_school?: string | null;
  class_name?: string | null;
  documents?: { file_id: string; label?: string }[];
  dynamic_fields?: Record<string, unknown>;
  review_notes?: string | null;
  student_id?: string | null;
  created_at?: string;
}

const STATUS_TONES: Record<string, string> = {
  submitted: "warning",
  under_review: "accent",
  approved: "success",
  rejected: "error",
  converted: "success",
};

export default function RegistrationsPage() {
  return (
    <PluginGate slug="admission">
      <RegistrationsInner />
    </PluginGate>
  );
}

function RegistrationsInner() {
  const [status, setStatus] = useState("submitted");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Registration | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["admission-registrations", status, search, page],
    queryFn: async () => {
      const res = await api.get("/admission/registrations", {
        params: { status, search: search || undefined, page, per_page: 20 },
      });
      return res.data.data as {
        registrations: Registration[];
        meta: { total: number; pages: number };
      };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admission-registrations"] });
  };

  const review = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: string }) => {
      const res = await api.post(`/admission/registrations/${id}/review`, {
        decision,
        review_notes: reviewNotes || undefined,
      });
      return res.data;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Application ${vars.decision.replace("_", " ")}`);
      setSelected(null);
      setReviewNotes("");
      invalidate();
    },
    onError: () => toast.error("Review failed"),
  });

  const convert = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/admission/registrations/${id}/convert`, {
        admission_fee_amount: feeAmount ? Number(fee_amount_safe(feeAmount)) : undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        `Student enrolled — accounts provisioned${
          data?.data?.fee_collection_id ? " with an admission-fee bill" : ""
        }.`
      );
      setSelected(null);
      setFeeAmount("");
      invalidate();
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { error?: { message?: string } | string } };
      };
      const raw = e?.response?.data?.error;
      const message =
        typeof raw === "object" && raw?.message ? raw.message : "Conversion failed";
      toast.error(message);
    },
  });

  const rows = query.data?.registrations ?? [];

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Globe className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="Online Applications"
        subtitle="Review public-site applications and enroll approved students"
      />
      <AOSPageBody>
        <FilterCommandBar>
          <div className="flex flex-wrap items-center gap-1.5">
            {["submitted", "under_review", "approved", "rejected", "converted"].map(
              (s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={status === s ? "default" : "outline"}
                  onClick={() => {
                    setStatus(s);
                    setPage(1);
                  }}
                  className="capitalize"
                >
                  {s.replace("_", " ")}
                </Button>
              )
            )}
          </div>
          <Input
            placeholder="Search name / phone / reg no"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-64"
          />
        </FilterCommandBar>

        {query.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-[color:var(--w11-text-secondary)]" />
          </div>
        ) : rows.length === 0 ? (
          <DataPanel>
            <AOSEmptyState
              title={`No ${status.replace("_", " ")} applications`}
              description="Applications submitted on the school's public site appear here."
            />
          </DataPanel>
        ) : (
          <DataPanel bodyClassName="p-0">
            <DataTable
              rowKey={(r: Registration) => r.id}
              columns={[
                { key: "registration_number", label: "Reg No" },
                { key: "student_name", label: "Student" },
                { key: "class_name", label: "Class" },
                { key: "guardian_name", label: "Guardian" },
                { key: "guardian_phone", label: "Phone" },
                {
                  key: "status",
                  label: "Status",
                  render: (row: Registration) => (
                    <span className={`win11-chip ${STATUS_TONES[row.status] ?? ""}`}>
                      {row.status.replace("_", " ")}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  noExport: true,
                  render: (row: Registration) => (
                    <Button variant="outline" size="sm" onClick={() => setSelected(row)}>
                      Review
                    </Button>
                  ),
                },
              ]}
              rows={rows}
            />
          </DataPanel>
        )}

        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-w-lg">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selected.student_name}
                    <Badge variant="outline">{selected.registration_number}</Badge>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>Guardian:</strong> {selected.guardian_name} (
                    {selected.guardian_phone})
                  </p>
                  {selected.class_name && (
                    <p>
                      <strong>Applied class:</strong> {selected.class_name}
                    </p>
                  )}
                  {selected.student_dob_bs && (
                    <p>
                      <strong>DOB (BS):</strong> {selected.student_dob_bs}
                    </p>
                  )}
                  {selected.previous_school && (
                    <p>
                      <strong>Previous school:</strong> {selected.previous_school}
                    </p>
                  )}
                  {selected.documents && selected.documents.length > 0 && (
                    <p>
                      <strong>Documents:</strong>{" "}
                      {selected.documents.map((d) => d.label || d.file_id).join(", ")}
                    </p>
                  )}
                  {selected.review_notes && (
                    <p className="text-[color:var(--w11-text-secondary)]">
                      <strong>Notes:</strong> {selected.review_notes}
                    </p>
                  )}
                </div>
                <Textarea
                  placeholder="Review notes (shared with the applicant on rejection)"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
                {selected.status === "approved" && (
                  <div>
                    <label className="text-xs text-[color:var(--w11-text-secondary)]">
                      Admission fee (NPR, optional — raises a bill on convert)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      placeholder="e.g. 5000"
                    />
                  </div>
                )}
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      review.mutate({ id: selected.id, decision: "under_review" })
                    }
                    disabled={review.isPending}
                  >
                    Under review
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      review.mutate({ id: selected.id, decision: "rejected" })
                    }
                    disabled={review.isPending}
                  >
                    Reject
                  </Button>
                  {selected.status !== "converted" && (
                    <Button
                      onClick={() => {
                        if (selected.status !== "approved") {
                          // approve first, then the office converts
                          review.mutate(
                            { id: selected.id, decision: "approved" },
                            { onSuccess: () => convert.mutate(selected.id) }
                          );
                        } else {
                          convert.mutate(selected.id);
                        }
                      }}
                      disabled={review.isPending || convert.isPending}
                    >
                      {convert.isPending ? (
                        <Loader2 className="animate-spin w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4 mr-1" />
                      )}
                      Approve &amp; enroll
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </AOSPageBody>
    </AOSPage>
  );
}

function fee_amount_safe(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
