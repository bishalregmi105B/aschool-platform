/** @type {import('next').NextConfig} */
const nextConfig = {
  // isomorphic-dompurify -> jsdom reads files from its own package dir at
  // import time; it must be require()d at runtime, not webpack-bundled.
  experimental: {
    serverComponentsExternalPackages: ["isomorphic-dompurify", "jsdom"],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // pptxgenjs lazy-imports node:fs / node:https at runtime behind an
      // isNode guard — never taken in the browser. Stub them so the client
      // bundle builds; a checked-in empty shim provides the module.
      const empty = require("path").resolve(__dirname, "src/shims/empty.js");
      config.resolve.alias = {
        ...config.resolve.alias,
        "node:fs": empty,
        "node:https": empty,
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: empty,
        https: empty,
        http: empty,
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
