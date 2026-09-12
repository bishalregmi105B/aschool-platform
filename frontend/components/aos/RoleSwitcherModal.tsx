"use client";

import React from "react";
import {
  GraduationCap,
  BookOpen,
  Shield,
  DollarSign,
  Check,
  X,
  UserCheck,
} from "lucide-react";
import { SchoolRole, UserProfile } from "@/components/aos/types";

export type { SchoolRole, UserProfile };

export const SCHOOL_PROFILES: Record<string, UserProfile> = {
  student: {
    id: "AOS-2026-9042",
    name: "Bishal Regmi",
    role: "student",
    roleLabel: "Student (Grade 11-A)",
    department: "Science & Engineering Track",
    avatar: "B",
    badgeColor: "#0284c7",
    tagline: "Academic Scholar • Honors Standing (GPA 3.98)",
  },
  teacher: {
    id: "AOS-FAC-108",
    name: "Dr. Robert Henderson",
    role: "teacher",
    roleLabel: "Faculty Professor",
    department: "Department of Physics & Astronomy",
    avatar: "H",
    badgeColor: "#10b981",
    tagline: "Senior Lecturer • Chair of Physics Council",
  },
  admin: {
    id: "AOS-EXEC-001",
    name: "Dr. Evelyn Carter",
    role: "admin",
    roleLabel: "Principal & Executive Dean",
    department: "Institutional Leadership & Chancellor's Office",
    avatar: "C",
    badgeColor: "#6366f1",
    tagline: "Head of Institution • Full Administrative Authority",
  },
  accountant: {
    id: "AOS-FIN-044",
    name: "Clara Higgins, CPA",
    role: "accountant",
    roleLabel: "Financial Comptroller",
    department: "Office of Accounts & Bursar",
    avatar: "F",
    badgeColor: "#f59e0b",
    tagline: "Bursar • Tuition Ledger & Payroll Comptroller",
  },
};

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: SchoolRole;
  onSelectRole: (role: SchoolRole) => void;
}

export default function RoleSwitcherModal({
  isOpen,
  onClose,
  currentRole,
  onSelectRole,
}: RoleSwitcherModalProps) {
  if (!isOpen) return null;

  const roleEntries: { key: SchoolRole; icon: React.ReactNode; profile: UserProfile }[] = [
    {
      key: "student",
      icon: <GraduationCap size={24} />,
      profile: SCHOOL_PROFILES.student,
    },
    {
      key: "teacher",
      icon: <BookOpen size={24} />,
      profile: SCHOOL_PROFILES.teacher,
    },
    {
      key: "admin",
      icon: <Shield size={24} />,
      profile: SCHOOL_PROFILES.admin,
    },
    {
      key: "accountant",
      icon: <DollarSign size={24} />,
      profile: SCHOOL_PROFILES.accountant,
    },
  ];

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
          zIndex: 10005,
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "560px",
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
                AOS School User & Role Authentication
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", marginTop: "2px" }}>
              Switch identity to load role-specific desktop workspaces and permissions
            </div>
          </div>
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: "var(--w11-text-secondary)", padding: "4px" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {roleEntries.map(({ key, icon, profile }) => {
            const isSelected = currentRole === key;
            return (
              <div
                key={key}
                onClick={() => {
                  onSelectRole(key);
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  background: isSelected ? "var(--w11-control-hover)" : "var(--w11-control-bg)",
                  border: isSelected ? `2px solid ${profile.badgeColor}` : "1px solid var(--w11-control-border)",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: profile.badgeColor,
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 4px 12px ${profile.badgeColor}40`,
                    }}
                  >
                    {icon}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--w11-text-primary)" }}>
                        {profile.name}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "10px",
                          background: `${profile.badgeColor}22`,
                          color: profile.badgeColor,
                          border: `1px solid ${profile.badgeColor}40`,
                        }}
                      >
                        {profile.roleLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)", marginTop: "2px" }}>
                      {profile.department} • ID: <code>{profile.id}</code>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                  {isSelected ? (
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: profile.badgeColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                      }}
                    >
                      <Check size={14} />
                    </div>
                  ) : (
                    <button className="subtle" style={{ fontSize: "12px", padding: "4px 10px" }}>
                      Switch
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
