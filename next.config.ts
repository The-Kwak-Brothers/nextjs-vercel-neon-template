import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Selfhosted: Vercel Image Optimization is unavailable; keep unoptimized by default.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
