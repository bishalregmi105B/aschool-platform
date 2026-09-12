"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { api, type ApiResponse } from "@/lib/api";
import { PortalHeader, SummaryTile } from "@/components/portal/portal-header";
import { AOSModuleLoadingState } from "@/components/aos/kit/page-kit";

type ChildHealthPayload = {
  student_name?: string;
  blood_group?: string;
  allergies?: string[];
  medical_conditions?: string[];
  emergency_contact?: string;
  emergency_phone?: string;
  doctor_name?: string;
  doctor_phone?: string;
  visits?: { id: string; visit_date?: string; reason?: string; notes?: string }[];
  immunizations?: { id: string; vaccine_name?: string; date_administered?: string }[];
};

/** Parent → Health. Backed by GET /parent/child-health. */
export default function ParentHealthPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["parent-child-health"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ChildHealthPayload>>("/parent/child-health");
      return res.data.data;
    },
  });

  if (isLoading) return <AOSModuleLoadingState label="Loading…" />;
  if (isError)
    return <ErrorState title="Couldn't load health records" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PortalHeader portal="parent" title="Health Records" />
      <Card>
        <CardHeader><CardTitle>Health Profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Info label="Blood group" value={data?.blood_group} />
          <Info label="Emergency contact" value={data?.emergency_contact} />
          <Info label="Emergency phone" value={data?.emergency_phone} />
          <Info label="Doctor" value={data?.doctor_name} />
          <Info label="Doctor phone" value={data?.doctor_phone} />
          <Info
            label="Allergies"
            value={(data?.allergies || []).join(", ") || "None recorded"}
          />
          <Info
            label="Medical conditions"
            value={(data?.medical_conditions || []).join(", ") || "None recorded"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Medical Visits</CardTitle></CardHeader>
        <CardContent>
          {(data?.visits || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No medical visits recorded.</p>
          ) : (
            <div className="space-y-2">
              {(data?.visits || []).map((v) => (
                <div key={v.id} className="border-b py-2 last:border-0">
                  <p className="text-sm font-medium">
                    {v.visit_date || "—"} — {v.reason || "Visit"}
                  </p>
                  {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Immunizations</CardTitle></CardHeader>
        <CardContent>
          {(data?.immunizations || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No immunization records.</p>
          ) : (
            <div className="space-y-2">
              {(data?.immunizations || []).map((im) => (
                <div key={im.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <p className="text-sm font-medium">{im.vaccine_name || "Vaccine"}</p>
                  <span className="text-xs text-muted-foreground">{im.date_administered || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
