"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BSMonthInput } from "@/components/ui/bs-date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AOSPage, AOSPageHeader, AOSPageBody, KpiCard, StatGrid,
  FilterCommandBar, DataPanel, AOSEmptyState,
} from "@/components/aos/kit/page-kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";import {
  Search,
  X,
  DollarSign,
  Receipt,
  Loader2,
  Download,
  History,
  Printer,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Users,
  Wallet,
} from "lucide-react";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { adToBS, displayBS, formatBSMonth } from "@/lib/nepali_date";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EMPTY_PAYMENT_METHODS_RESPONSE,
  fetchPaymentMethods,
  type PaymentMethodConfig,
  type PaymentMethodKey,
} from "@/lib/services/payment-methods.service";

type FeeStatus = "paid" | "partial" | "pending" | "overdue" | "waived";
type PaymentMethod = PaymentMethodKey;

interface FeeCollection {
  id: string;
  student_id: string;
  student_name: string;
  class_name?: string;
  section_name?: string;
  roll_number?: number;
  enrollment_number?: string;
  fee_type: string;
  amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: FeeStatus;
  payment_method?: PaymentMethod;
  base_amount?: number;
  late_fine_amount?: number;
  discount_amount?: number;
  gross_amount?: number;
  net_amount?: number;
  academic_year?: string;
  month_bs?: string;
  year_bs?: string;
  is_scholarship?: boolean;
  notes?: string;
  due_date?: string;
  created_at?: string;
  paid_at?: string;
  receipt_id?: string;
  receipt_number?: string;
}

interface StudentOption {
  id: string;
  full_name: string;
  class_name?: string;
  section_name?: string;
  roll_number?: number;
  enrollment_number?: string;
}

interface BillFormState {
  feeType: string;
  baseAmount: string;
  discountAmount: string;
  lateFineAmount: string;
  academicYear: string;
  monthBs: string;
  yearBs: string;
  isScholarship: boolean;
  notes: string;
}

interface StudentAccountSummary {
  student_id: string;
  student_name: string;
  class_name?: string;
  section_name?: string;
  roll_number?: number;
  enrollment_number?: string;
  fee_count: number;
  pending_count: number;
  overdue_count: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
}

/** Fee status → chip paint using the Fluent status palette (the 11.css
 *  win11-chip tone recipe). */
const STATUS_CONFIG: Record<
  FeeStatus,
  { label: string; style: React.CSSProperties; icon: typeof CheckCircle2 }
> = {
  paid: {
    label: "Paid",
    style: { background: "rgba(16,124,16,.12)", color: "#107c10" },
    icon: CheckCircle2,
  },
  partial: {
    label: "Partial",
    style: { background: "rgba(216,59,1,.12)", color: "#d83b01" },
    icon: Clock,
  },
  pending: {
    label: "Pending",
    style: { background: "var(--w11-control-hover)", color: "var(--w11-text-secondary)" },
    icon: Clock,
  },
  overdue: {
    label: "Overdue",
    style: { background: "rgba(196,43,28,.12)", color: "#c42b1c" },
    icon: AlertTriangle,
  },
  waived: {
    label: "Waived",
    style: { background: "var(--w11-accent-light)", color: "var(--w11-accent)" },
    icon: CheckCircle2,
  },
};

function formatCurrency(value: number) {
  return `Rs. ${value.toLocaleString()}`;
}

function hasOutstandingBalance(fee: FeeCollection) {
  return fee.due_amount > 0 && fee.payment_status !== "waived";
}

function formatStudentMeta(item: {
  class_name?: string;
  section_name?: string;
  roll_number?: number;
  enrollment_number?: string;
}) {
  const parts = [item.class_name, item.section_name].filter(Boolean);
  if (item.roll_number) {
    parts.push(`Roll ${item.roll_number}`);
  }
  if (item.enrollment_number) {
    parts.push(item.enrollment_number);
  }
  return parts.join(" • ") || "Student profile details unavailable";
}

function sortFeeCollections(fees: FeeCollection[]) {
  const priority = (fee: FeeCollection) => {
    if (fee.payment_status === "overdue") return 0;
    if (hasOutstandingBalance(fee)) return 1;
    if (fee.payment_status === "waived") return 2;
    return 3;
  };

  return [...fees].sort((left, right) => {
    const priorityDiff = priority(left) - priority(right);
    if (priorityDiff !== 0) return priorityDiff;

    const rightDate = new Date(
      right.due_date || right.paid_at || right.created_at || 0,
    ).getTime();
    const leftDate = new Date(
      left.due_date || left.paid_at || left.created_at || 0,
    ).getTime();
    return rightDate - leftDate;
  });
}

function createBillFormState(
  overrides?: Partial<BillFormState>,
): BillFormState {
  return {
    feeType: "",
    baseAmount: "",
    discountAmount: "",
    lateFineAmount: "",
    academicYear: "",
    monthBs: "",
    yearBs: "",
    isScholarship: false,
    notes: "",
    ...overrides,
  };
}

function parseMoneyValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function calculateNetAmount(form: BillFormState) {
  return Math.max(
    parseMoneyValue(form.baseAmount)
      + parseMoneyValue(form.lateFineAmount)
      - parseMoneyValue(form.discountAmount),
    0,
  );
}

function buildCollectionPayload(form: BillFormState) {
  return {
    fee_type: form.feeType.trim(),
    amount: parseMoneyValue(form.baseAmount),
    discount_amount: parseMoneyValue(form.discountAmount),
    late_fine_amount: parseMoneyValue(form.lateFineAmount),
    academic_year: form.academicYear || undefined,
    month_bs: form.monthBs.trim() || undefined,
    year_bs: form.yearBs.trim() || undefined,
    is_scholarship: form.isScholarship,
    notes: form.notes.trim() || undefined,
  };
}

function accountToStudentOption(
  account: StudentAccountSummary | null,
): StudentOption | null {
  if (!account) {
    return null;
  }
  return {
    id: account.student_id,
    full_name: account.student_name,
    class_name: account.class_name,
    section_name: account.section_name,
    roll_number: account.roll_number,
    enrollment_number: account.enrollment_number,
  };
}

export default function FeeCollectPage() {
  return (
    <PluginGate slug="fees">
      <CollectContent />
    </PluginGate>
  );
}

function CollectContent() {
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("all");
  const [sectionId, setSectionId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const response = await api.get("/academics/classes");
      return response.data?.data || [];
    },
  });

  const selectedClass = (classes || []).find((item: any) => item.id === classId);
  const sections: any[] = selectedClass?.sections || [];

  const {
    data: collectionsData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["fee-collections", classId, sectionId, search, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = { per_page: "500" };
      if (classId !== "all") params.class_id = classId;
      if (sectionId !== "all") params.section_id = sectionId;
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      const response = await api.get("/fees/collections", { params });
      return (response.data?.data || []) as FeeCollection[];
    },
    retry: 1,
  });

  const collections = collectionsData || [];
  const groupedAccounts = new Map<string, StudentAccountSummary>();

  collections.forEach((fee) => {
    const existing = groupedAccounts.get(fee.student_id) || {
      student_id: fee.student_id,
      student_name: fee.student_name,
      class_name: fee.class_name,
      section_name: fee.section_name,
      roll_number: fee.roll_number,
      enrollment_number: fee.enrollment_number,
      fee_count: 0,
      pending_count: 0,
      overdue_count: 0,
      total_amount: 0,
      paid_amount: 0,
      due_amount: 0,
    };

    existing.fee_count += 1;
    existing.total_amount += fee.amount || 0;
    existing.paid_amount += fee.paid_amount || 0;
    existing.due_amount += fee.due_amount || 0;
    if (hasOutstandingBalance(fee)) {
      existing.pending_count += 1;
    }
    if (fee.payment_status === "overdue") {
      existing.overdue_count += 1;
    }

    groupedAccounts.set(fee.student_id, existing);
  });

  const studentAccounts = Array.from(groupedAccounts.values()).sort(
    (left, right) => {
      if (right.due_amount !== left.due_amount) {
        return right.due_amount - left.due_amount;
      }
      if (right.pending_count !== left.pending_count) {
        return right.pending_count - left.pending_count;
      }
      return left.student_name.localeCompare(right.student_name);
    },
  );

  useEffect(() => {
    if (!studentAccounts.length) {
      if (selectedStudentId) {
        setSelectedStudentId(null);
      }
      return;
    }

    if (!selectedStudentId) {
      setSelectedStudentId(studentAccounts[0].student_id);
      return;
    }

    const selectedStillVisible = studentAccounts.some(
      (item) => item.student_id === selectedStudentId,
    );
    if (!selectedStillVisible && !isFetching) {
      setSelectedStudentId(studentAccounts[0].student_id);
    }
  }, [isFetching, selectedStudentId, studentAccounts]);

  const selectedAccount =
    studentAccounts.find((item) => item.student_id === selectedStudentId) || null;

  const summary = {
    students: studentAccounts.length,
    feeRecords: collections.length,
    pending: collections.filter(hasOutstandingBalance).length,
    overdue: collections.filter((item) => item.payment_status === "overdue").length,
    totalDue: collections.reduce((sum, item) => sum + (item.due_amount || 0), 0),
    totalCollected: collections.reduce(
      (sum, item) => sum + (item.paid_amount || 0),
      0,
    ),
  };

  const downloadReceipt = useCallback(async (fee: FeeCollection) => {
    try {
      const receiptId =
        fee.receipt_id ||
        (await api.get(`/fees/collections/${fee.id}/receipt`)).data?.data?.id;
      if (!receiptId) {
        toast.error("No receipt available");
        return;
      }
      const response = await api.get(`/fees/receipts/${receiptId}/pdf`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `receipt_${fee.receipt_number || fee.id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download receipt");
    }
  }, []);

  const printStatement = useCallback(async (account: StudentAccountSummary) => {
    try {
      const response = await api.get(
        `/fees/students/${account.student_id}/statement/pdf`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `statement_${account.student_name || account.student_id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not generate statement PDF");
    }
  }, []);

  const clearFilters = () => {
    setSearch("");
    setClassId("all");
    setSectionId("all");
    setStatusFilter("all");
  };

  const hasFilters =
    !!search ||
    classId !== "all" ||
    sectionId !== "all" ||
    statusFilter !== "all";

  return (
    <AOSPage>
      <AOSPageHeader
        title="Collect Fees"
        subtitle="Search a student, review the full fee ledger, and collect payment from one accountant workspace."
      />
      <AOSPageBody className="space-y-4">
        <FilterCommandBar>
          <div className="md:col-span-2 relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--w11-text-secondary)]" />
            <Input
              className="pl-9"
              placeholder="Search by student name, admission number, or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select
            value={classId}
            onValueChange={(v) => {
              setClassId(v);
              setSectionId("all");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {(classes || []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sectionId}
            onValueChange={setSectionId}
            disabled={classId === "all" || !sections.length}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {sections.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partially Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-[color:var(--w11-text-secondary)] hover:text-[color:var(--w11-text-primary)] flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </FilterCommandBar>

        <StatGrid className="mb-0" min={140}>
          <KpiCard label="Students" value={isFetching ? "…" : summary.students} color="var(--w11-text-primary)" />
          <KpiCard label="Fee Bills" value={isFetching ? "…" : summary.feeRecords} color="var(--w11-text-primary)" />
          <KpiCard label="Open Bills" value={isFetching ? "…" : summary.pending} color="#d83b01" />
          <KpiCard label="Overdue" value={isFetching ? "…" : summary.overdue} color="#c42b1c" />
          <KpiCard label="Total Collected" value={isFetching ? "…" : formatCurrency(summary.totalCollected)} color="#107c10" />
          <KpiCard
            label="Outstanding"
            value={isFetching ? "…" : formatCurrency(summary.totalDue)}
            color={summary.totalDue > 0 ? "#c42b1c" : "var(--w11-text-primary)"}
          />
        </StatGrid>

        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <DataPanel
            title={
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Student Accounts
              </span>
            }
            bodyClassName="px-3 pb-3 pt-0"
          >
            <p className="text-xs text-[color:var(--w11-text-secondary)] pt-3 pb-2">
              Pick a student to keep pending dues, full history, and payment
              actions in one place.
            </p>
            {isError ? (
              <div className="flex flex-col items-center py-12 space-y-3">
                <p className="text-sm text-[#c42b1c]">Failed to load student ledgers. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[color:var(--w11-text-secondary)]" />
              </div>
            ) : studentAccounts.length === 0 ? (
              <AOSEmptyState
                icon={<AlertCircle className="h-10 w-10" style={{ color: "var(--w11-text-tertiary)" }} />}
                title="No student accounts found"
                description={
                  hasFilters
                    ? "Try changing your filters to bring a student ledger into view."
                    : "Student ledgers will appear here once fee structures are applied or bills are created manually."
                }
              />
            ) : (
              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                {studentAccounts.map((account) => {
                  const isSelected = account.student_id === selectedStudentId;
                  return (
                    <button
                      key={account.student_id}
                      type="button"
                      onClick={() => setSelectedStudentId(account.student_id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-[var(--w11-accent)] shadow-sm"
                          : "border-transparent hover:bg-[color:var(--w11-control-hover)]"
                      }`}
                      style={isSelected ? { background: "var(--w11-accent-light)" } : undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {account.student_name}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--w11-text-secondary)]">
                            {formatStudentMeta(account)}
                          </p>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-[color:var(--w11-text-secondary)] transition-transform ${
                            isSelected ? "translate-x-0.5 text-[color:var(--w11-text-primary)]" : ""
                          }`}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">{account.fee_count} bills</Badge>
                        {account.pending_count > 0 ? (
                          <span className="win11-chip warning">
                            {account.pending_count} open
                          </span>
                        ) : null}
                        {account.overdue_count > 0 ? (
                          <span className="win11-chip error">
                            {account.overdue_count} overdue
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-[color:var(--w11-text-secondary)]">Outstanding</span>
                        <span
                          className="font-semibold"
                          style={{ color: account.due_amount > 0 ? "#c42b1c" : "var(--w11-text-primary)" }}
                        >
                          {formatCurrency(account.due_amount)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </DataPanel>

          <StudentAccountWorkbench
            account={selectedAccount}
            classId={classId}
            sectionId={sectionId}
            onDownloadReceipt={downloadReceipt}
            onPrintStatement={printStatement}
            onStudentFocus={setSelectedStudentId}
          />
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}

function StudentAccountWorkbench({
  account,
  classId,
  sectionId,
  onDownloadReceipt,
  onPrintStatement,
  onStudentFocus,
}: {
  account: StudentAccountSummary | null;
  classId: string;
  sectionId: string;
  onDownloadReceipt: (fee: FeeCollection) => void;
  onPrintStatement: (account: StudentAccountSummary) => void;
  onStudentFocus: (studentId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedFeeId, setSelectedFeeId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [payDate, setPayDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [studentSearch, setStudentSearch] = useState("");
  const [studentMenuOpen, setStudentMenuOpen] = useState(false);
  const [billForm, setBillForm] = useState<BillFormState>(() =>
    createBillFormState(),
  );
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [billDialogMode, setBillDialogMode] = useState<"create" | "adjust">(
    "create",
  );
  const [statementPending, setStatementPending] = useState(false);

  const { data: paymentMethodData } = useQuery({
    queryKey: ["fee-payment-methods"],
    queryFn: async () => {
      try {
        return await fetchPaymentMethods();
      } catch {
        return EMPTY_PAYMENT_METHODS_RESPONSE;
      }
    },
  });

  const enabledPaymentMethods = useMemo(
    () => paymentMethodData?.methods.filter((item) => item.enabled) || [],
    [paymentMethodData?.methods],
  );
  const methodMap = useMemo(
    () => new Map(enabledPaymentMethods.map((item) => [item.key, item])),
    [enabledPaymentMethods],
  );
  const selectedMethod = methodMap.get(method) || enabledPaymentMethods[0] || null;

  const { data: studentSearchResults } = useQuery({
    queryKey: ["fee-desk-student-search", studentSearch, classId, sectionId],
    enabled: studentSearch.trim().length >= 2,
    queryFn: async () => {
      const params: Record<string, string> = { per_page: "20" };
      if (studentSearch.trim()) params.search = studentSearch.trim();
      if (classId !== "all") params.class_id = classId;
      if (sectionId !== "all") params.section_id = sectionId;
      const response = await api.get("/students", { params });
      return (response.data?.data || []) as StudentOption[];
    },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["student-fee-workspace", account?.student_id],
    enabled: !!account?.student_id,
    queryFn: async () => {
      const response = await api.get("/fees/collections", {
        params: { student_id: account!.student_id, per_page: "200" },
      });
      return sortFeeCollections((response.data?.data || []) as FeeCollection[]);
    },
  });

  const fees = useMemo(() => data || [], [data]);

  useEffect(() => {
    if (!fees.length) {
      if (selectedFeeId) {
        setSelectedFeeId(null);
      }
      return;
    }

    const currentSelection = fees.find((fee) => fee.id === selectedFeeId);
    const nextOpenFee = fees.find(hasOutstandingBalance) || fees[0];

    if (
      !currentSelection ||
      (!hasOutstandingBalance(currentSelection) && fees.some(hasOutstandingBalance))
    ) {
      setSelectedFeeId(nextOpenFee.id);
    }
  }, [fees, selectedFeeId]);

  const selectedFee = fees.find((fee) => fee.id === selectedFeeId) || fees[0] || null;

  useEffect(() => {
    const defaultMethod = enabledPaymentMethods[0]?.key || "cash";
    setMethod(defaultMethod);
    setReference("");
    setPayDate(new Date().toISOString().split("T")[0]);
    setAmount(
      selectedFee && hasOutstandingBalance(selectedFee)
        ? String(selectedFee.due_amount)
        : "",
    );
  }, [selectedFee, enabledPaymentMethods]);

  useEffect(() => {
    if (!enabledPaymentMethods.length) return;
    if (!methodMap.has(method)) {
      setMethod(enabledPaymentMethods[0].key);
    }
  }, [method, methodMap, enabledPaymentMethods]);

  useEffect(() => {
    if (!account) {
      setSelectedFeeId(null);
      setShowAdjustForm(false);
      setBillForm(createBillFormState());
    }
  }, [account]);

  useEffect(() => {
    if (!account) {
      return;
    }
    setBillForm(
      (prev) =>
        createBillFormState({
        academicYear: selectedFee?.academic_year || "",
        monthBs: selectedFee?.month_bs || "",
        yearBs: selectedFee?.year_bs || "",
        feeType: selectedFee?.fee_type || prev.feeType,
        baseAmount:
          selectedFee && selectedFee.base_amount != null
            ? String(selectedFee.base_amount)
            : prev.baseAmount,
        discountAmount:
          selectedFee && selectedFee.discount_amount != null
            ? String(selectedFee.discount_amount)
            : prev.discountAmount,
        lateFineAmount:
          selectedFee && selectedFee.late_fine_amount != null
            ? String(selectedFee.late_fine_amount)
            : prev.lateFineAmount,
        isScholarship: Boolean(selectedFee?.is_scholarship),
        notes: selectedFee?.notes || prev.notes,
      }),
    );
  }, [account, selectedFee]);

  const openBillDialog = (mode: "create" | "adjust") => {
    if (mode === "create") {
      // Fresh bill: default the BS cycle to the CURRENT BS month so the
      // accountant never has to type "2083-05" by hand.
      const todayBs = adToBS(new Date());
      setBillForm(
        createBillFormState({
          monthBs: `${todayBs.year}-${String(todayBs.month).padStart(2, "0")}`,
          yearBs: String(todayBs.year),
        }),
      );
    } else {
      setBillForm(
        createBillFormState({
          academicYear: selectedFee?.academic_year || "",
          monthBs: selectedFee?.month_bs || "",
          yearBs: selectedFee?.year_bs || "",
          feeType: selectedFee?.fee_type || "",
          baseAmount:
            selectedFee && selectedFee.base_amount != null
              ? String(selectedFee.base_amount)
              : "",
          discountAmount:
            selectedFee && selectedFee.discount_amount != null
              ? String(selectedFee.discount_amount)
              : "",
          lateFineAmount:
            selectedFee && selectedFee.late_fine_amount != null
              ? String(selectedFee.late_fine_amount)
              : "",
          isScholarship: Boolean(selectedFee?.is_scholarship),
          notes: selectedFee?.notes || "",
        }),
      );
    }
    setBillDialogMode(mode);
    setBillDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!account) {
        throw new Error("Select a student first");
      }
      if (!billForm.feeType.trim()) {
        throw new Error("Enter a fee name");
      }
      const payload = {
        student_id: account.student_id,
        ...buildCollectionPayload(billForm),
      };
      const response = await api.post("/fees/collections", payload);
      return response.data;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["fee-collections"] });
      queryClient.invalidateQueries({
        queryKey: ["student-fee-workspace", account?.student_id],
      });
      queryClient.invalidateQueries({ queryKey: ["fee-desk-student-search"] });
      setBillForm(createBillFormState());
      setShowAdjustForm(false);
      setBillDialogOpen(false);
      const created = response?.data;
      toast.success(
        created?.fee_type
          ? `${created.fee_type} bill created for ${account?.student_name}`
          : "Bill created successfully",
      );
      if (created?.id) {
        setSelectedFeeId(created.id);
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || "Could not create bill");
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFee) {
        throw new Error("Select a bill first");
      }
      const payload = buildCollectionPayload(billForm);
      const response = await api.put(`/fees/collections/${selectedFee.id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-collections"] });
      queryClient.invalidateQueries({
        queryKey: ["student-fee-workspace", account?.student_id],
      });
      queryClient.invalidateQueries({ queryKey: ["fee-desk-student-search"] });
      toast.success("Bill adjusted successfully");
      setBillDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || "Could not adjust bill");
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFee) {
        throw new Error("Select a fee record first");
      }
      if (!hasOutstandingBalance(selectedFee)) {
        throw new Error("This fee record has no outstanding balance");
      }
      if (!selectedMethod) {
        throw new Error("No payment methods are configured");
      }

      if (selectedMethod?.mode === "online") {
        const response = await api.post(
          `/fees/collections/${selectedFee.id}/pay-online`,
          { gateway: method },
        );
        return response.data;
      }

      const parsedAmount = Number.parseFloat(amount);
      if (!parsedAmount || parsedAmount <= 0) {
        throw new Error("Enter a valid payment amount");
      }

      return (
        await api.post(`/fees/collections/${selectedFee.id}/pay`, {
          amount: parsedAmount,
          payment_method: method,
          transaction_id: reference || undefined,
          payment_date: payDate,
        })
      ).data;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["fee-collections"] });
      queryClient.invalidateQueries({
        queryKey: ["student-fee-workspace", account?.student_id],
      });

      if (response?.data?.payment_url) {
        window.location.href = response.data.payment_url;
        return;
      }

      setReference("");
      toast.success(
        response?.data?.receipt?.receipt_number
          ? `Payment recorded • Receipt ${response.data.receipt.receipt_number}`
          : "Payment recorded successfully",
      );
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || error?.message || "Payment failed",
      );
    },
  });

  if (!account) {
    return (
      <div className="win11-card flex min-h-[420px] flex-col items-center justify-center text-center text-[color:var(--w11-text-secondary)] p-6">
        <Users className="mb-3 h-10 w-10" style={{ color: "var(--w11-text-tertiary)" }} />
        <p className="font-medium text-[color:var(--w11-text-primary)]">Choose a student account</p>
        <p className="mt-1 max-w-md text-sm">
          Start from the left panel to open one student ledger, review dues,
          and collect payment without switching pages.
        </p>
        <div className="mt-5 w-full max-w-md text-left space-y-2">
          <Label>Find student for bill creation</Label>
          <Input
            value={studentSearch}
            onChange={(event) => {
              setStudentSearch(event.target.value);
              setStudentMenuOpen(true);
            }}
            onFocus={() => setStudentMenuOpen(true)}
            placeholder="Search by name, ID, or admission number"
          />
          {studentMenuOpen && studentSearch.trim().length >= 2 ? (
            <div
              className="max-h-60 overflow-y-auto rounded-xl border border-[var(--w11-border-subtle)] shadow-sm"
              style={{ background: "var(--w11-card-bg)" }}
            >
              {(studentSearchResults || []).length === 0 ? (
                <div className="px-4 py-3 text-sm text-[color:var(--w11-text-secondary)]">
                  No matching students found.
                </div>
              ) : (
                (studentSearchResults || []).map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => {
                      onStudentFocus(student.id);
                      setStudentSearch("");
                      setStudentMenuOpen(false);
                    }}
                    className="flex w-full flex-col gap-1 border-b border-[var(--w11-border-subtle)] px-4 py-3 text-left last:border-b-0 hover:bg-[color:var(--w11-control-hover)]"
                  >
                    <span className="font-medium text-[color:var(--w11-text-primary)]">{student.full_name}</span>
                    <span className="text-xs text-[color:var(--w11-text-secondary)]">
                      {formatStudentMeta(student)}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="win11-card flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--w11-text-secondary)]" />
      </div>
    );
  }

  const totalPaid = fees.reduce((sum, fee) => sum + (fee.paid_amount || 0), 0);
  const totalDue = fees.reduce((sum, fee) => sum + (fee.due_amount || 0), 0);
  const openBillCount = fees.filter(hasOutstandingBalance).length;
  const receiptCount = fees.filter((fee) => fee.receipt_id).length;

  return (
    <div className="space-y-4">
      <DataPanel
        title={account.student_name}
        actions={
          <div className="flex items-center gap-2">
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--w11-text-secondary)]" />
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={() => openBillDialog("create")}
            >
              <Plus className="h-3 w-3" />
              New Bill
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1"
              disabled={!selectedFee}
              onClick={() => openBillDialog("adjust")}
            >
              Adjust Bill
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              disabled={statementPending}
              onClick={() => {
                setStatementPending(true);
                Promise.resolve(onPrintStatement(account)).finally(() =>
                  setStatementPending(false),
                );
              }}
            >
              {statementPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Printer className="h-3 w-3" />
              )}
              Print Statement
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[color:var(--w11-text-secondary)] -mt-2 mb-3">
          {formatStudentMeta(account)}
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Outstanding", value: formatCurrency(totalDue), color: totalDue > 0 ? "#c42b1c" : "var(--w11-text-primary)" },
            { label: "Collected", value: formatCurrency(totalPaid), color: "#107c10" },
            { label: "Open Bills", value: String(openBillCount), color: openBillCount > 0 ? "#d83b01" : "var(--w11-text-primary)" },
            { label: "Receipts", value: String(receiptCount), color: "var(--w11-text-primary)" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl px-4 py-3" style={{ background: "var(--w11-control-hover)" }}>
              <p className="text-lg font-semibold" style={{ color: item.color }}>{item.value}</p>
              <p className="text-xs text-[color:var(--w11-text-secondary)]">{item.label}</p>
            </div>
          ))}
        </div>
      </DataPanel>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <DataPanel
          title={
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Account History
            </span>
          }
        >
          <p className="text-xs text-[color:var(--w11-text-secondary)] -mt-2 mb-3">
            Every bill, receipt, and remaining balance for the selected
            student.
          </p>
          {fees.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--w11-border-default)] px-4 py-10 text-center text-[color:var(--w11-text-secondary)]">
              No fee records found for this student yet.
            </div>
          ) : (
            <div className="space-y-3">
              {fees.map((fee) => {
                const status =
                  STATUS_CONFIG[fee.payment_status] || STATUS_CONFIG.pending;
                const StatusIcon = status.icon;
                const isSelected = fee.id === selectedFeeId;

                return (
                  // E206: must NOT be a <button> — the receipt <Button> below
                  // is a real descendant and <button> cannot nest <button>
                  // (React hydration error). A div with button semantics keeps
                  // the card selectable AND keyboard-operable.
                  <div
                    key={fee.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedFeeId(fee.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedFeeId(fee.id);
                      }
                    }}
                    className={`w-full rounded-xl border px-4 py-4 text-left transition cursor-pointer ${
                      isSelected
                        ? "border-[var(--w11-accent)] shadow-sm"
                        : "border-transparent hover:bg-[color:var(--w11-control-hover)]"
                    }`}
                    style={isSelected ? { background: "var(--w11-accent-light)" } : undefined}
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-sm">{fee.fee_type}</p>
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={status.style}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                          {isSelected ? (
                            <Badge variant="outline">Selected</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--w11-text-secondary)]">
                          {fee.receipt_number
                            ? `Receipt #${fee.receipt_number}`
                            : "No receipt generated yet"}
                          {fee.due_date
                            ? ` • Due ${displayBS(fee.due_date)}`
                            : fee.created_at
                              ? ` • Added ${displayBS(fee.created_at)}`
                              : ""}
                        </p>
                      </div>

                      <div className="grid grid-cols-5 gap-2 text-xs xl:min-w-[380px]">
                        <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-control-hover)" }}>
                          <p className="text-[color:var(--w11-text-secondary)]">Period</p>
                          <p className="font-semibold">{formatBSMonth(fee.month_bs, fee.year_bs)}</p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-control-hover)" }}>
                          <p className="text-[color:var(--w11-text-secondary)]">Total</p>
                          <p className="font-semibold">{formatCurrency(fee.amount || 0)}</p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: "rgba(16,124,16,.08)", color: "#107c10" }}>
                          <p style={{ opacity: 0.7 }}>Paid</p>
                          <p className="font-semibold">
                            {formatCurrency(fee.paid_amount || 0)}
                          </p>
                        </div>
                        <div
                          className="rounded-lg px-3 py-2"
                          style={
                            hasOutstandingBalance(fee)
                              ? { background: "rgba(196,43,28,.08)", color: "#c42b1c" }
                              : { background: "var(--w11-control-hover)" }
                          }
                        >
                          <p style={{ opacity: 0.7 }}>Due</p>
                          <p className="font-semibold">
                            {formatCurrency(fee.due_amount || 0)}
                          </p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-control-hover)" }}>
                          <p className="text-[color:var(--w11-text-secondary)]">Due Date</p>
                          <p className="font-semibold">{fee.due_date ? displayBS(fee.due_date) : "—"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {hasOutstandingBalance(fee) ? (
                        <span className="win11-chip warning">
                          Ready to collect
                        </span>
                      ) : null}
                      {fee.receipt_id ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDownloadReceipt(fee);
                          }}
                        >
                          <Download className="h-3 w-3" />
                          Receipt
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DataPanel>

        <DataPanel
          className="h-fit 2xl:sticky 2xl:top-4"
          title={
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Quick Collection
            </span>
          }
        >
          <p className="text-xs text-[color:var(--w11-text-secondary)] -mt-2 mb-4">
            Select an open bill from the ledger and collect it from this same
            screen.
          </p>
          {!selectedFee ? (
            <div className="rounded-xl border border-dashed border-[var(--w11-border-default)] px-4 py-8 text-center text-sm text-[color:var(--w11-text-secondary)]">
              Select a fee record to start collecting payment.
            </div>
          ) : (
            <>
              <div
                className="rounded-xl border border-[var(--w11-border-subtle)] p-4 space-y-2 mb-4"
                style={{ background: "var(--w11-control-hover)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{selectedFee.fee_type}</p>
                    <p className="text-xs text-[color:var(--w11-text-secondary)]">
                      {selectedFee.receipt_number
                        ? `Latest receipt #${selectedFee.receipt_number}`
                        : "No receipt issued yet"}
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={
                      STATUS_CONFIG[selectedFee.payment_status]?.style ||
                      STATUS_CONFIG.pending.style
                    }
                  >
                    {STATUS_CONFIG[selectedFee.payment_status]?.label || "Pending"}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-card-bg)" }}>
                    <p className="text-[color:var(--w11-text-secondary)]">Period</p>
                    <p className="font-semibold">{formatBSMonth(selectedFee.month_bs, selectedFee.year_bs)}</p>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-card-bg)" }}>
                    <p className="text-[color:var(--w11-text-secondary)]">Total</p>
                    <p className="font-semibold">
                      {formatCurrency(selectedFee.amount || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-card-bg)", color: "#107c10" }}>
                    <p style={{ opacity: 0.7 }}>Paid</p>
                    <p className="font-semibold">
                      {formatCurrency(selectedFee.paid_amount || 0)}
                    </p>
                  </div>
                  <div
                    className="rounded-lg px-3 py-2"
                    style={
                      hasOutstandingBalance(selectedFee)
                        ? { background: "rgba(196,43,28,.08)", color: "#c42b1c" }
                        : { background: "var(--w11-card-bg)" }
                    }
                  >
                    <p style={{ opacity: 0.7 }}>Due</p>
                    <p className="font-semibold">
                      {formatCurrency(selectedFee.due_amount || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {hasOutstandingBalance(selectedFee) ? (
                <>
                  {enabledPaymentMethods.length === 0 ? (
                    <div
                      className="rounded-xl border px-4 py-3 text-sm mb-4"
                      style={{ background: "rgba(216,59,1,.08)", borderColor: "rgba(216,59,1,.3)", color: "#d83b01" }}
                    >
                      No payment methods are configured for this school. Update them in Integrations before collecting payment.
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      <Label>Payment Method</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {enabledPaymentMethods.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setMethod(option.key)}
                            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                              method === option.key
                                ? "border-[var(--w11-accent)]"
                                : "border-[var(--w11-border-default)] hover:bg-[color:var(--w11-control-hover)]"
                            }`}
                            style={
                              method === option.key
                                ? { background: "var(--w11-accent)", color: "var(--w11-accent-text)" }
                                : undefined
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedMethod?.mode === "online" ? (
                    <div
                      className="rounded-xl border px-4 py-3 text-sm mb-4"
                      style={{ background: "var(--w11-accent-light)", borderColor: "var(--w11-accent)", color: "var(--w11-accent)" }}
                    >
                      The payer will be redirected to {selectedMethod?.label || "online gateway"} to complete {formatCurrency(selectedFee.due_amount || 0)}.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5 mb-4">
                        <Label>
                          Amount (NPR)
                          <span className="ml-1 text-xs font-normal text-[color:var(--w11-text-secondary)]">
                            max {formatCurrency(selectedFee.due_amount || 0)}
                          </span>
                        </Label>
                        <Input
                          type="number"
                          value={amount}
                          min={1}
                          max={selectedFee.due_amount}
                          onChange={(event) => setAmount(event.target.value)}
                        />
                        {Number.parseFloat(amount) > 0 &&
                        Number.parseFloat(amount) < (selectedFee.due_amount || 0) ? (
                          <p className="text-xs" style={{ color: "#d83b01" }}>
                            Partial collection will leave {formatCurrency((selectedFee.due_amount || 0) - Number.parseFloat(amount))} still outstanding.
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-1.5 mb-4">
                        <Label>Payment Date</Label>
                        <BSDateInput
                          value={payDate}
                          onChange={setPayDate}
                        />
                      </div>

                      {selectedMethod?.requires_reference ? (
                        <div className="space-y-1.5 mb-4">
                          <Label>
                            Transaction ID / Reference
                            <span className="ml-1 text-xs font-normal text-[color:var(--w11-text-secondary)]">
                              optional
                            </span>
                          </Label>
                          <Input
                            value={reference}
                            onChange={(event) => setReference(event.target.value)}
                            placeholder="Bank ref, cheque no., QR settlement ID"
                          />
                        </div>
                      ) : null}

                      {selectedMethod?.supports_qr &&
                      (selectedMethod.qr_image_url ||
                        selectedMethod.qr_payload ||
                        selectedMethod.instructions) ? (
                        <div
                          className="rounded-xl border px-4 py-3 text-sm space-y-2 mb-4"
                          style={{ background: "rgba(16,124,16,.06)", borderColor: "rgba(16,124,16,.3)", color: "#107c10" }}
                        >
                          <p className="font-medium">{selectedMethod.label} QR Payment</p>
                          {selectedMethod.qr_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={selectedMethod.qr_image_url}
                              alt={`${selectedMethod.label} QR`}
                              className="h-36 w-36 rounded border p-1"
                              style={{ borderColor: "var(--w11-border-default)", background: "#fff" }}
                            />
                          ) : null}
                          {selectedMethod.qr_payload ? (
                            <p className="text-xs break-all" style={{ opacity: 0.8 }}>
                              QR ID: {selectedMethod.qr_payload}
                            </p>
                          ) : null}
                          {selectedMethod.instructions ? (
                            <p className="text-xs" style={{ opacity: 0.8 }}>
                              {selectedMethod.instructions}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}

                  <Button
                    className="w-full gap-2"
                    onClick={() => payMutation.mutate()}
                    disabled={
                      payMutation.isPending ||
                      !selectedMethod ||
                      ((selectedMethod?.mode !== "online") &&
                        (!amount || Number.parseFloat(amount) <= 0))
                    }
                  >
                    {payMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <DollarSign className="h-4 w-4" />
                    )}
                    {selectedMethod?.mode === "online"
                      ? `Pay via ${selectedMethod?.label || "Gateway"}`
                      : "Record Payment & Print Receipt"}
                  </Button>
                </>
              ) : (
                <div
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={{ background: "rgba(16,124,16,.08)", borderColor: "rgba(16,124,16,.3)", color: "#107c10" }}
                >
                  This fee record has no outstanding balance. Select another
                  bill if you need to collect more.
                </div>
              )}

              {selectedFee.receipt_id ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 mt-2"
                  onClick={() => onDownloadReceipt(selectedFee)}
                >
                  <Receipt className="h-4 w-4" />
                  Download Latest Receipt
                </Button>
              ) : null}
            </>
          )}
        </DataPanel>

        <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {billDialogMode === "create"
                  ? `New Bill — ${account.student_name}`
                  : `Adjust Bill — ${selectedFee?.fee_type || ""}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Fee name</Label>
                <Input
                  value={billForm.feeType}
                  onChange={(e) =>
                    setBillForm({ ...billForm, feeType: e.target.value })
                  }
                  placeholder="e.g. Exam Fee"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount (NPR)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={billForm.baseAmount}
                    onChange={(e) =>
                      setBillForm({ ...billForm, baseAmount: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Discount</Label>
                  <Input
                    type="number"
                    min={0}
                    value={billForm.discountAmount}
                    onChange={(e) =>
                      setBillForm({ ...billForm, discountAmount: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Late fine</Label>
                  <Input
                    type="number"
                    min={0}
                    value={billForm.lateFineAmount}
                    onChange={(e) =>
                      setBillForm({ ...billForm, lateFineAmount: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Academic year</Label>
                  <Input
                    value={billForm.academicYear}
                    onChange={(e) =>
                      setBillForm({ ...billForm, academicYear: e.target.value })
                    }
                    placeholder="2083"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>BS month</Label>
                  <BSMonthInput
                    value={billForm.monthBs}
                    onChange={(v) => setBillForm({ ...billForm, monthBs: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>BS year</Label>
                  <Select
                    value={billForm.yearBs}
                    onValueChange={(v) => setBillForm({ ...billForm, yearBs: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="2083" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 15 }, (_, i) => 2075 + i).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y} BS</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-[color:var(--w11-text-secondary)]">
                Billing cycle: {formatBSMonth(billForm.monthBs, billForm.yearBs)}
              </p>
              <div className="flex items-center gap-2">
                <Switch
                  checked={billForm.isScholarship}
                  onCheckedChange={(checked) =>
                    setBillForm({ ...billForm, isScholarship: checked })
                  }
                />
                <Label>Scholarship-funded bill</Label>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={billForm.notes}
                  onChange={(e) =>
                    setBillForm({ ...billForm, notes: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  if (billDialogMode === "create") {
                    createMutation.mutate();
                  } else {
                    adjustMutation.mutate();
                  }
                }}
                disabled={
                  createMutation.isPending ||
                  adjustMutation.isPending ||
                  !billForm.feeType.trim() ||
                  parseMoneyValue(billForm.baseAmount) <= 0
                }
              >
                {(createMutation.isPending || adjustMutation.isPending) ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {billDialogMode === "create" ? "Create Bill" : "Save Adjustments"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
