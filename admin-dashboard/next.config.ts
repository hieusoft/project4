import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://kong:8000/api/:path*", // Proxy to Kong API Gateway
      },
    ];
  },
};

export default nextConfig;
