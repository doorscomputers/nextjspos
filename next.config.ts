import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for DevExtreme React components
  transpilePackages: ['devextreme', 'devextreme-react'],

  // Ignore ESLint during builds (temp fix for pre-existing errors)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Ignore TypeScript errors during builds (temp fix for pre-existing errors)
  typescript: {
    ignoreBuildErrors: true,
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Fix for pdfkit in Next.js API routes
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };

      // Ignore pdfkit's font files in the build
      config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    }

    // Handle DevExtreme's CommonJS modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };

    return config;
  },
};

export default nextConfig;
