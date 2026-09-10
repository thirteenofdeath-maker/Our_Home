import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allows multipart overhead; feature validators enforce the exact 15 MB file limit.
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
