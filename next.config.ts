import path from "node:path";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // A package-lock.json exists in a parent folder on some machines; pin the project root so
  // Turbopack and output tracing never resolve files outside this repository.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
  // sweph is a native AGPL-licensed addon that is only loaded when the operator
  // explicitly selects the Swiss Ephemeris provider; never bundle it.
  serverExternalPackages: ["sweph"],
  // sweph is a devDependency (installed for the build, used only by local reference tests).
  // Keep it and the Swiss data files out of every deployed function so production ships
  // no AGPL code. Selecting EPHEMERIS_PROVIDER=swiss-ephemeris therefore requires a
  // licence decision first: move sweph to dependencies and remove these excludes.
  outputFileTracingExcludes: {
    "/*": ["./node_modules/sweph/**/*", "./tools/reference/ephe/**/*"],
    "/**/*": ["./node_modules/sweph/**/*", "./tools/reference/ephe/**/*"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
