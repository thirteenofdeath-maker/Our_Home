import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.6"],
  experimental: {
    // Allows multipart overhead; feature validators enforce the exact 15 MB file limit.
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;