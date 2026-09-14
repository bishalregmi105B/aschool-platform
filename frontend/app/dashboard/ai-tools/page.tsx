"use client";

/**
 * AI Tools catalog (/dashboard/ai-tools) — the AI Hub "Tools" tab content,
 * kept as a standalone deep route (Part 10.4: existing deep URLs keep
 * working; the new canonical entry is /dashboard/ai). The catalog itself
 * lives in _components/tool-catalog so both surfaces render one grid
 * (research: MagicSchool launcher pattern — search + category chips +
 * one-line outcome cards; A5 rule — hub = launcher, not dashboard-of-all).
 *
 * Wave-H: replaced the duplicated tile-grid + card-grid (two renderings of
 * the same list) with the single searchable ToolCatalog.
 */

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { AppGate } from "@/lib/apps";
import { Button } from "@/components/ui/button";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
} from "@/components/aos/kit/page-kit";
import { ToolCatalog, AI_TOOLS } from "./_components/tool-catalog";

export default function AIToolsPage() {
  return (
    <AppGate slug="ai_suite">
      <AOSPage>
        <AOSPageHeader
          icon={<Sparkles className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
          title="AI Tools Hub"
          subtitle={`${AI_TOOLS.length} AI-powered tools to save hours of manual work · सबै AI उपकरणहरू एउटै सूचीमा`}
          actions={
            <Link href="/dashboard/ai">
              <Button variant="outline" size="sm">
                AI Hub <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          }
        />
        <AOSPageBody>
          <ToolCatalog />
        </AOSPageBody>
      </AOSPage>
    </AppGate>
  );
}
