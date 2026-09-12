import React from "react";

export interface WindowInstance {
  id: string;
  moduleId?: string;
  route?: string;
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export type SchoolRole =
  | "student"
  | "teacher"
  | "admin"
  | "accountant"
  | "superadmin"
  | "parent"
  | string;

export interface UserProfile {
  id: string;
  name: string;
  role: SchoolRole;
  roleLabel: string;
  department: string;
  avatar: string;
  badgeColor: string;
  tagline: string;
}

export interface EducationalPlugin {
  id: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  accent: string;
  tier?: "free" | "premium" | string;
  description: string;
  isInstalled?: boolean;
  isActive?: boolean;
  allowedRoles: SchoolRole[];
}

export interface AOSNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: "alert" | "academic" | "transit" | "finance" | "notice" | "system" | "attendance" | "exam";
  appId: string;
  actionText: string;
  isRead?: boolean;
}
