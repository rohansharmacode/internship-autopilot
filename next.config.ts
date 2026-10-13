import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "unpdf"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
