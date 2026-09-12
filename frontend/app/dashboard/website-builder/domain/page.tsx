"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { schoolSiteHost } from "@/lib/site-domain";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
  StatusChip,
  AOSModuleLoadingState,
} from "@/components/aos/kit/page-kit";

interface DomainSettings {
  subdomain: string;
  custom_domain: string | null;
  domain_verified: boolean;
  dns_records: { type: string; name: string; value: string }[];
}

export default function DomainPage() {
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");

  const { data: settings, isLoading, isError, refetch } = useQuery<DomainSettings>({
    queryKey: ["website-domain"],
    queryFn: () => api.get("/website-builder/domain").then((r) => r.data.data),
    retry: 1,
  });

  const updateMut = useMutation({
    mutationFn: (custom_domain: string) =>
      api.put("/website-builder/domain", { custom_domain }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-domain"] });
    },
  });

  const verifyMut = useMutation({
    mutationFn: () => api.post("/website-builder/domain/verify"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-domain"] }),
  });

  if (isLoading) {
    return <AOSModuleLoadingState label="Loading domain settings…" />;
  }

  if (isError) {
    return (
      <AOSPage>
        <AOSPageHeader title="🌐 Custom Domain" subtitle="Connect your own domain to your school website" />
        <AOSPageBody>
          <DataPanel className="max-w-2xl mx-auto">
            <div className="py-10 text-center space-y-3">
              <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                Failed to load domain settings. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          </DataPanel>
        </AOSPageBody>
      </AOSPage>
    );
  }

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Globe className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="🌐 Custom Domain"
        subtitle="Connect your own domain to your school website"
      />
      <AOSPageBody>
        <div className="space-y-4 max-w-2xl">
          {/* Default subdomain */}
          <DataPanel title="Default Subdomain">
            <div
              className="flex items-center gap-2 rounded p-3"
              style={{ background: "var(--w11-control-hover)" }}
            >
              <span
                className="text-sm"
                style={{ fontFamily: "var(--w11-font-mono)", color: "var(--w11-text-primary)" }}
              >
                {schoolSiteHost(settings?.subdomain || "your-school")}
              </span>
              <StatusChip status="active" label="Always Active" />
            </div>
          </DataPanel>

          {/* Custom domain */}
          <DataPanel title="Custom Domain">
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "var(--w11-text-secondary)" }}>
                Point your own domain (e.g. www.yourschool.edu.np) to your ASchool website.
                This is a premium feature.
              </p>

              {settings?.custom_domain ? (
                <div>
                  <div
                    className="flex items-center gap-2 rounded p-3 mb-3"
                    style={{ background: "var(--w11-control-hover)" }}
                  >
                    <span
                      className="text-sm"
                      style={{ fontFamily: "var(--w11-font-mono)", color: "var(--w11-text-primary)" }}
                    >
                      {settings.custom_domain}
                    </span>
                    <StatusChip
                      status={settings.domain_verified ? "active" : "pending"}
                      label={settings.domain_verified ? "✓ Verified" : "⏳ Pending"}
                    />
                  </div>

                  {!settings.domain_verified && (
                    <>
                      <div
                        className="border rounded p-4 mb-3"
                        style={{
                          background: "var(--w11-accent-light)",
                          borderColor: "var(--w11-border-default)",
                        }}
                      >
                        <h4
                          className="font-medium text-sm mb-2"
                          style={{ color: "var(--w11-text-primary)" }}
                        >
                          Add these DNS records:
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr
                                className="text-left"
                                style={{ color: "var(--w11-text-secondary)" }}
                              >
                                <th className="pb-1">Type</th>
                                <th className="pb-1">Name</th>
                                <th className="pb-1">Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(settings.dns_records || []).map((r, i) => (
                                <tr
                                  key={i}
                                  className="border-t border-[var(--w11-border-subtle)]"
                                >
                                  <td className="py-1" style={{ fontFamily: "var(--w11-font-mono)" }}>{r.type}</td>
                                  <td className="py-1" style={{ fontFamily: "var(--w11-font-mono)" }}>{r.name}</td>
                                  <td
                                    className="py-1"
                                    style={{ fontFamily: "var(--w11-font-mono)", color: "var(--w11-accent)" }}
                                  >
                                    {r.value}
                                  </td>
                                </tr>
                              ))}
                              {(!settings.dns_records || settings.dns_records.length === 0) && (
                                <tr className="border-t border-[var(--w11-border-subtle)]">
                                  <td className="py-1" style={{ fontFamily: "var(--w11-font-mono)" }}>CNAME</td>
                                  <td className="py-1" style={{ fontFamily: "var(--w11-font-mono)" }}>www</td>
                                  <td
                                    className="py-1"
                                    style={{ fontFamily: "var(--w11-font-mono)", color: "var(--w11-accent)" }}
                                  >
                                    {schoolSiteHost(settings.subdomain)}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <Button
                        onClick={() => verifyMut.mutate()}
                        disabled={verifyMut.isPending}
                      >
                        {verifyMut.isPending ? "Checking..." : "Check DNS Verification"}
                      </Button>
                    </>
                  )}

                  <button
                    onClick={() => updateMut.mutate("")}
                    className="block mt-3 text-sm hover:underline"
                    style={{ color: "var(--w11-text-secondary)" }}
                  >
                    Remove custom domain
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (domain.trim()) updateMut.mutate(domain.trim());
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="www.yourschool.edu.np"
                    className="flex-1 text-sm"
                    style={{
                      background: "var(--w11-control-bg)",
                      color: "var(--w11-text-primary)",
                      border: "1px solid var(--w11-control-border)",
                      borderRadius: "var(--w11-radius-md)",
                      padding: "8px 12px",
                    }}
                  />
                  <button type="submit" disabled={!domain.trim() || updateMut.isPending} className="win11-btn accent">
                    {updateMut.isPending ? "Saving..." : "Connect Domain"}
                  </button>
                </form>
              )}
            </div>
          </DataPanel>

          {/* Info */}
          <DataPanel title="ℹ️ How it works">
            <ol
              className="text-xs space-y-1.5 list-decimal list-inside"
              style={{ color: "var(--w11-text-secondary)" }}
            >
              <li>Enter your custom domain above</li>
              <li>Add the shown DNS records at your domain registrar</li>
              <li>Wait for DNS propagation (can take up to 48 hours)</li>
              <li>Click &quot;Check DNS Verification&quot; to confirm</li>
              <li>SSL certificate will be automatically provisioned</li>
            </ol>
          </DataPanel>
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}
