"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Building2, DollarSign, Users, Server, AlertTriangle, Activity } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";

export default function SuperAdminDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    retry: 1,
    queryKey: ["superadmin-dashboard"],
    queryFn: async () => {
      const res = await api.get("/analytics/superadmin-dashboard");
      return res.data?.data;
    },
  });

  if (isLoading) return <PageLoader />;
    if (isError) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive">Failed to load platform analytics. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent></Card>
        </div>
      );
    }

  const stats = [
    { label: "Total Schools", value: String(data?.stats?.total_schools || 0), icon: Building2, color: "text-blue-400" },
    { label: "Revenue YTD", value: `Rs. ${(data?.stats?.total_revenue_ytd || 0).toLocaleString()}`, icon: DollarSign, color: "text-green-400" },
    { label: "Total Users", value: String(data?.stats?.total_users || 0), icon: Users, color: "text-violet-400" },
    { label: "Active Schools", value: String(data?.stats?.active_schools || 0), icon: Server, color: "text-emerald-400" },
    { label: "Trial Schools", value: String(data?.stats?.trial_schools || 0), icon: AlertTriangle, color: "text-yellow-400" },
    { label: "Students", value: String(data?.stats?.total_students || 0), icon: Activity, color: "text-cyan-400" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="bg-gray-900 border-gray-800">
            <CardContent className="pt-6 text-center">
              <s.icon className={`h-6 w-6 mx-auto mb-2 ${s.color}`} />
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-white text-sm">Recent School Registrations</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data?.recent_schools || []).map((school: any, i: number) => (
                <div key={i} className="flex justify-between py-2 border-b border-gray-800 text-sm">
                  <span className="text-gray-300">{school.name}</span>
                  <span className="text-gray-500">{school.created_at ? displayBS(school.created_at) : "—"}</span>
                </div>
              ))}
              {(data?.recent_schools || []).length === 0 && <p className="text-sm text-gray-500">No recent registrations.</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader><CardTitle className="text-white text-sm">Most Installed Plugins</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data?.top_plugins || []).map((plugin: any, i: number) => (
                <div key={i} className="flex justify-between py-2 border-b border-gray-800 text-sm">
                  <span className="text-gray-300">{plugin.name}</span>
                  <span className="text-green-400">{plugin.installs} installs</span>
                </div>
              ))}
              {(data?.top_plugins || []).length === 0 && <p className="text-sm text-gray-500">No plugin usage yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
