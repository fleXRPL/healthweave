import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  env: {
    API_URL: process.env.API_URL || 'http://localhost:4000',
  },
};

export default nextConfig;
