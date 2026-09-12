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
import { Loader2, UserCheck } from "lucide-react";
import { PluginGate } from "@/lib/plugins";

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

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800",
  under_review: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  converted: "bg-[#c5f4dd] text-[#0e3b2e]",
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
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-[#0e3b2e] flex-1">
          Online Applications
        </h1>
        {["submitted", "under_review", "approved", "rejected", "converted"].map(
          (s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                status === s
                  ? "bg-[#0e3b2e] text-[#c5f4dd]"
                  : "bg-[#f7f5f0] text-[#0d1f14]"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          )
        )}
        <Input
          placeholder="Search name / phone / reg no"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-64"
        />
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-[#0e3b2e]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#0d1f14]/60 py-16 text-center">
          No {status.replace("_", " ")} applications. Applications submitted on
          the school&apos;s public site appear here.
        </p>
      ) : (
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
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    STATUS_STYLES[row.status] ?? "bg-gray-100"
                  }`}
                >
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
                  <p className="text-[#0d1f14]/70">
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
                  <label className="text-xs text-[#0d1f14]/70">
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
                    className="bg-[#0e3b2e] text-[#c5f4dd] hover:bg-[#0e3b2e]/90"
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
    </div>
  );
}

function fee_amount_safe(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
