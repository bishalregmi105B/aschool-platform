import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function expectsSanitizer(relPath: string): void {
  const content = read(relPath);
  if (content.includes("dangerouslySetInnerHTML")) {
    expect(content).toMatch(/DOMPurify|sanitize|isomorphic-dompurify/i);
  }
}

describe("Simulation Security Regression Suite (Frontend)", () => {
  test("SEC-06: access token must not be JS-readable via js-cookie/localStorage", () => {
    const api = read("lib/api.ts");
    const authContext = read("lib/auth-context.tsx");
    const socket = read("lib/socket.ts");

    expect(api).not.toMatch(/Cookies\.set\(\s*["']access_token["']/);
    expect(authContext).not.toMatch(/Cookies\.set\(\s*["']access_token["']/);
    expect(socket).not.toMatch(/localStorage\.getItem\(\s*["']token["']\s*\)/);
  });

  test("SEC-07 / M1: middleware must validate JWT expiry, not only cookie presence", () => {
    const middleware = read("middleware.ts");

    // NOTE (2026-08-22): this assertion previously required the literal
    // substring `split("\.")` — a doubly-escaped pattern that cannot appear
    // in valid TypeScript. The code genuinely decodes the JWT payload via
    // `jwt.split(".")` + Buffer/base64url and enforces `exp`; the check was
    // tightened here to assert real decoding + expiry validation rather than
    // an unreachable string match.
    const hasTokenDecoding =
      /(jwtDecode|decodeJwt|jsonwebtoken|jose|atob\(|split\(\s*["']\.["']\s*\))/i.test(
        middleware
      );
    const checksExpiryClaim = /\bexp\b/.test(middleware);
    const hasExpiryValidation = hasTokenDecoding && checksExpiryClaim;
    expect(hasExpiryValidation).toBe(true);

    // The guard must actually redirect on an expired token, not just decode it.
    expect(middleware).toMatch(/isTokenExpired/);
    expect(middleware).toMatch(/redirect/);
  });

  test("C2: public school pages must sanitize dangerouslySetInnerHTML blocks", () => {
    expectsSanitizer("app/school/[slug]/page.tsx");
    expectsSanitizer("app/school/[slug]/notices/page.tsx");
    expectsSanitizer("app/school/[slug]/news/[articleSlug]/page.tsx");
    expectsSanitizer("components/website/SectionRenderer.tsx");
  });
});
