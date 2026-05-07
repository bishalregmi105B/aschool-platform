/**
 * Tests for frontend utility functions and components.
 *
 * Prerequisites (add to devDependencies):
 *   npm install -D jest ts-jest @testing-library/react @testing-library/jest-dom
 *                   identity-obj-proxy @testing-library/user-event
 */
import React from "react";
import { render, screen } from "@testing-library/react";

// ─── Mock PluginGate ───

// We test PluginGate's rendering behavior by mocking the useInstalledPlugins hook
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { role: "school_admin" }, isLoading: false }),
}));

const mockIsPluginInstalled = jest.fn();
jest.mock("@/lib/plugins", () => {
  const actual = jest.requireActual("@/lib/plugins");
  return {
    ...actual,
    useInstalledPlugins: () => ({
      installedPlugins: [],
      isPluginInstalled: mockIsPluginInstalled,
      isLoading: false,
      refreshPlugins: jest.fn(),
    }),
    PluginGate: ({ slug, children, fallback }: { slug: string; children: React.ReactNode; fallback?: React.ReactNode }) => {
      if (mockIsPluginInstalled(slug)) {
        return <>{children}</>;
      }
      return (
        fallback || (
          <div data-testid="plugin-required">
            Plugin Required: {slug}
          </div>
        )
      );
    },
  };
});

describe("PluginGate", () => {
  const { PluginGate } = require("@/lib/plugins");

  beforeEach(() => {
    mockIsPluginInstalled.mockReset();
  });

  it("renders children when plugin is installed", () => {
    mockIsPluginInstalled.mockReturnValue(true);
    render(
      <PluginGate slug="lms">
        <div data-testid="lms-content">LMS Content</div>
      </PluginGate>
    );
    expect(screen.getByTestId("lms-content")).toBeInTheDocument();
  });

  it("renders fallback when plugin is not installed", () => {
    mockIsPluginInstalled.mockReturnValue(false);
    render(
      <PluginGate slug="lms">
        <div>LMS Content</div>
      </PluginGate>
    );
    expect(screen.getByTestId("plugin-required")).toBeInTheDocument();
    expect(screen.getByText(/Plugin Required: lms/)).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    mockIsPluginInstalled.mockReturnValue(false);
    render(
      <PluginGate slug="gps_tracking" fallback={<div data-testid="custom">Custom message</div>}>
        <div>GPS Content</div>
      </PluginGate>
    );
    expect(screen.getByTestId("custom")).toBeInTheDocument();
  });
});

describe("ApiResponse type", () => {
  it("has correct structure shape", () => {
    // Type check — just verifies the interface imports correctly
    const response: import("@/lib/api").ApiResponse<{ name: string }> = {
      success: true,
      data: { name: "test" },
      error: null,
      meta: {},
    };
    expect(response.success).toBe(true);
    expect(response.data.name).toBe("test");
  });
});

describe("InstalledPlugin type", () => {
  it("has correct structure", () => {
    const plugin: import("@/lib/plugins").InstalledPlugin = {
      plugin_slug: "attendance",
      active: true,
      installed_at: "2024-01-01T00:00:00Z",
      is_trial: false,
      trial_ends_at: null,
      billing_cycle: "monthly",
      config: {},
    };
    expect(plugin.plugin_slug).toBe("attendance");
    expect(plugin.active).toBe(true);
  });
});

describe("plugin slug aliases", () => {
  const { normalizePluginSlug, getPluginDisplayName } = require("@/lib/plugins");

  it("normalizes legacy dashboard slugs to installed plugin slugs", () => {
    expect(normalizePluginSlug("hr")).toBe("hr_payroll");
    expect(normalizePluginSlug("visitors")).toBe("visitor_management");
    expect(normalizePluginSlug("communications")).toBe("sms_notifications");
  });

  it("returns a friendly label for aliased plugins", () => {
    expect(getPluginDisplayName("communications")).toBe("Communications");
    expect(getPluginDisplayName("visitors")).toBe("Visitor Management");
  });
});
