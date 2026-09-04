"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";

type FeeDue = {
  id: string;
  fee_type?: string;
  month?: string;
  amount?: number;
  status?: string;
  student_name?: string;
};

type OutstandingPayload = FeeDue[] | { invoices?: FeeDue[] };

/** Parent → Fees. Backed by GET /parent/outstanding-fees (web payment lands with Phase E). */
export default function ParentFeesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent-outstanding-fees"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OutstandingPayload>>("/parent/outstanding-fees");
      const payload = res.data.data;
      return Array.isArray(payload) ? payload : payload?.invoices || [];
    },
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorState title="Couldn't load fees" onRetry={() => refetch()} />;

  const invoices = data || [];
  const totalDue = invoices
    .filter((i) => (i.status || "").toLowerCase() !== "paid")
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PortalHeader portal="parent" title="Fees" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryTile label="Outstanding" value={`Rs. ${totalDue.toLocaleString()}`} />
        <SummaryTile label="Open Invoices" value={invoices.length} />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Invoices</CardTitle>
          <Button size="sm" disabled title="Online payment is coming to the web portal — use the ASchool parent app today.">
            Pay Online
          </Button>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing outstanding — all settled.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((i) => (
                <div key={i.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{i.fee_type || "Fee"}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.month || "—"}
                      {i.student_name ? ` • ${i.student_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Rs. {(i.amount || 0).toLocaleString()}</span>
                    <Badge
                      variant={
                        (i.status || "").toLowerCase() === "paid"
                          ? "success"
                          : (i.status || "").toLowerCase() === "partial"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {i.status || "due"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
