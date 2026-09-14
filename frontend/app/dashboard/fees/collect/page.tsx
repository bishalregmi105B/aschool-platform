"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppGate } from "@/lib/apps";
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
  FilterCommandBar, DataPanel, AOSEmptyState, StatusChip,
} from "@/components/aos/kit/page-kit";
import { useUrlFilters, useDebounced } from "@/components/ui/filter-bar";
import { useI18n } from "@/lib/i18n";
import { SkeletonList, SkeletonStat } from "@/components/ui/skeleton";
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
  Banknote,
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
    <AppGate slug="fees">
      <CollectContent />
    </AppGate>
  );
}

function CollectContent() {
  const { t } = useI18n();
  // Filters live in the URL (addressable desk states — plan 5.1/33).
  const { values: filters, setValues: setFilters, clear: clearFilters, activeCount } =
    useUrlFilters(["search", "class", "section", "status"]);
  const search = filters.search ?? "";
  const classId = filters.class || "all";
  const sectionId = filters.section || "all";
  const statusFilter = filters.status || "all";
  const debouncedSearch = useDebounced(search, 300);
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
    queryKey: ["fee-collections", classId, sectionId, debouncedSearch, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = { per_page: "500" };
      if (classId !== "all") params.class_id = classId;
      if (sectionId !== "all") params.section_id = sectionId;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
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

  const hasFilters = activeCount > 0;

  return (
    <AOSPage>
      <AOSPageHeader
        title={t("Collect Fees", "शुल्क संकलन")}
        subtitle={t(
          "Search a student, review the full fee ledger, and collect payment from one accountant workspace.",
          "विद्यार्थी खोज्नुहोस्, शुल्क खाता हेर्नुहोस् र एउटै कार्यक्षेत्रबाट भुक्तानी उठाउनुहोस्।"
        )}
        actions={
          <div className="flex items-center gap-2">
            {isFetching && !isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--w11-text-secondary)]" aria-hidden />
            ) : null}
          </div>
        }
      />
      <AOSPageBody className="space-y-4">
        <FilterCommandBar>
          <div className="md:col-span-2 relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--w11-text-secondary)]" />
            <Input
              className="pl-9 win11-searchbox"
              placeholder={t(
                "Search by name, admission number, or ID",
                "नाम, भर्ना नम्बर वा ID बाट खोज्नुहोस्"
              )}
              value={search}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>

          <Select
            value={classId}
            onValueChange={(v) => {
              setFilters({ class: v === "all" ? "" : v, section: "" });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("All Classes", "सबै कक्षा")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Classes", "सबै कक्षा")}</SelectItem>
              {(classes || []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sectionId}
            onValueChange={(v) => setFilters({ section: v === "all" ? "" : v })}
            disabled={classId === "all" || !sections.length}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("All Sections", "सबै सेक्सन")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Sections", "सबै सेक्सन")}</SelectItem>
              {sections.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => setFilters({ status: v === "all" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("All Status", "सबै अवस्था")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Status", "सबै अवस्था")}</SelectItem>
              <SelectItem value="pending">{t("Pending", "बाँकी")}</SelectItem>
              <SelectItem value="partial">{t("Partially Paid", "आंशिक भुक्तानी")}</SelectItem>
              <SelectItem value="overdue">{t("Overdue", "ढिला")}</SelectItem>
              <SelectItem value="paid">{t("Paid", "भुक्तानी")}</SelectItem>
              <SelectItem value="waived">{t("Waived", "माफ)")}</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-[color:var(--w11-text-secondary)] hover:text-[color:var(--w11-text-primary)] flex items-center gap-1"
            >
              <X className="h-3 w-3" /> {t("Clear filters", "फिल्टर हटाउनुहोस्")}
            </button>
          )}
        </FilterCommandBar>

        <StatGrid className="mb-0" min={140}>
          {isLoading ? (
            <>
              <SkeletonStat />
              <SkeletonStat />
              <SkeletonStat />
              <SkeletonStat />
            </>
          ) : (
            <>
              <KpiCard
                label={t("Students", "विद्यार्थी")}
                value={isFetching ? "…" : summary.students}
                color="var(--w11-text-primary)"
              />
              <KpiCard
                label={t("Fee Bills", "शुल्क बीजक")}
                value={isFetching ? "…" : summary.feeRecords}
                color="var(--w11-text-primary)"
              />
              <KpiCard
                label={t("Open Bills", "खुला बीजक")}
                value={isFetching ? "…" : summary.pending}
                color="#d83b01"
              />
              <KpiCard
                label={t("Overdue", "ढिला")}
                value={isFetching ? "…" : summary.overdue}
                color="#c42b1c"
              />
              <KpiCard
                label={t("Total Collected", "कुल संकलन")}
                value={isFetching ? "…" : formatCurrency(summary.totalCollected)}
                color="#107c10"
              />
              <KpiCard
                label={t("Outstanding", "बाँकी")}
                value={isFetching ? "…" : formatCurrency(summary.totalDue)}
                color={summary.totalDue > 0 ? "#c42b1c" : "var(--w11-text-primary)"}
              />
            </>
          )}
        </StatGrid>

        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <DataPanel
            title={
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t("Student Accounts", "विद्यार्थी खाता")}
              </span>
            }
            bodyClassName="px-3 pb-3 pt-0"
          >
            <p className="text-xs text-[color:var(--w11-text-secondary)] pt-3 pb-2">
              {t(
                "Pick a student to keep pending dues, full history, and payment actions in one place.",
                "बाँकी रकम, पूरा इतिहास र भुक्तानी एकै ठाउँमा हेर्न विद्यार्थी छान्नुहोस्।"
              )}
            </p>
            {isError ? (
              <div className="flex flex-col items-center py-12 space-y-3">
                <p className="text-sm text-[#c42b1c]">
                  {t("Failed to load student ledgers.", "विद्यार्थी खाता लोड गर्न सकिएन।")}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  {t("Retry", "फेरि प्रयास")}
                </Button>
              </div>
            ) : isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-[92px] rounded-xl animate-pulse"
                    style={{ background: "var(--w11-control-hover)" }}
                  />
                ))}
              </div>
            ) : studentAccounts.length === 0 ? (
              <AOSEmptyState
                icon={<AlertCircle className="h-10 w-10" style={{ color: "var(--w11-text-tertiary)" }} />}
                title={t("No student accounts found", "कुनै विद्यार्थी खाता भेटिएन")}
                description={
                  hasFilters
                    ? t(
                        "Try changing your filters to bring a student ledger into view.",
                        "अर्को खाता देख्न फिल्टर बदलेर हेर्नुहोस्।"
                      )
                    : t(
                        "Student ledgers appear here once fee structures are applied or bills are created manually.",
                        "शुल्क संरचना लागू गरेपछि वा म्यानुअल बीजक बनाएपछि खाता यहाँ देखिन्छ।"
                      )
                }
                action={
                  !hasFilters ? (
                    <a href="/dashboard/students/new" className="win11-btn" style={{ textDecoration: "none" }}>
                      {t("Enroll a student first", "पहिले विद्यार्थी भर्ना गर्नुहोस्")}
                    </a>
                  ) : undefined
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
                        <Badge variant="outline">{account.fee_count} {t("bills", "बीजक")}</Badge>
                        {account.pending_count > 0 ? (
                          <span className="win11-chip warning">
                            {account.pending_count} {t("open", "खुला")}
                          </span>
                        ) : null}
                        {account.overdue_count > 0 ? (
                          <span className="win11-chip error">
                            {account.overdue_count} {t("overdue", "ढिला")}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-[color:var(--w11-text-secondary)]">{t("Outstanding", "बाँकी")}</span>
                        <span
                          className="font-semibold tabular-nums"
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [denomOpen, setDenomOpen] = useState(false);
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
        <p className="font-medium text-[color:var(--w11-text-primary)]">{t("Choose a student account", "विद्यार्थी खाता छान्नुहोस्")}</p>
        <p className="mt-1 max-w-md text-sm">
          {t("Start from the left panel to open one student ledger, review dues, and collect payment without switching pages.",
             "बायाँ प्यानलबाट सुरु गरी खाता खोल्नुहोस्, रकम हेर्नुहोस् र पृष्ठ फेर्नै पर्दैन।")}
        </p>
        <div className="mt-5 w-full max-w-md text-left space-y-2">
          <Label>{t("Find student for bill creation", "बीजक बनाउन विद्यार्थी खोज्नुहोस्")}</Label>
          <Input
            value={studentSearch}
            onChange={(event) => {
              setStudentSearch(event.target.value);
              setStudentMenuOpen(true);
            }}
            onFocus={() => setStudentMenuOpen(true)}
            placeholder={t("Search by name, ID, or admission number", "नाम, ID वा भर्ना नम्बरबाट खोज्नुहोस्")}
          />
          {studentMenuOpen && studentSearch.trim().length >= 2 ? (
            <div
              className="max-h-60 overflow-y-auto rounded-xl border border-[var(--w11-border-subtle)] shadow-sm"
              style={{ background: "var(--w11-card-bg)" }}
            >
              {(studentSearchResults || []).length === 0 ? (
                <div className="px-4 py-3 text-sm text-[color:var(--w11-text-secondary)]">
                  {t("No matching students found.", "मिल्ने विद्यार्थी भेटिएन।")}
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
      <div className="win11-card min-h-[420px] p-4 space-y-3">
        <SkeletonStat />
        <SkeletonList rows={5} />
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
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--w11-text-secondary)]" aria-hidden />
            ) : null}
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1"
              onClick={() => openBillDialog("create")}
            >
              <Plus className="h-3 w-3" />
              {t("New Bill", "नयाँ बीजक")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1"
              disabled={!selectedFee}
              onClick={() => openBillDialog("adjust")}
            >
              {t("Adjust Bill", "बीजक सम्पादन")}
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
              {t("Print Statement", "खाता विवरण छाप्न")}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[color:var(--w11-text-secondary)] -mt-2 mb-3">
          {formatStudentMeta(account)}
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: t("Outstanding", "बाँकी"), value: formatCurrency(totalDue), color: totalDue > 0 ? "#c42b1c" : "var(--w11-text-primary)" },
            { label: t("Collected", "अदा गरिएको"), value: formatCurrency(totalPaid), color: "#107c10" },
            { label: t("Open Bills", "खुला बीजक"), value: String(openBillCount), color: openBillCount > 0 ? "#d83b01" : "var(--w11-text-primary)" },
            { label: t("Receipts", "रसिद"), value: String(receiptCount), color: "var(--w11-text-primary)" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl px-4 py-3" style={{ background: "var(--w11-control-hover)" }}>
              <p className="text-lg font-semibold tabular-nums" style={{ color: item.color }}>{item.value}</p>
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
              {t("Account History", "खाता इतिहास")}
            </span>
          }
        >
          <p className="text-xs text-[color:var(--w11-text-secondary)] -mt-2 mb-3">
            {t("Every bill, receipt, and remaining balance for the selected student.",
               "चयन गरिएको विद्यार्थीको हरेक बीजक, रसिद र बाँकी रकम।")}
          </p>
          {fees.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--w11-border-default)] px-4 py-10 text-center text-[color:var(--w11-text-secondary)]">
              {t("No fee records for this student yet.", "यस विद्यार्थीको अहिलेसम्म शुल्क रेकर्ड छैन।")}
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1"
                  onClick={() => openBillDialog("create")}
                >
                  <Plus className="h-3 w-3" />
                  {t("Create first bill", "पहिलो बीजक बनाउनुहोस्")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {fees.map((fee) => {
                const isSelected = fee.id === selectedFeeId;
                const statusLabel: Record<FeeStatus, string> = {
                  paid: t("Paid", "भुक्तानी"),
                  partial: t("Partial", "आंशिक"),
                  pending: t("Pending", "बाँकी"),
                  overdue: t("Overdue", "ढिला"),
                  waived: t("Waived", "माफ"),
                };
                const lineTotal =
                  (fee.base_amount ?? fee.amount ?? 0) +
                  (fee.late_fine_amount ?? 0) -
                  (fee.discount_amount ?? 0);

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
                          <StatusChip
                            status={fee.payment_status}
                            label={statusLabel[fee.payment_status]}
                          />
                          {isSelected ? (
                            <Badge variant="outline">{t("Selected", "चयनित")}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--w11-text-secondary)]">
                          {fee.receipt_number
                            ? `Receipt #${fee.receipt_number}`
                            : t("No receipt generated yet", "अहिलेसम्म रसिद छैन")}
                          {fee.due_date
                            ? ` • ${t("Due", "मिति")} ${displayBS(fee.due_date)}`
                            : fee.created_at
                              ? ` • ${t("Added", "थपिएको")} ${displayBS(fee.created_at)}`
                              : ""}
                        </p>
                        {fee.late_fine_amount || fee.discount_amount ? (
                          <p className="mt-1 text-[11px] tabular-nums text-[color:var(--w11-text-secondary)]">
                            {t("Breakdown", "विभाजन")}: {formatCurrency(fee.base_amount ?? fee.amount ?? 0)}
                            {fee.late_fine_amount ? ` + ${t("fine", " जरिवाना ")} ${formatCurrency(fee.late_fine_amount)}` : ""}
                            {fee.discount_amount ? ` − ${t("waiver", "छुट")} ${formatCurrency(fee.discount_amount)}` : ""}
                            {lineTotal !== (fee.amount ?? 0) ? ` = ${formatCurrency(lineTotal)}` : ""}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-5 gap-2 text-xs xl:min-w-[380px]">
                        <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-control-hover)" }}>
                          <p className="text-[color:var(--w11-text-secondary)]">{t("Period", "अवधि")}</p>
                          <p className="font-semibold">{formatBSMonth(fee.month_bs, fee.year_bs)}</p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-control-hover)" }}>
                          <p className="text-[color:var(--w11-text-secondary)]">{t("Total", "कुल")}</p>
                          <p className="font-semibold">{formatCurrency(fee.amount || 0)}</p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: "rgba(16,124,16,.08)", color: "#107c10" }}>
                          <p style={{ opacity: 0.7 }}>{t("Paid", "भुक्तानी")}</p>
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
                          <p style={{ opacity: 0.7 }}>{t("Due", "बाँकी")}</p>
                          <p className="font-semibold">
                            {formatCurrency(fee.due_amount || 0)}
                          </p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-control-hover)" }}>
                          <p className="text-[color:var(--w11-text-secondary)]">{t("Due date", "भुक्तानी मिति")}</p>
                          <p className="font-semibold">{fee.due_date ? displayBS(fee.due_date) : "—"}</p>
                        </div>
                      </div>
                    </div>

                    {(fee.paid_amount || 0) > 0 && hasOutstandingBalance(fee) ? (
                      <div className="mt-2">
                        <div
                          className="w-full rounded-full h-1.5"
                          style={{ background: "var(--w11-control-hover)" }}
                          role="progressbar"
                          aria-valuenow={Math.round(((fee.paid_amount || 0) / (fee.amount || 1)) * 100)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(100, ((fee.paid_amount || 0) / (fee.amount || 1)) * 100)}%`,
                              background: "#d83b01",
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] tabular-nums text-[color:var(--w11-text-secondary)]">
                          {t("Partially paid", "आंशिक भुक्तानी")}: {formatCurrency(fee.paid_amount || 0)} / {formatCurrency(fee.amount || 0)}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {hasOutstandingBalance(fee) ? (
                        <span className="win11-chip warning">
                          {t("Ready to collect", "उठाउन तयार")}
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
                          {t("Receipt", "रसिद")}
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
              {t("Quick Collection", "द्रुत संकलन")}
            </span>
          }
        >
          <p className="text-xs text-[color:var(--w11-text-secondary)] -mt-2 mb-4">
            {t("Select an open bill from the ledger and collect it from this same screen.",
               "खाताबाट खुला बीजक छान्नुहोस् र यही स्क्रिनबाट भुक्तानी उठाउनुहोस्।")}
          </p>
          {!selectedFee ? (
            <div className="rounded-xl border border-dashed border-[var(--w11-border-default)] px-4 py-8 text-center text-sm text-[color:var(--w11-text-secondary)]">
              {t("Select a fee record to start collecting payment.", "भुक्तानी सुरु गर्न बीजक छान्नुहोस्।")}
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
                        ? `Receipt #${selectedFee.receipt_number}`
                        : t("No receipt issued yet", "रसिद जारी भएको छैन")}
                    </p>
                  </div>
                  <StatusChip
                    status={selectedFee.payment_status}
                    label={
                      ({
                        paid: t("Paid", "भुक्तानी"),
                        partial: t("Partial", "आंशिक"),
                        pending: t("Pending", "बाँकी"),
                        overdue: t("Overdue", "ढिला"),
                        waived: t("Waived", "माफ"),
                      } as Record<FeeStatus, string>)[selectedFee.payment_status]
                    }
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-card-bg)" }}>
                    <p className="text-[color:var(--w11-text-secondary)]">{t("Period", "अवधि")}</p>
                    <p className="font-semibold">{formatBSMonth(selectedFee.month_bs, selectedFee.year_bs)}</p>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-card-bg)" }}>
                    <p className="text-[color:var(--w11-text-secondary)]">{t("Total", "कुल")}</p>
                    <p className="font-semibold">
                      {formatCurrency(selectedFee.amount || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: "var(--w11-card-bg)", color: "#107c10" }}>
                    <p style={{ opacity: 0.7 }}>{t("Paid", "भुक्तानी")}</p>
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
                    <p style={{ opacity: 0.7 }}>{t("Due", "बाँकी")}</p>
                    <p className="font-semibold">
                      {formatCurrency(selectedFee.due_amount || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {hasOutstandingBalance(selectedFee) ? (
                <>
                  {enabledPaymentMethods.length === 0 ? (
                    <div className="win11-infobar warning rounded-xl mb-4 text-sm">
                      {t("No payment methods are configured for this school. Enable them in Settings → Integrations before collecting payment.",
                         "यस विद्यालयका लागि कुनै भुक्तानी माध्यम सेट गरिएको छैन। भुक्तानी अघि Settings → Integrations बाट सक्रिय गर्नुहोस्।")}
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      <Label>{t("Payment Method", "भुक्तानी माध्यम")}</Label>
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
                      {t(
                        `The payer will be redirected to ${selectedMethod?.label || "the gateway"} to complete ${formatCurrency(selectedFee.due_amount || 0)}.`,
                        `भुक्तानकर्ता ${selectedMethod?.label || "गेटवे"} मा ${formatCurrency(selectedFee.due_amount || 0)} पूरा गर्न निर्देशित हुनेछ।`
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5 mb-4">
                        <Label>
                          {t("Amount (NPR)", "रकम (रु.)")}
                          <span className="ml-1 text-xs font-normal text-[color:var(--w11-text-secondary)]">
                            {t("max", "बढीमा")} {formatCurrency(selectedFee.due_amount || 0)}
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
                            {t("Partial payment leaves", "आंशिक भुक्तानीबाट")} {formatCurrency((selectedFee.due_amount || 0) - Number.parseFloat(amount))} {t("still outstanding.", "बाँकी रहनेछ।")}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-1.5 mb-4">
                        <Label>{t("Payment Date", "भुक्तानी मिति")}</Label>
                        <BSDateInput
                          value={payDate}
                          onChange={setPayDate}
                        />
                      </div>

                      {selectedMethod?.requires_reference ? (
                        <div className="space-y-1.5 mb-4">
                          <Label>
                            {t("Transaction ID / Reference", "कारोबार ID / सन्दर्भ")}
                            <span className="ml-1 text-xs font-normal text-[color:var(--w11-text-secondary)]">
                              {t("optional", "वैकल्पिक")}
                            </span>
                          </Label>
                          <Input
                            value={reference}
                            onChange={(event) => setReference(event.target.value)}
                            placeholder={t("Bank ref, cheque no., QR settlement ID", "बैंक सन्दर्भ, चेक नं., QR सेटलमेन्ट ID")}
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
                          <p className="font-medium">{selectedMethod.label} {t("QR Payment", "QR भुक्तानी")}</p>
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

                  {method === "cash" ? (
                    <div className="mb-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full gap-1.5"
                        onClick={() => setDenomOpen(true)}
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        {t("Count cash denominations", "नगद दरपत्र गन्नुहोस्")}
                      </Button>
                    </div>
                  ) : null}

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
                      ? `${t("Pay via", "बाट")} ${selectedMethod?.label || "Gateway"}`
                      : t("Record Payment & Print Receipt", "भुक्तानी रेकर्ड गरी रसिद छाप")}
                  </Button>
                </>
              ) : (
                <div
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={{ background: "rgba(16,124,16,.08)", borderColor: "rgba(16,124,16,.3)", color: "#107c10" }}
                >
                  {t("This bill is fully settled. Select another bill to collect more.",
                     "यो बीजक पूर्ण भुक्तानी भएको छ। अर्को बीजक छान्नुहोस्।")}
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
                  {t("Download Latest Receipt", "पछिल्लो रसिद डाउनलोड")}
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
                  ? `${t("New Bill", "नयाँ बीजक")} — ${account.student_name}`
                  : `${t("Adjust Bill", "बीजक सम्पादन")} — ${selectedFee?.fee_type || ""}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("Fee name", "शुल्कको नाम")}</Label>
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
                  <Label>{t("Amount (NPR)", "रकम (रु.)")}</Label>
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
                  <Label>{t("Discount", "छुट")}</Label>
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
                  <Label>{t("Late fine", "ढिलाई जरिवाना")}</Label>
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
                  <Label>{t("Academic year", "शैक्षिक वर्ष")}</Label>
                  <Input
                    value={billForm.academicYear}
                    onChange={(e) =>
                      setBillForm({ ...billForm, academicYear: e.target.value })
                    }
                    placeholder="2083"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("BS month", "बि.सं. महिना")}</Label>
                  <BSMonthInput
                    value={billForm.monthBs}
                    onChange={(v) => setBillForm({ ...billForm, monthBs: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("BS year", "बि.सं. वर्ष")}</Label>
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
                {t("Billing cycle", "बिल चक्र")}: {formatBSMonth(billForm.monthBs, billForm.yearBs)}
              </p>
              <div className="flex items-center gap-2">
                <Switch
                  checked={billForm.isScholarship}
                  onCheckedChange={(checked) =>
                    setBillForm({ ...billForm, isScholarship: checked })
                  }
                />
                <Label>{t("Scholarship-funded bill", "छात्रवृत्ति-वित्तपोषित बीजक")}</Label>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Notes", "टिप्पणी")}</Label>
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
                {billDialogMode === "create"
                  ? t("Create Bill", "बीजक बनाउनुहोस्")
                  : t("Save Adjustments", "सम्पादन सुरक्षित")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DenominationDialog
          open={denomOpen}
          onOpenChange={setDenomOpen}
          targetAmount={selectedFee?.due_amount || 0}
          onApply={(total) => setAmount(String(total))}
        />
      </div>
    </div>
  );
}

/**
 * DenominationDialog — InstiKit's counter-control pattern (plan 16.3 "add
 * denominations matrix"): count the drawer by note, see the total, apply it
 * to the payment field. Counts are local to the dialog; only the total ever
 * reaches the payment payload.
 */
const NPR_DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];

function DenominationDialog({
  open,
  onOpenChange,
  targetAmount,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetAmount: number;
  onApply: (total: number) => void;
}) {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Record<number, string>>({});
  const total = NPR_DENOMINATIONS.reduce(
    (sum, d) => sum + d * (Number.parseInt(counts[d] || "0", 10) || 0),
    0,
  );
  const change = total - targetAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("Cash denominations", "नगद दरपत्र")}{" "}
            <span className="text-xs font-normal text-[color:var(--w11-text-secondary)]">
              {t("— count the drawer, apply the total", "— गनेर रकम भर्नुहोस्")}
            </span>
          </DialogTitle>
        </DialogHeader>
        <table className="win11-datagrid w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">{t("Note", "नोट")}</th>
              <th className="text-right">{t("Count", "संख्या")}</th>
              <th className="text-right">{t("Subtotal", "जम्मा")}</th>
            </tr>
          </thead>
          <tbody>
            {NPR_DENOMINATIONS.map((d) => {
              const n = Number.parseInt(counts[d] || "0", 10) || 0;
              return (
                <tr key={d}>
                  <td className="tabular-nums">Rs. {d}</td>
                  <td className="text-right">
                    <Input
                      type="number"
                      min={0}
                      className="h-7 w-20 text-right tabular-nums"
                      value={counts[d] || ""}
                      onChange={(e) =>
                        setCounts({ ...counts, [d]: e.target.value })
                      }
                      aria-label={`${t("Number of", "संख्या")} Rs. ${d}`}
                    />
                  </td>
                  <td className="text-right tabular-nums font-medium">
                    {n ? formatCurrency(n * d) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div
          className="rounded-xl px-4 py-3 text-sm space-y-1"
          style={{ background: "var(--w11-control-hover)" }}
        >
          <div className="flex justify-between">
            <span>{t("Counted total", "गरी कुल")}</span>
            <span className="font-bold tabular-nums">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("Amount due", "बाँकी रकम")}</span>
            <span className="tabular-nums">{formatCurrency(targetAmount)}</span>
          </div>
          {change !== 0 && total > 0 ? (
            <div className="flex justify-between" style={{ color: change > 0 ? "#107c10" : "#d83b01" }}>
              <span>{change > 0 ? t("Change due back", "फिर्ता रकम") : t("Still short", "अझै बाँकी")}</span>
              <span className="font-semibold tabular-nums">{formatCurrency(Math.abs(change))}</span>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={total <= 0}
            onClick={() => {
              onApply(total);
              onOpenChange(false);
            }}
          >
            {t("Use as payment amount", "भुक्तानी रकमको रूपमा प्रयोग")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
