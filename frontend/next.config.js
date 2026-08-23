/** @type {import('next').NextConfig} */
const nextConfig = {
  // isomorphic-dompurify -> jsdom reads files from its own package dir at
  // import time; it must be require()d at runtime, not webpack-bundled.
  experimental: {
    serverComponentsExternalPackages: ["isomorphic-dompurify", "jsdom"],
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
