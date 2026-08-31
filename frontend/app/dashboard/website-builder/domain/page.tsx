"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { schoolSiteHost } from "@/lib/site-domain";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-2xl">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load domain settings. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">🌐 Custom Domain</h1>
        <p className="text-gray-500 text-sm mt-1">
          Connect your own domain to your school website
        </p>
      </div>

      {/* Default subdomain */}
      <div className="border rounded-lg p-5">
        <h3 className="font-medium text-sm mb-2">Default Subdomain</h3>
        <div className="flex items-center gap-2 bg-gray-50 rounded p-3">
          <span className="text-sm font-mono">
            {schoolSiteHost(settings?.subdomain || "your-school")}
          </span>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
            Always Active
          </span>
        </div>
      </div>

      {/* Custom domain */}
      <div className="border rounded-lg p-5 space-y-4">
        <h3 className="font-medium text-sm">Custom Domain</h3>
        <p className="text-xs text-gray-500">
          Point your own domain (e.g. www.yourschool.edu.np) to your ASchool website.
          This is a premium feature.
        </p>

        {settings?.custom_domain ? (
          <div>
            <div className="flex items-center gap-2 bg-gray-50 rounded p-3 mb-3">
              <span className="text-sm font-mono">{settings.custom_domain}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  settings.domain_verified
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {settings.domain_verified ? "✓ Verified" : "⏳ Pending"}
              </span>
            </div>

            {!settings.domain_verified && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-3">
                  <h4 className="font-medium text-sm text-blue-800 mb-2">
                    Add these DNS records:
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="pb-1">Type</th>
                          <th className="pb-1">Name</th>
                          <th className="pb-1">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(settings.dns_records || []).map((r, i) => (
                          <tr key={i} className="border-t">
                            <td className="py-1 font-mono">{r.type}</td>
                            <td className="py-1 font-mono">{r.name}</td>
                            <td className="py-1 font-mono text-blue-700">{r.value}</td>
                          </tr>
                        ))}
                        {(!settings.dns_records || settings.dns_records.length === 0) && (
                          <tr>
                            <td className="py-1 font-mono">CNAME</td>
                            <td className="py-1 font-mono">www</td>
                            <td className="py-1 font-mono text-blue-700">
                              {schoolSiteHost(settings.subdomain)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <button
                  onClick={() => verifyMut.mutate()}
                  disabled={verifyMut.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {verifyMut.isPending ? "Checking..." : "Check DNS Verification"}
                </button>
              </>
            )}

            <button
              onClick={() => updateMut.mutate("")}
              className="block mt-3 text-sm text-red-500 hover:underline"
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
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!domain.trim() || updateMut.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {updateMut.isPending ? "Saving..." : "Connect Domain"}
            </button>
          </form>
        )}
      </div>

      {/* Info */}
      <div className="bg-gray-50 rounded-lg p-5">
        <h3 className="font-medium text-sm mb-2">ℹ️ How it works</h3>
        <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
          <li>Enter your custom domain above</li>
          <li>Add the shown DNS records at your domain registrar</li>
          <li>Wait for DNS propagation (can take up to 48 hours)</li>
          <li>Click &quot;Check DNS Verification&quot; to confirm</li>
          <li>SSL certificate will be automatically provisioned</li>
        </ol>
      </div>
    </div>
  );
}
