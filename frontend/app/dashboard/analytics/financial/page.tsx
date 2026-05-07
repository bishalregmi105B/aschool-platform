"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { ArrowLeft, Download, DollarSign, TrendingUp, TrendingDown, PieChart } from "lucide-react";
import Link from "next/link";

export default function FinancialAnalyticsPage() {
  const [period, setPeriod] = useState("yearly");

  const { data, isLoading } = useQuery({
    queryKey: ["financial-analytics", period],
    queryFn: async () => { const r = await api.get("/analytics/financial", { params: { period } }); return r.data?.data; },
  });

  if (isLoading) return <PageLoader />;

  const analytics = data || {};
  const monthly = analytics.monthly_trend || [];
  const byType = analytics.by_fee_type || [];
  const byClass = analytics.by_class || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/analytics"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1"><h1 className="text-2xl font-bold">Financial Analytics</h1><p className="text-muted-foreground">Revenue, collections, and financial trends</p></div>
        <select className="border rounded-md px-3 py-2" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="monthly">This Month</option><option value="quarterly">This Quarter</option><option value="yearly">This Year</option>
        </select>
        <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Export</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><DollarSign className="h-5 w-5 text-green-600 mb-2" /><p className="text-2xl font-bold">Rs. {(analytics.total_revenue || 0).toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Revenue</p></CardContent></Card>
        <Card><CardContent className="pt-6"><TrendingUp className="h-5 w-5 text-blue-600 mb-2" /><p className="text-2xl font-bold">Rs. {(analytics.collected || 0).toLocaleString()}</p><p className="text-sm text-muted-foreground">Collected</p></CardContent></Card>
        <Card><CardContent className="pt-6"><TrendingDown className="h-5 w-5 text-red-600 mb-2" /><p className="text-2xl font-bold text-red-600">Rs. {(analytics.outstanding || 0).toLocaleString()}</p><p className="text-sm text-muted-foreground">Outstanding</p></CardContent></Card>
        <Card><CardContent className="pt-6"><PieChart className="h-5 w-5 text-purple-600 mb-2" /><p className="text-2xl font-bold">{analytics.collection_rate || 0}%</p><p className="text-sm text-muted-foreground">Collection Rate</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Monthly Collection Trend</CardTitle></CardHeader>
          <CardContent>
            {monthly.length > 0 ? (
              <div className="space-y-2">
                {monthly.map((m: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span>{m.month}</span><span>Rs. {(m.collected || 0).toLocaleString()}</span></div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div className="bg-green-600 h-4 rounded-full text-xs text-white flex items-center justify-center" style={{ width: `${Math.min(100, ((m.collected || 0) / (m.expected || 1)) * 100)}%` }}>
                        {Math.round(((m.collected || 0) / (m.expected || 1)) * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">No monthly data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Revenue by Fee Type</CardTitle></CardHeader>
          <CardContent>
            {byType.length > 0 ? (
              <div className="space-y-4">
                {byType.map((t: any, i: number) => {
                  const colors = ["bg-blue-600", "bg-green-600", "bg-purple-600", "bg-yellow-600", "bg-red-600", "bg-indigo-600"];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${colors[i % colors.length]}`} />
                      <span className="text-sm flex-1">{t.type || t.name}</span>
                      <span className="text-sm font-medium">Rs. {(t.amount || 0).toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">{t.percentage || 0}%</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">No fee type data</p>}
          </CardContent>
        </Card>
      </div>

      {byClass.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Collection by Class</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {byClass.map((c: any, i: number) => (
                <div key={i} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">{c.class_name}</h4>
                  <div className="flex justify-between text-sm mb-1"><span>Expected</span><span>Rs. {(c.expected || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm mb-1"><span>Collected</span><span className="text-green-600">Rs. {(c.collected || 0).toLocaleString()}</span></div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2"><div className="bg-green-600 h-2 rounded-full" style={{ width: `${Math.min(100, ((c.collected || 0) / (c.expected || 1)) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
