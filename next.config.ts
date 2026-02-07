import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Generate unique build IDs to bust cache on new deployments
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },

  // Ensure test data is bundled for API routes
  outputFileTracingIncludes: {
    '/api/admin/migrate-ans': ['./data/ans/**/*'],
    '/api/test-event': ['./data/ans/**/*'],
    '/api/test-data/**/*': ['./data/ans/**/*'],
  },

  // Custom headers to control caching behavior
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            // No caching for HTML pages - always fetch fresh
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        // Static assets can be cached with revalidation
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes - no caching
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
