"use client";

import React from "react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DetailSplit,
} from "@/components/aos/kit/page-kit";
import { ListView, type ListViewNode } from "@/components/aos/kit/detail-kit";
import { useAOSRouterNavigate } from "@/lib/aos-window-route";
import {
  Building2,
  Bell,
  Plug,
  DatabaseBackup,
  ClipboardList,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * A8 settings grammar (plan 32 / Part 34 #14): every settings subpage renders
 * the SAME left settings-nav (a pick-one ListView) beside its section content,
 * so "where am I / where else can I go" is answered identically on all seven
 * real subpages. The redirect stub (`website-design`) intentionally opts out.
 *
 * `useAOSRouterNavigate` keeps navigation in-process inside the AOS shell (no
 * full browser reload) and falls back to the Next router outside it, so the
 * same shell works in windows and direct URLs.
 */

interface SettingsNavItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { id: "school", label: "School Profile", description: "Identity, branding & configuration", href: "/dashboard/settings", icon: Building2 },
  { id: "notifications", label: "Notifications", description: "Channels and event types", href: "/dashboard/settings/notifications", icon: Bell },
  { id: "integrations", label: "Integrations", description: "Payments & connected services", href: "/dashboard/settings/integrations", icon: Plug },
  { id: "roles", label: "Roles & Permissions", description: "Who can reach what", href: "/dashboard/settings/roles", icon: ShieldCheck },
  { id: "custom-fields", label: "Custom Fields", description: "Extra registration fields", href: "/dashboard/settings/custom-fields", icon: ClipboardList },
  { id: "access-logs", label: "Access Logs", description: "Sign-in activity & security", href: "/dashboard/settings/access-logs", icon: ScrollText },
  { id: "backup", label: "Database Backup", description: "Automated backups & status", href: "/dashboard/settings/backup", icon: DatabaseBackup },
];

function SettingsNav({ active }: { active: string }) {
  const navigate = useAOSRouterNavigate();
  const items: ListViewNode[] = SETTINGS_NAV.map((n) => ({
    id: n.id,
    primary: (
      <span className="flex items-center gap-2">
        <n.icon
          className="h-4 w-4 shrink-0"
          style={{ color: active === n.id ? "var(--w11-accent)" : "var(--w11-text-secondary)" }}
        />
        <span className={active === n.id ? "font-semibold" : ""}>{n.label}</span>
      </span>
    ),
    secondary: n.description,
  }));

  return (
    <div
      className="win11-card"
      style={{ padding: 8, position: "sticky", top: 0 }}
    >
      <p
        className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--w11-text-secondary)" }}
      >
        Settings
      </p>
      <ListView
        items={items}
        selectedId={active}
        onSelect={(id) => {
          const n = SETTINGS_NAV.find((x) => x.id === id);
          if (n) navigate(n.href);
        }}
        aria-label="Settings sections"
      />
    </div>
  );
}

/**
 * The one page shell for all settings subpages. Drop-in replacement for the
 * hand-composed AOSPage → AOSPageHeader → AOSPageBody block: it adds the left
 * nav and the responsive split so every section shares one grammar.
 */
export function SettingsPage({
  active,
  title,
  subtitle,
  icon,
  actions,
  children,
}: {
  active: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AOSPage>
      <AOSPageHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />
      <AOSPageBody>
        <DetailSplit sidebar={<SettingsNav active={active} />} sidebarWidth="260px">
          {children}
        </DetailSplit>
      </AOSPageBody>
    </AOSPage>
  );
}

export { SETTINGS_NAV };
export type { SettingsNavItem };
