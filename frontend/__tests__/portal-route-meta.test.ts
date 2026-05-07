import {
  getPortalRouteMeta,
  isKnownPortalRoute,
} from "@/lib/portal-route-meta";

describe("portal route metadata", () => {
  it("registers known parent, student, and teacher portal routes", () => {
    expect(isKnownPortalRoute("parent", "attendance")).toBe(true);
    expect(isKnownPortalRoute("student", "homework")).toBe(true);
    expect(isKnownPortalRoute("teacher", "assignments")).toBe(true);
  });

  it("returns route details for registered portal routes", () => {
    expect(getPortalRouteMeta("parent", "fees")).toMatchObject({
      title: "Fees",
    });
    expect(getPortalRouteMeta("teacher", "ai-tools")).toMatchObject({
      title: "AI Tools",
    });
  });

  it("rejects unknown portal subroutes", () => {
    expect(isKnownPortalRoute("student", "unknown")).toBe(false);
  });
});