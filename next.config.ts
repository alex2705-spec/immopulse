import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/', destination: '/landing.html' },
    ]
  },
  async headers() {
    return [
      {
        source: '/carte',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; worker-src * blob:;",
          },
        ],
      },
    ]
  },
};

export default nextConfig;