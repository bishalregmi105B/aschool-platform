import {
  buildFeeReportsViewData,
  getFeeReportRange,
} from "@/lib/services/dashboard/fees.service";

describe("getFeeReportRange", () => {
  it("returns the current month range for monthly reports", () => {
    const range = getFeeReportRange("monthly", new Date("2026-04-25T08:00:00"));

    expect(range).toEqual({
      start_date: "2026-04-01",
      end_date: "2026-04-25",
    });
  });

  it("returns the current quarter range for quarterly reports", () => {
    const range = getFeeReportRange("quarterly", new Date("2026-05-10T10:15:00"));

    expect(range).toEqual({
      start_date: "2026-04-01",
      end_date: "2026-05-10",
    });
  });

  it("returns the current year range for yearly reports", () => {
    const range = getFeeReportRange("yearly", new Date("2026-11-03T14:45:00"));

    expect(range).toEqual({
      start_date: "2026-01-01",
      end_date: "2026-11-03",
    });
  });
});

describe("buildFeeReportsViewData", () => {
  it("keeps overall fee summary data even when period analytics are unavailable", () => {
    const data = buildFeeReportsViewData(
      {
        total_expected: 100000,
        total_collected: 65000,
        total_outstanding: 35000,
        collection_rate: 65,
        student_count: 120,
        by_class: [
          {
            class_name: "Grade 10",
            collected: 30000,
            expected: 40000,
            rate: 75,
          },
        ],
        recent_payments: [
          {
            id: "r1",
            student_name: "A Student",
            fee_type: "Tuition Fee",
            amount: 5000,
            paid_at: "2026-04-20T10:00:00",
            receipt_number: "R-001",
          },
        ],
      },
      null,
      "monthly",
      new Date("2026-04-25T08:00:00"),
    );

    expect(data.overview).toEqual({
      totalExpected: 100000,
      totalCollected: 65000,
      totalOutstanding: 35000,
      collectionRate: 65,
    });
    expect(data.period).toEqual({
      start: "2026-04-01",
      end: "2026-04-25",
    });
    expect(data.selectedPeriodCollected).toBeNull();
    expect(data.hasPeriodAnalytics).toBe(false);
    expect(data.byClass).toHaveLength(1);
    expect(data.recentPayments).toHaveLength(1);
  });
});