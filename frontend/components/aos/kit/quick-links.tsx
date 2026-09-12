"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_MAP } from "@/lib/icon-map";
import { SECTION_GRADIENTS } from "@/lib/aos-app-adapter";

export interface QuickLinkItem {
  /** Card label — the ui.nav.subitems label from the module manifest. */
  label: string;
  /** In-app route — rendered via next/link so the AOS shell intercepts it. */
  href: string;
  /** Lucide icon name resolved through ICON_MAP; ChevronRight when unset/unknown. */
  icon?: string;
}

/**
 * Module dashboard quick-links grid — one card per manifest subpage.
 *
 * Card anatomy: 44px gradient icon tile (SECTION_GRADIENTS keyed by the
 * module's ui.nav.section, same recipe as the AOS app launcher tiles) plus a
 * 13px/600 label, wrapped in next/link so in-process navigation is
 * intercepted by the AOS shell.
 */
export function QuickLinks({
  section,
  links,
  className,
}: {
  /** Module's ui.nav.section from the plugin manifest — drives the tile gradient. */
  section?: string;
  links: QuickLinkItem[];
  className?: string;
}) {
  if (!links || links.length === 0) return null;
  const gradient = SECTION_GRADIENTS[section || ""] || SECTION_GRADIENTS.Core;
  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4",
        className
      )}
    >
      {links.map((link) => {
        const Icon = (link.icon && ICON_MAP[link.icon]) || ChevronRight;
        return (
          <Link
            key={`${link.href}-${link.label}`}
            href={link.href}
            className="block h-full"
          >
            <div
              className="win11-card h-full flex items-center gap-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ margin: 0, padding: "12px" }}
            >
              <div
                aria-hidden
                className="flex items-center justify-center shrink-0 text-white"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: gradient,
                  boxShadow:
                    "0 8px 16px -4px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.35)",
                }}
              >
                <Icon size={22} />
              </div>
              <span
                className="text-[13px] font-semibold leading-snug"
                style={{ color: "var(--w11-text-primary)" }}
              >
                {link.label}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
