"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { Globe, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

export default function CustomDomainPage() {
  return <PluginGate slug="white_label"><DomainContent /></PluginGate>;
}

function DomainContent() {
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["white-label-domain"],
    queryFn: async () => { const r = await api.get("/schools/white-label/domain"); return r.data?.data ?? r.data; },
    onSuccess: (d: any) => { if (d?.custom_domain) setDomain(d.custom_domain); },
  } as any);

  const save = useMutation({
    mutationFn: async () => (await api.post("/schools/white-label/domain", { domain })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["white-label-domain"] }); toast.success("Domain saved"); },
    onError: () => toast.error("Failed to save domain"),
  });

  const verify = useMutation({
    mutationFn: async () => (await api.post("/schools/white-label/domain/verify")).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["white-label-domain"] }); toast.success("Verification initiated"); },
    onError: () => toast.error("Verification failed"),
  });

  if (isLoading) return <PageLoader />;

  const status = data?.status ?? "not_configured";
  const dnsRecords: any[] = data?.dns_records ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="h-6 w-6 text-blue-600" />
        <div><h1 className="text-2xl font-bold">Custom Domain</h1><p className="text-muted-foreground">Point your own domain to this platform</p></div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Domain Configuration</CardTitle>
          <Badge variant={status === "active" ? "default" : status === "pending" ? "secondary" : "outline"}>
            {status === "active" ? "Active" : status === "pending" ? "Pending Verification" : "Not Configured"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your Custom Domain</Label>
            <div className="flex gap-2">
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. school.yourschool.edu.np" />
              <Button onClick={() => save.mutate()} disabled={save.isPending || !domain}>{save.isPending ? <Spinner /> : "Save"}</Button>
            </div>
          </div>
          {status === "active" && data?.custom_domain && (
            <div className="flex items-center gap-2 text-green-700 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Domain <strong>{data.custom_domain}</strong> is active</span>
              <a href={`https://${data.custom_domain}`} target="_blank" rel="noopener noreferrer" className="ml-auto"><ExternalLink className="h-4 w-4" /></a>
            </div>
          )}
        </CardContent>
      </Card>

      {dnsRecords.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>DNS Records</CardTitle>
            <Button variant="outline" onClick={() => verify.mutate()} disabled={verify.isPending}>{verify.isPending ? <Spinner /> : "Verify DNS"}</Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Add these DNS records to your domain registrar:</p>
            <div className="space-y-3">
              {dnsRecords.map((rec: any, idx: number) => (
                <div key={idx} className="grid grid-cols-3 gap-4 p-3 border rounded-lg font-mono text-sm">
                  <div><span className="text-xs text-muted-foreground block">Type</span>{rec.type}</div>
                  <div><span className="text-xs text-muted-foreground block">Name/Host</span>{rec.name}</div>
                  <div><span className="text-xs text-muted-foreground block">Value</span><span className="break-all">{rec.value}</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="pt-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium">DNS propagation can take up to 48 hours.</p>
            <p className="text-muted-foreground">SSL certificate will be auto-provisioned once DNS is verified.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
