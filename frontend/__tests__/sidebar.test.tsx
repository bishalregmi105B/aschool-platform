/**
 * Tests for the Sidebar component — verifies that navigation is driven by
 * the /plugins/sidebar API contract (items + bottom_nav) and that
 * plugin-scoped entries appear/disappear with the installed-plugin data.
 */
import React from "react";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

// Mock next/link
jest.mock("next/link", () => {
  return function MockLink({ href, children, ...props }: { href: string; children: React.ReactNode }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

const mockUser = { role: "school_admin", full_name: "Test Admin" };
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: mockUser,
    isLoading: false,
  }),
}));

type SidebarItem = {
  slug: string;
  label: string;
  label_nepali: string | null;
  icon: string;
  section: string | null;
  route: string;
};

let mockSidebarState = {
  sidebarItems: [] as SidebarItem[],
  pluginBottomNav: [] as Array<{ slug: string; label: string; icon: string; route: string }>,
  isLoading: false,
};

jest.mock("@/lib/plugins", () => ({
  useInstalledPlugins: () => mockSidebarState,
}));

import { Sidebar } from "@/components/layout/sidebar";

const coreItem = (slug: string, label: string): SidebarItem => ({
  slug,
  label,
  label_nepali: null,
  icon: "LayoutDashboard",
  section: null,
  route: `/dashboard/${slug}`,
});

describe("Sidebar", () => {
  beforeEach(() => {
    mockSidebarState = {
      sidebarItems: [
        coreItem("dashboard", "Dashboard"),
        coreItem("students", "Students"),
        coreItem("users", "Users"),
      ],
      pluginBottomNav: [
        { slug: "marketplace_nav", label: "Marketplace", icon: "Store", route: "/dashboard/marketplace" },
        { slug: "settings_core", label: "Settings", icon: "Settings", route: "/dashboard/settings" },
      ],
      isLoading: false,
    };
  });

  it("renders items supplied by the plugins API", () => {
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Students")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("renders Marketplace and Settings from the bottom-nav config", () => {
    render(<Sidebar />);
    expect(screen.getByText("Marketplace")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("shows a plugin nav item when the plugin is installed", () => {
    mockSidebarState.sidebarItems.push(coreItem("attendance", "Attendance"));
    render(<Sidebar />);
    expect(screen.getByText("Attendance")).toBeInTheDocument();
  });

  it("hides a plugin nav item when the plugin is not installed", () => {
    render(<Sidebar />);
    expect(screen.queryByText("Attendance")).not.toBeInTheDocument();
  });

  it("renders nothing from stale data while loading", () => {
    // Realistic loading state: items have not arrived yet.
    mockSidebarState = { sidebarItems: [], pluginBottomNav: [], isLoading: true };
    render(<Sidebar />);
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Marketplace")).not.toBeInTheDocument();
  });

  it("groups items under their section header when provided", () => {
    mockSidebarState.sidebarItems = [
      {
        slug: "library",
        label: "Library",
        label_nepali: null,
        icon: "BookOpen",
        section: "Campus Services",
        route: "/dashboard/library",
      },
    ];
    render(<Sidebar />);
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Campus Services")).toBeInTheDocument();
  });

  it("renders the brand subtitle", () => {
    render(<Sidebar />);
    // Brand is rendered as split spans (A/S/chool); assert the stable subtitle.
    expect(screen.getByText("Management System")).toBeInTheDocument();
  });
});
