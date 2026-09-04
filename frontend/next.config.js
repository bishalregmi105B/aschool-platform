/** @type {import('next').NextConfig} */

// S-10 CSP: dashboard routes lock down hard (no third-party frame/embed
// needs); public school sites allow Google Fonts + Maps iframes + GA.
const dashboardCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.aschool.com.np https://*.r2.cloudflarestorage.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.groq.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
const publicSiteCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "frame-src https://www.google.com https://maps.google.com https://www.openstreetmap.org",
  "connect-src 'self' https://www.google-analytics.com",
  "base-uri 'self'",
].join("; ");

const nextConfig = {
  async headers() {
    return [
      {
        source: "/dashboard/:path*",
        headers: [
          { key: "Content-Security-Policy", value: dashboardCsp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/school/:path*",
        headers: [
          { key: "Content-Security-Policy", value: publicSiteCsp },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  // isomorphic-dompurify -> jsdom reads files from its own package dir at
  // import time; it must be require()d at runtime, not webpack-bundled.
  experimental: {
    serverComponentsExternalPackages: ["isomorphic-dompurify", "jsdom"],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pptxgenjs lazy-imports node:fs / node:https at runtime behind an
      // isNode guard — never taken in the browser. Webpack 5 cannot resolve
      // the "node:" scheme at all (aliases don't intercept it), so ignore
      // those requests entirely: they compile to empty modules and are only
      // reachable from Node-only code paths.
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /^node:(fs|https|http|path|os|crypto)$/ }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.aschool.com.np",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
  },
  async rewrites() {
    const apiBase = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${apiBase}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
