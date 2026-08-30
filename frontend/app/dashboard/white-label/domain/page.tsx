"use client";

import { useEffect, useState } from "react";
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
import { Globe, CheckCircle, AlertCircle, ExternalLink, XCircle, Clock } from "lucide-react";

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  pending: { label: "Pending Verification", variant: "secondary" },
  failed: { label: "Verification Failed", variant: "destructive" },
  not_configured: { label: "Not Configured", variant: "outline" },
};

export default function CustomDomainPage() {
  return <PluginGate slug="white_label"><DomainContent /></PluginGate>;
}

interface VerifyResult {
  verdict?: string;
  status?: string;
  message?: string;
  records?: { cname: string[]; a: string[] };
  expected_cname?: string;
}

function DomainContent() {
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");
  const [lastVerify, setLastVerify] = useState<VerifyResult | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["white-label-domain"],
    queryFn: async () => { const r = await api.get("/schools/white-label/domain"); return r.data?.data ?? r.data; },
    retry: 1,
  });

  useEffect(() => {
    if (data?.custom_domain) setDomain(data.custom_domain);
  }, [data?.custom_domain]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/schools/white-label/domain", { domain })).data,
    onSuccess: () => {
      setLastVerify(null);
      qc.invalidateQueries({ queryKey: ["white-label-domain"] });
      toast.success("Domain saved — add the DNS records below, then verify");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Failed to save domain"),
  });

  const verify = useMutation({
    mutationFn: async () => (await api.post("/schools/white-label/domain/verify")).data,
    onSuccess: (res: any) => {
      const result: VerifyResult = res?.data ?? res ?? {};
      setLastVerify(result);
      qc.invalidateQueries({ queryKey: ["white-label-domain"] });
      if (result.verdict === "verified") toast.success("Domain verified");
      else if (result.verdict === "pending") toast.info(result.message || "DNS not propagated yet");
      else toast.error(result.message || "DNS verification failed");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Verification failed"),
  });

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load domain configuration. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const status = data?.status ?? "not_configured";
  const statusMeta = STATUS_META[status] ?? STATUS_META.not_configured;
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
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
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
          {status === "pending" && data?.custom_domain && (
            <div className="flex items-center gap-2 text-yellow-700 p-3 bg-yellow-50 rounded-lg">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Saved but not verified yet — create the DNS record below, then run verification.</span>
            </div>
          )}
          {status === "failed" && data?.custom_domain && (
            <div className="flex items-center gap-2 text-red-700 p-3 bg-red-50 rounded-lg">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">Last verification failed — the domain does not point to this platform yet.</span>
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
            {lastVerify && (
              <div className={`mt-4 p-3 rounded-lg text-sm space-y-1 ${lastVerify.verdict === "verified" ? "bg-green-50 text-green-800" : lastVerify.verdict === "failed" ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800"}`}>
                <div className="flex items-center gap-2 font-medium">
                  {lastVerify.verdict === "verified" ? <CheckCircle className="h-4 w-4" /> : lastVerify.verdict === "failed" ? <XCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  {lastVerify.verdict === "verified" ? "Verified" : lastVerify.verdict === "failed" ? "Failed" : "Pending"}
                </div>
                <p>{lastVerify.message}</p>
                {lastVerify.records && (
                  <p className="font-mono text-xs">
                    Found: CNAME [{(lastVerify.records.cname ?? []).join(", ") || "none"}] · A [{(lastVerify.records.a ?? []).join(", ") || "none"}]
                    {lastVerify.expected_cname ? ` · Expected CNAME: ${lastVerify.expected_cname}` : ""}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="pt-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium">DNS propagation can take up to 48 hours.</p>
            <p className="text-muted-foreground">Verification performs a live DNS lookup of your domain. SSL certificate will be auto-provisioned once DNS is verified.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
