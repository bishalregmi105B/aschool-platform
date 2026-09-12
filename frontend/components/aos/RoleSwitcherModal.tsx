"use client";

import React from "react";
import { UserCheck, X, LogOut, Mail, Building2, Phone } from "lucide-react";
import { SchoolRole, UserProfile } from "@/components/aos/types";
import { useAuth } from "@/lib/auth-context";

export type { SchoolRole, UserProfile };

const ROLE_BADGE_COLORS: Record<string, string> = {
  student: "#0284c7",
  teacher: "#10b981",
  admin: "#6366f1",
  superadmin: "#8b5cf6",
  school_admin: "#6366f1",
  accountant: "#f59e0b",
  parent: "#ec4899",
};

/**
 * Generic per-role display fallbacks (role label + badge color only — no demo
 * personas). Exported for legacy call sites (e.g. SettingsApp) that still
 * import SCHOOL_PROFILES; new code should read the real user via useAuth.
 */
export const SCHOOL_PROFILES: Record<string, UserProfile> = {
  student: {
    id: "student",
    name: "Student",
    role: "student",
    roleLabel: "Student",
    department: "Academics",
    avatar: "S",
    badgeColor: ROLE_BADGE_COLORS.student,
    tagline: "Student account",
  },
  teacher: {
    id: "teacher",
    name: "Teacher",
    role: "teacher",
    roleLabel: "Teacher",
    department: "Faculty",
    avatar: "T",
    badgeColor: ROLE_BADGE_COLORS.teacher,
    tagline: "Faculty account",
  },
  admin: {
    id: "admin",
    name: "Administrator",
    role: "admin",
    roleLabel: "Administrator",
    department: "School Administration",
    avatar: "A",
    badgeColor: ROLE_BADGE_COLORS.admin,
    tagline: "School administrator account",
  },
  accountant: {
    id: "accountant",
    name: "Accountant",
    role: "accountant",
    roleLabel: "Accountant",
    department: "Finance Office",
    avatar: "F",
    badgeColor: ROLE_BADGE_COLORS.accountant,
    tagline: "Finance office account",
  },
};

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kept for call-site compatibility; the dialog always shows the real session user. */
  currentRole?: SchoolRole;
  /**
   * Legacy prop kept so existing call sites keep compiling. Role switching was
   * removed — roles come from real school accounts only (useAuth).
   */
  onSelectRole?: (role: SchoolRole) => void;
}

/**
 * Account dialog ("Signed in as"). Shows the REAL authenticated user from
 * useAuth (full name, role, school) with a single Sign Out action. Demo
 * personas and identity switching were removed — your role is whatever your
 * school account says it is.
 */
export default function RoleSwitcherModal({
  isOpen,
  onClose,
  currentRole,
}: RoleSwitcherModalProps) {
  const { user, logout } = useAuth();

  if (!isOpen) return null;

  const effectiveRole = String(user?.role || currentRole || "user").toLowerCase();
  const roleLabel = effectiveRole
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const badgeColor = ROLE_BADGE_COLORS[effectiveRole] || "#0284c7";
  const displayName = user?.full_name || "User";
  const avatar = user?.avatar_url ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={user.avatar_url}
      alt={displayName}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  ) : (
    displayName.charAt(0).toUpperCase()
  );

  const handleSignOut = () => {
    onClose();
    // logout() clears the session server-side and redirects to /login.
    logout();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 10005,
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "440px",
          maxWidth: "92vw",
          background: "var(--w11-surface-flyout)",
          backdropFilter: "blur(35px) saturate(180%)",
          WebkitBackdropFilter: "blur(35px) saturate(180%)",
          border: "1px solid var(--w11-acrylic-border)",
          borderRadius: "18px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.45)",
          padding: "24px",
          zIndex: 10006,
          userSelect: "none",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <UserCheck size={20} color="var(--w11-accent)" />
              <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--w11-text-primary)" }}>
                Signed in as
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginTop: "2px" }}>
              Your ASchool account — roles come from your school account, not this device.
            </div>
          </div>
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: "var(--w11-text-secondary)", padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        {/* Real session user */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "14px 16px",
            borderRadius: "12px",
            background: "var(--w11-control-bg)",
            border: `1px solid ${badgeColor}40`,
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: badgeColor,
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: 700,
              overflow: "hidden",
              flexShrink: 0,
              boxShadow: `0 4px 12px ${badgeColor}40`,
            }}
          >
            {avatar}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--w11-text-primary)" }}>
                {displayName}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "10px",
                  background: `${badgeColor}22`,
                  color: badgeColor,
                  border: `1px solid ${badgeColor}40`,
                }}
              >
                {roleLabel}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "6px" }}>
              {user?.email && (
                <span style={{ fontSize: "11px", color: "var(--w11-text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Mail size={11} /> {user.email}
                </span>
              )}
              {user?.phone && (
                <span style={{ fontSize: "11px", color: "var(--w11-text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Phone size={11} /> {user.phone}
                </span>
              )}
              <span style={{ fontSize: "11px", color: "var(--w11-text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Building2 size={11} />
                {user?.school_id
                  ? `School ${user.school_id.slice(0, 8).toUpperCase()}`
                  : "ASchool account"}
              </span>
            </div>
          </div>
        </div>

        {/* Single action: Sign Out */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "18px" }}>
          <button className="subtle" onClick={onClose} style={{ fontSize: "12px" }}>
            Close
          </button>
          <button
            className="accent"
            onClick={handleSignOut}
            style={{
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "#ef4444",
              borderColor: "#ef4444",
            }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
