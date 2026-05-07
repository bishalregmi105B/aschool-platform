import { api } from "@/lib/api";

export type FeeReportPeriod = "monthly" | "quarterly" | "yearly";

interface FeeClassSummary {
  class_name: string;
  collected: number;
  expected: number;
  rate: number;
}

interface FeeRecentPayment {
  id: string;
  student_name: string;
  fee_type: string;
  amount: number;
  paid_at: string;
  receipt_number: string;
}

interface FeeSummaryResponse {
  total_expected: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate: number;
  student_count: number;
  by_class: FeeClassSummary[];
  recent_payments: FeeRecentPayment[];
}

interface FeeCollectionReportResponse {
  period?: {
    start?: string;
    end?: string;
  };
  total_collected?: number;
  payments_count?: number;
}

export interface FeeReportsViewData {
  overview: {
    totalExpected: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
  };
  period: {
    start: string;
    end: string;
  };
  selectedPeriodCollected: number | null;
  selectedPeriodPaymentsCount: number | null;
  totalStudents: number;
  byClass: FeeClassSummary[];
  recentPayments: FeeRecentPayment[];
  hasPeriodAnalytics: boolean;
}

function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getFeeReportRange(
  period: FeeReportPeriod,
  now: Date = new Date(),
) {
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate = new Date(endDate);

  if (period === "yearly") {
    startDate = new Date(endDate.getFullYear(), 0, 1);
  } else if (period === "quarterly") {
    const quarterStartMonth = Math.floor(endDate.getMonth() / 3) * 3;
    startDate = new Date(endDate.getFullYear(), quarterStartMonth, 1);
  } else {
    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  }

  return {
    start_date: formatDateParam(startDate),
    end_date: formatDateParam(endDate),
  };
}

export function buildFeeReportsViewData(
  summary: Partial<FeeSummaryResponse> | null | undefined,
  report: Partial<FeeCollectionReportResponse> | null | undefined,
  period: FeeReportPeriod,
  now: Date = new Date(),
): FeeReportsViewData {
  const fallbackRange = getFeeReportRange(period, now);
  const reportPeriod = report?.period;

  return {
    overview: {
      totalExpected: Number(summary?.total_expected ?? 0),
      totalCollected: Number(summary?.total_collected ?? 0),
      totalOutstanding: Number(summary?.total_outstanding ?? 0),
      collectionRate: Number(summary?.collection_rate ?? 0),
    },
    period: {
      start: reportPeriod?.start || fallbackRange.start_date,
      end: reportPeriod?.end || fallbackRange.end_date,
    },
    selectedPeriodCollected: report
      ? Number(report.total_collected ?? 0)
      : null,
    selectedPeriodPaymentsCount: report
      ? Number(report.payments_count ?? 0)
      : null,
    totalStudents: Number(summary?.student_count ?? 0),
    byClass: Array.isArray(summary?.by_class) ? summary.by_class : [],
    recentPayments: Array.isArray(summary?.recent_payments)
      ? summary.recent_payments
      : [],
    hasPeriodAnalytics: Boolean(report),
  };
}

export async function fetchFeeReports(period: FeeReportPeriod) {
  const range = getFeeReportRange(period);
  const [summaryResult, reportResult] = await Promise.allSettled([
    api.get("/fees/summary"),
    api.get("/reports/fees/collection", { params: range }),
  ]);

  if (summaryResult.status !== "fulfilled") {
    throw summaryResult.reason;
  }

  const summary = (summaryResult.value.data?.data ?? {}) as Partial<FeeSummaryResponse>;
  const report =
    reportResult.status === "fulfilled"
      ? ((reportResult.value.data?.data ?? {}) as Partial<FeeCollectionReportResponse>)
      : null;

  return buildFeeReportsViewData(summary, report, period);
}

export async function fetchFeeCollections(params?: Record<string, string>) {
  const res = await api.get("/fees/collections", { params });
  return res.data;
}

export async function recordCollectionPayment(
  collectionId: string,
  payload: { amount: number; payment_method: string }
) {
  const res = await api.post(`/fees/collections/${collectionId}/pay`, payload);
  return res.data;
}
