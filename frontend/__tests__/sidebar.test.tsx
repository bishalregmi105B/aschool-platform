/**
 * Tests for the Sidebar component — verifies plugin-gated nav items
 * are shown/hidden based on installed plugins.
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

const mockIsPluginInstalled = jest.fn();
jest.mock("@/lib/plugins", () => ({
  useInstalledPlugins: () => ({
    installedPlugins: [],
    isPluginInstalled: mockIsPluginInstalled,
    isLoading: false,
  }),
}));

import { Sidebar } from "@/components/layout/sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    mockIsPluginInstalled.mockReset();
  });

  it("renders core navigation items always", () => {
    mockIsPluginInstalled.mockReturnValue(false);
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Students")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("renders Marketplace and Settings for admin", () => {
    mockIsPluginInstalled.mockReturnValue(false);
    render(<Sidebar />);
    expect(screen.getByText("Marketplace")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("shows Attendance nav when attendance plugin is installed", () => {
    mockIsPluginInstalled.mockImplementation((slug: string) => slug === "attendance");
    render(<Sidebar />);
    expect(screen.getByText("Attendance")).toBeInTheDocument();
  });

  it("hides Fees nav when fees plugin is not installed", () => {
    mockIsPluginInstalled.mockReturnValue(false);
    render(<Sidebar />);
    expect(screen.queryByText("Fees")).not.toBeInTheDocument();
  });

  it("shows LMS nav when lms plugin is installed", () => {
    mockIsPluginInstalled.mockImplementation((slug: string) => slug === "lms");
    render(<Sidebar />);
    expect(screen.getByText("LMS")).toBeInTheDocument();
  });

  it("shows all plugin navs when all plugins are installed", () => {
    mockIsPluginInstalled.mockReturnValue(true);
    render(<Sidebar />);
    expect(screen.getByText("Attendance")).toBeInTheDocument();
    expect(screen.getByText("Notices")).toBeInTheDocument();
    expect(screen.getByText("Fees")).toBeInTheDocument();
    expect(screen.getByText("Social Hub")).toBeInTheDocument();
    expect(screen.getByText("LMS")).toBeInTheDocument();
    expect(screen.getByText("Wellbeing")).toBeInTheDocument();
  });

  it("renders ASchool branding", () => {
    mockIsPluginInstalled.mockReturnValue(false);
    render(<Sidebar />);
    expect(screen.getByText("ASchool")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
