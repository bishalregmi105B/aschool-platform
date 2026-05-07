/**
 * PluginGate — Conditionally render UI based on plugin installation status.
 *
 * Usage:
 *   <PluginGate plugin="lms">
 *     <LMSPanel />
 *   </PluginGate>
 *
 *   <PluginGate plugin="social_hub" fallback={<UpgradePrompt />}>
 *     <SocialHub />
 *   </PluginGate>
 */
"use client";

import { ReactNode } from "react";
import { getPluginDisplayName, normalizePluginSlug, useInstalledPlugins } from "@/lib/plugins";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ShoppingCart } from "lucide-react";
import Link from "next/link";

interface PluginGateProps {
  /** Plugin slug to check */
  plugin: string;
  /** Content to render when plugin is installed */
  children: ReactNode;
  /** Optional fallback when plugin is NOT installed (default: install prompt) */
  fallback?: ReactNode;
  /** If true, renders nothing instead of the default fallback */
  silent?: boolean;
  /** Required roles (optional) — only show if user has one of these roles */
  roles?: string[];
}

export function PluginGate({ plugin, children, fallback, silent = false, roles }: PluginGateProps) {
  const { isPluginInstalled, isLoading } = useInstalledPlugins();
  const normalizedPlugin = normalizePluginSlug(plugin);

  // While loading, render nothing to prevent flash
  if (isLoading) return null;

  // Check plugin installation
  const isInstalled = isPluginInstalled(normalizedPlugin);

  if (!isInstalled) {
    if (silent) return null;
    if (fallback) return <>{fallback}</>;

    // Default: attractive install prompt
    return <PluginInstallPrompt pluginSlug={plugin} />;
  }

  return <>{children}</>;
}

// ── Default Install Prompt ───────────────────────────────

function PluginInstallPrompt({ pluginSlug }: { pluginSlug: string }) {
  const displayName = getPluginDisplayName(pluginSlug)
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Card className="border-dashed border-2 border-muted">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{displayName} Plugin Required</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          Install the <strong>{displayName}</strong> plugin from the marketplace to unlock this feature.
        </p>
        <Link href={`/dashboard/marketplace`}>
          <Button variant="outline" size="sm">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Go to Marketplace
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ── Hook variant ─────────────────────────────────────────

export function usePluginEnabled(pluginSlug: string): boolean {
  const { isPluginInstalled } = useInstalledPlugins();
  return isPluginInstalled(normalizePluginSlug(pluginSlug));
}

// ── Nav Item Gate (for sidebar) ──────────────────────────

interface PluginNavGateProps {
  plugin: string;
  children: ReactNode;
}

export function PluginNavGate({ plugin, children }: PluginNavGateProps) {
  return (
    <PluginGate plugin={plugin} silent>
      {children}
    </PluginGate>
  );
}
