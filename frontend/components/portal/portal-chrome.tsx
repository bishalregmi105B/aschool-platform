"use client";

/**
 * PortalChrome — the single responsive shell for /teacher, /parent, /student.
 *
 * Why one component for three portals (audit §14 #10): the three layouts had
 * drifted into three different paradigms (two accent colors + one violet
 * header) and ALL THREE had `hidden md:flex` nav with no mobile fallback —
 * the portals are used on phones by parents and students first.
 *
 * Research notes (this pass):
 * - NN/g "Hamburger Menicons": hiding nav cuts discoverability ~half; the
 *   pattern is acceptable ONLY for >4 links on small screens and must be
 *   paired with visible links to critical content — so the mobile drawer
 *   opens on the CURRENT portal home's task cards, not just a menu.
 *   (https://www.nngroup.com/articles/hamburger-menus/)
 * - Touch targets ≥44px, 8px gaps (Apple HIG / WCAG 2.5.8 target size).
 *
 * These surfaces stay OUTSIDE the AOS window shell, but keep the `win11`
 * scope class so shared ui-kit components (DataTable, MetricCard,
 * EmptyState) resolve their tokens — same grammar, different chrome.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X, GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { displayBS } from "@/lib/nepali_date";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface PortalNavItem {
  href: string;
  label: string;
  /** Optional Nepali label — bilingual chrome rule (9.7) once dicts land. */
  labelNe?: string;
}

export interface PortalChromeProps {
  title: string;
  nav: PortalNavItem[];
  children: React.ReactNode;
}

export function PortalChrome({ title, nav, children }: PortalChromeProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [todayBS] = React.useState(() => displayBS(new Date().toISOString().slice(0, 10)));

  // Close the drawer on navigation.
  React.useEffect(() => setMenuOpen(false), [pathname]);

  // Exact match: nav hrefs map 1:1 to routes; startsWith would double-light
  // nested routes (e.g. /teacher/attendance + .../leave-requests).
  const isActive = (href: string) => pathname === href;

  return (
    <div
      className="win11 min-h-screen bg-[var(--w11-window-bg,#f3f3f3)]"
      style={{ color: "var(--w11-text-primary,#1b1b1b)" }}
    >
      <header
        className="sticky top-0 z-40"
        style={{ background: "var(--w11-accent,#0f6cbd)", color: "var(--w11-accent-text,#fff)" }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Link href={nav[0]?.href ?? "/"} className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-tight">ASchool</span>
              <span className="block truncate text-[11px] leading-tight opacity-85">{title}</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label={title} className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-white/20 text-white"
                    : "text-white/85 hover:bg-white/10 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="mr-1 hidden text-[11px] opacity-80 md:block" title="Bikram Sambat date">
              {todayBS}
            </span>
            {user?.full_name && (
              <span className="hidden items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-xs font-medium md:flex">
                <Avatar name={user.full_name} size="sm" />
                <span className="max-w-[10rem] truncate">{user.full_name}</span>
              </span>
            )}
            <button
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              className="hidden h-9 w-9 place-items-center rounded-lg hover:bg-white/10 md:grid"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <button
              className="grid h-11 w-11 place-items-center rounded-lg hover:bg-white/10 lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer — full-height, 44px rows */}
        {menuOpen && (
          <nav
            aria-label={title}
            className="border-t border-white/15 lg:hidden"
            style={{ background: "var(--w11-accent,#0f6cbd)" }}
          >
            <ul className="mx-auto max-w-7xl px-2 py-2">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium",
                      isActive(item.href) ? "bg-white/20 text-white" : "text-white/90 hover:bg-white/10",
                    )}
                  >
                    {item.label}
                    {item.labelNe && <span className="ml-2 text-xs opacity-70">{item.labelNe}</span>}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  onClick={logout}
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-4 text-sm font-medium text-white/90 hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-6">{children}</main>
    </div>
  );
}
