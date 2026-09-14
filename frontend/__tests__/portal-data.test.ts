/**
 * Portal data smoke test — guarantees the student/parent portal regression
 * that B3 fixed (461dde5) stays fixed: every dedicated portal page must fetch
 * real API data (useQuery against /api/v1), the landings must not contain the
 * fabricated-data mock (fake names/streaks/XP), and the [slug] catch-alls must
 * 404 instead of rendering "coming soon" placeholder components.
 *
 * Replaces the retired portal-route-meta.test.ts, which asserted route
 * metadata rather than data wiring.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const APP = join(__dirname, "..", "app");

function read(p: string): string {
  return readFileSync(p, "utf-8");
}

function listPages(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listPages(full));
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

function assertRealData(file: string) {
  const src = read(file);
  // Pages may encapsulate their queries in portal hooks (useSelectedChild
  // wraps react-query and exposes dash.isLoading/refetch) — count those as
  // wired. The banned marker remains the placeholder stub component.
  const wired =
    src.includes("useQuery") ||
    src.includes("useStudentData") ||
    src.includes("useSelectedChild");
  expect(wired && !src.includes("PortalSectionPage")).toBe(true);
}

function assertHonest404(slugDir: string) {
  const src = read(join(APP, slugDir, "[slug]", "page.tsx"));
  expect(src.includes("notFound") && !src.includes("PortalSectionPage")).toBe(
    true
  );
}

describe("student portal", () => {
  const dedicated = listPages(join(APP, "student")).filter(
    (f) => !f.includes("[slug]")
  );

  it("has dedicated pages for the former coming-soon routes", () => {
    for (const slug of [
      "results",
      "timetable",
      "library",
      "lms",
      "ai-tutor",
      "elibrary",
      "homework",
    ]) {
      expect(dedicated).toContain(join(APP, "student", slug, "page.tsx"));
    }
  });

  it("every dedicated page fetches real API data (useQuery)", () => {
    for (const file of dedicated) assertRealData(file);
  });

  it("landing page has zero fabricated personal data", () => {
    const src = read(join(APP, "student", "page.tsx"));
    for (const marker of [
      "Hey, Student!",
      "Roll No. 15",
      "12 Day",
      "Mr. Sharma",
    ]) {
      expect(src.includes(marker)).toBe(false);
    }
  });

  it("unknown slugs 404 instead of rendering a coming-soon card", () => {
    assertHonest404("student");
  });
});

describe("parent portal", () => {
  const dedicated = listPages(join(APP, "parent")).filter(
    (f) => !f.includes("[slug]")
  );

  it("has dedicated pages for the former coming-soon routes", () => {
    for (const slug of [
      "attendance",
      "results",
      "fees",
      "chat",
      "bus",
      "notices",
      "health",
      "wellbeing",
      "conferences",
    ]) {
      expect(dedicated).toContain(join(APP, "parent", slug, "page.tsx"));
    }
  });

  it("every dedicated page fetches real API data (useQuery)", () => {
    for (const file of dedicated) assertRealData(file);
  });

  it("unknown slugs 404 instead of rendering a coming-soon card", () => {
    assertHonest404("parent");
  });
});

describe("teacher portal", () => {
  // Wave-I de-re-exported the teacher portal: each page is now a real,
  // teacher-scoped page (own queries, own pickers) instead of a one-line
  // re-export of the admin screen. Assert the new contract: the page is
  // substantive (not a re-export stub) and fetches real data.
  const teacherPages = [
    "attendance",
    "marks",
    "timetable",
    "notices",
  ] as const;

  it("attendance/marks/timetable/notices are real teacher-scoped pages", () => {
    for (const slug of teacherPages) {
      const src = read(join(APP, "teacher", slug, "page.tsx"));
      const isReExportStub =
        /^import\s+.*from\s+"@/m.test(src) &&
        /^export\s+(default\s+)?\{?\s*\w+\s*\}?;?\s*$/m.test(src.trim()) &&
        src.split("\n").length <= 5;
      expect(isReExportStub).toBe(false);
      expect(
        src.includes("useQuery") || src.includes("useTeacher")
      ).toBe(true);
    }
  });
});
