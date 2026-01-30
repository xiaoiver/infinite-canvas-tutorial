import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  /* config options here */
  // reactStrictMode: false,
  // 告诉 Next.js 包含这些本地包
  transpilePackages: [
    "@infinite-canvas-tutorial/ecs",
    "@infinite-canvas-tutorial/webcomponents",
    "@infinite-canvas-tutorial/fal-ai",
    "@infinite-canvas-tutorial/sam",
    "@infinite-canvas-tutorial/laser-pointer",
    "@infinite-canvas-tutorial/lasso",
    "@infinite-canvas-tutorial/eraser",
  ],
  output: 'standalone',
};

export default withNextIntl(nextConfig);