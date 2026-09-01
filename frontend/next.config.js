/** @type {import('next').NextConfig} */
const nextConfig = {
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
