/**
 * Global State Store — Zustand-based state management.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── App Store ────────────────────────────────────────────

interface AppState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Theme
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Language
  language: "en" | "ne";
  setLanguage: (lang: "en" | "ne") => void;

  // Notifications
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;

  // Active academic session
  activeSession: string | null;
  setActiveSession: (session: string | null) => void;

  // Selected class/section filter (persists across pages)
  selectedClass: string | null;
  selectedSection: string | null;
  setClassFilter: (classId: string | null, sectionId?: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Theme
      theme: "system",
      setTheme: (theme) => set({ theme }),

      // Language
      language: "en",
      setLanguage: (language) => set({ language }),

      // Notifications
      unreadCount: 0,
      setUnreadCount: (unreadCount) => set({ unreadCount }),
      incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),

      // Session
      activeSession: null,
      setActiveSession: (activeSession) => set({ activeSession }),

      // Class filter
      selectedClass: null,
      selectedSection: null,
      setClassFilter: (selectedClass, selectedSection = null) =>
        set({ selectedClass, selectedSection }),
    }),
    {
      name: "aschool-app-store",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        language: state.language,
        activeSession: state.activeSession,
        selectedClass: state.selectedClass,
        selectedSection: state.selectedSection,
      }),
    }
  )
);

// ── Notification Store ───────────────────────────────────

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
  action_url?: string;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50) })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
  clearAll: () => set({ notifications: [] }),
}));
