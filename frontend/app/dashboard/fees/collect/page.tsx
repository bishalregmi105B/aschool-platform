"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  X,
  DollarSign,
  Receipt,
  Loader2,
  Download,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Users,
  Wallet,
} from "lucide-react";
import { BSDateInput } from "@/components/ui/bs-date-input";
import { displayBS } from "@/lib/nepali_date";
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

const STATUS_CONFIG: Record<
  FeeStatus,
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  paid: {
    label: "Paid",
    cls: "bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  partial: {
    label: "Partial",
    cls: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  pending: {
    label: "Pending",
    cls: "bg-gray-100 text-gray-700",
    icon: Clock,
  },
  overdue: {
    label: "Overdue",
    cls: "bg-red-100 text-red-800",
    icon: AlertTriangle,
  },
  waived: {
    label: "Waived",
    cls: "bg-blue-100 text-blue-700",
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Collect Fees</h1>
        <p className="text-muted-foreground text-sm">
          Search a student, review the full fee ledger, and collect payment
          from one accountant workspace.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Students", value: summary.students, cls: "" },
          {
            label: "Fee Bills",
            value: summary.feeRecords,
            cls: "",
          },
          {
            label: "Open Bills",
            value: summary.pending,
            cls: "text-amber-600",
          },
          {
            label: "Overdue",
            value: summary.overdue,
            cls: "text-red-600",
          },
          {
            label: "Total Collected",
            value: formatCurrency(summary.totalCollected),
            cls: "text-green-700",
          },
          {
            label: "Outstanding",
            value: formatCurrency(summary.totalDue),
            cls: summary.totalDue > 0 ? "text-red-600" : "",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-muted/40 rounded-lg px-3 py-2 text-center"
          >
            <p className={`text-lg font-bold ${s.cls}`}>
              {isFetching ? "…" : s.value}
            </p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Student Accounts
            </CardTitle>
            <CardDescription>
              Pick a student to keep pending dues, full history, and payment
              actions in one place.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            {isError ? (
              <div className="flex flex-col items-center py-12 space-y-3">
                <p className="text-sm text-destructive">Failed to load student ledgers. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : studentAccounts.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No student accounts found</p>
                <p className="text-sm mt-1">
                  {hasFilters
                    ? "Try changing your filters to bring a student ledger into view."
                    : "Student ledgers will appear here once fee structures are applied or bills are created manually."}
                </p>
              </div>
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
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {account.student_name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatStudentMeta(account)}
                          </p>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                            isSelected ? "translate-x-0.5 text-foreground" : ""
                          }`}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">{account.fee_count} bills</Badge>
                        {account.pending_count > 0 ? (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                            {account.pending_count} open
                          </Badge>
                        ) : null}
                        {account.overdue_count > 0 ? (
                          <Badge className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
                            {account.overdue_count} overdue
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Outstanding</span>
                        <span
                          className={`font-semibold ${
                            account.due_amount > 0
                              ? "text-red-600"
                              : "text-foreground"
                          }`}
                        >
                          {formatCurrency(account.due_amount)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <StudentAccountWorkbench
          account={selectedAccount}
          classId={classId}
          sectionId={sectionId}
          onDownloadReceipt={downloadReceipt}
          onStudentFocus={setSelectedStudentId}
        />
      </div>
    </div>
  );
}

function StudentAccountWorkbench({
  account,
  classId,
  sectionId,
  onDownloadReceipt,
  onStudentFocus,
}: {
  account: StudentAccountSummary | null;
  classId: string;
  sectionId: string;
  onDownloadReceipt: (fee: FeeCollection) => void;
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
      <>
        <Card>
          <CardContent className="flex min-h-[420px] flex-col items-center justify-center text-center text-muted-foreground">
            <Users className="mb-3 h-10 w-10 opacity-30" />
            <p className="font-medium text-foreground">Choose a student account</p>
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
                <div className="max-h-60 overflow-y-auto rounded-xl border bg-background shadow-sm">
                  {(studentSearchResults || []).length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
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
                        className="flex w-full flex-col gap-1 border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted/40"
                      >
                        <span className="font-medium text-foreground">{student.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatStudentMeta(student)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex min-h-[420px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const totalPaid = fees.reduce((sum, fee) => sum + (fee.paid_amount || 0), 0);
  const totalDue = fees.reduce((sum, fee) => sum + (fee.due_amount || 0), 0);
  const openBillCount = fees.filter(hasOutstandingBalance).length;
  const receiptCount = fees.filter((fee) => fee.receipt_id).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{account.student_name}</CardTitle>
              <CardDescription>{formatStudentMeta(account)}</CardDescription>
            </div>
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Outstanding", value: formatCurrency(totalDue), cls: totalDue > 0 ? "text-red-600" : "" },
              { label: "Collected", value: formatCurrency(totalPaid), cls: "text-green-700" },
              { label: "Open Bills", value: openBillCount, cls: openBillCount > 0 ? "text-amber-600" : "" },
              { label: "Receipts", value: receiptCount, cls: "" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-muted/40 px-4 py-3">
                <p className={`text-lg font-semibold ${item.cls}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Account History
            </CardTitle>
            <CardDescription>
              Every bill, receipt, and remaining balance for the selected
              student.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fees.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground">
                No fee records found for this student yet.
              </div>
            ) : (
              fees.map((fee) => {
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
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-sm">{fee.fee_type}</p>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                          {isSelected ? (
                            <Badge variant="outline">Selected</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
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

                      <div className="grid grid-cols-3 gap-2 text-xs xl:min-w-[280px]">
                        <div className="rounded-lg bg-muted/40 px-3 py-2">
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-semibold">{formatCurrency(fee.amount || 0)}</p>
                        </div>
                        <div className="rounded-lg bg-green-50 px-3 py-2 text-green-700">
                          <p className="text-green-700/70">Paid</p>
                          <p className="font-semibold">
                            {formatCurrency(fee.paid_amount || 0)}
                          </p>
                        </div>
                        <div
                          className={`rounded-lg px-3 py-2 ${
                            hasOutstandingBalance(fee)
                              ? "bg-red-50 text-red-700"
                              : "bg-muted/40"
                          }`}
                        >
                          <p className="text-current/70">Due</p>
                          <p className="font-semibold">
                            {formatCurrency(fee.due_amount || 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {hasOutstandingBalance(fee) ? (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                          Ready to collect
                        </Badge>
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
              })
            )}
          </CardContent>
        </Card>

        <Card className="h-fit 2xl:sticky 2xl:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Quick Collection
            </CardTitle>
            <CardDescription>
              Select an open bill from the ledger and collect it from this same
              screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedFee ? (
              <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Select a fee record to start collecting payment.
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{selectedFee.fee_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedFee.receipt_number
                          ? `Latest receipt #${selectedFee.receipt_number}`
                          : "No receipt issued yet"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_CONFIG[selectedFee.payment_status]?.cls ||
                        STATUS_CONFIG.pending.cls
                      }`}
                    >
                      {STATUS_CONFIG[selectedFee.payment_status]?.label || "Pending"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-background px-3 py-2">
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">
                        {formatCurrency(selectedFee.amount || 0)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-background px-3 py-2 text-green-700">
                      <p className="text-green-700/70">Paid</p>
                      <p className="font-semibold">
                        {formatCurrency(selectedFee.paid_amount || 0)}
                      </p>
                    </div>
                    <div
                      className={`rounded-lg px-3 py-2 ${
                        hasOutstandingBalance(selectedFee)
                          ? "bg-red-50 text-red-700"
                          : "bg-background"
                      }`}
                    >
                      <p className="text-current/70">Due</p>
                      <p className="font-semibold">
                        {formatCurrency(selectedFee.due_amount || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {hasOutstandingBalance(selectedFee) ? (
                  <>
                    {enabledPaymentMethods.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        No payment methods are configured for this school. Update them in Integrations before collecting payment.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {enabledPaymentMethods.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => setMethod(option.key)}
                              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                                method === option.key
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "hover:bg-muted"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedMethod?.mode === "online" ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        The payer will be redirected to {selectedMethod?.label || "online gateway"} to complete {formatCurrency(selectedFee.due_amount || 0)}.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label>
                            Amount (NPR)
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
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
                            <p className="text-xs text-amber-600">
                              Partial collection will leave {formatCurrency((selectedFee.due_amount || 0) - Number.parseFloat(amount))} still outstanding.
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          <Label>Payment Date</Label>
                          <BSDateInput
                            value={payDate}
                            onChange={setPayDate}
                          />
                        </div>

                        {selectedMethod?.requires_reference ? (
                          <div className="space-y-1.5">
                            <Label>
                              Transaction ID / Reference
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
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
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 space-y-2">
                            <p className="font-medium">{selectedMethod.label} QR Payment</p>
                            {selectedMethod.qr_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={selectedMethod.qr_image_url}
                                alt={`${selectedMethod.label} QR`}
                                className="h-36 w-36 rounded border bg-white p-1"
                              />
                            ) : null}
                            {selectedMethod.qr_payload ? (
                              <p className="text-xs text-emerald-900/80 break-all">
                                QR ID: {selectedMethod.qr_payload}
                              </p>
                            ) : null}
                            {selectedMethod.instructions ? (
                              <p className="text-xs text-emerald-900/80">
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
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    This fee record has no outstanding balance. Select another
                    bill if you need to collect more.
                  </div>
                )}

                {selectedFee.receipt_id ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => onDownloadReceipt(selectedFee)}
                  >
                    <Receipt className="h-4 w-4" />
                    Download Latest Receipt
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
