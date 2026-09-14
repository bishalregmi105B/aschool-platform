"use client";

import { PluginGate } from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
} from "@/components/aos/kit/page-kit";
import { BarChart3, ChevronRight, Columns3 } from "lucide-react";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";
import { ICON_MAP } from "@/lib/icon-map";
import { BenchmarkCompare } from "../analytics/compare-panel";

// Quick links — the AI Suite bundle surfaces benchmarking lives beside.
const QUICK_LINKS = [
  { label: "AI Tools Hub", icon: "Sparkles", href: "/dashboard/ai-tools" },
  { label: "AI Workbench", icon: "Layers", href: "/dashboard/ai-workbench" },
  { label: "Analytics", icon: "BarChart3", href: "/dashboard/analytics" },
  { label: "Reports", icon: "FileBarChart2", href: "/dashboard/reports" },
];

function BenchmarkingContent() {
  return (
    <AOSPage>
      <AOSPageHeader
        icon={<BarChart3 className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="School Benchmarking"
        subtitle="Compare your school's performance against district and national averages"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/analytics?tab=compare">
              <Columns3 className="h-4 w-4 mr-2" /> Open in Analytics
            </Link>
          </Button>
        }
      />
      <AOSPageBody>
        {/* This route now embeds the same Compare panel that the Analytics
            hub shows under its ?tab=compare tab (plan 34 #21 — the legacy
            route is kept as an alias). */}
        <BenchmarkCompare />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {QUICK_LINKS.map((l) => {
            const Icon = ICON_MAP[l.icon] || ChevronRight;
            return (
              <Link key={l.href} href={l.href} className="block h-full">
                <div
                  className="win11-card h-full flex items-center gap-3 transition-colors hover:border-[var(--w11-accent)]"
                  style={{ cursor: "pointer", marginBottom: 0 }}
                >
                  <div
                    className="rounded-[10px] flex items-center justify-center text-white shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      background: SECTION_GRADIENTS.Insights,
                      boxShadow: "0 6px 12px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[13px] font-semibold leading-snug" style={{ color: "var(--w11-text-primary)" }}>
                    {l.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </AOSPageBody>
    </AOSPage>
  );
}

export default function BenchmarkingPage() {
  return (
    <PluginGate slug="ai_suite">
      <BenchmarkingContent />
    </PluginGate>
  );
}
