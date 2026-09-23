import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@printcast/contracts", "@printcast/db"],
  poweredByHeader: false,
};

export default nextConfig;
