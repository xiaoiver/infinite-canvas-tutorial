import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/**
 * 将 bewsy 解析到单一物理包，避免打进去多份导致 `SystemGroupImpl` 的 `instanceof` 失败
 *（见 dispatcher splitDefs: "Unexpected value in world defs"）。
 * 需配合 `pnpm run build`（`next build --webpack`）才会走下面 webpack 的 resolve.alias。
 */
const require = createRequire(import.meta.url);
const appDir = path.dirname(fileURLToPath(import.meta.url));

function resolveBecsyDir(): string {
  for (const base of [appDir, path.join(appDir, "../ecs")]) {
    try {
      return path.dirname(
        require.resolve("@lastolivegames/becsy/package.json", { paths: [base] })
      );
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "无法解析 @lastolivegames/becsy：请在仓库根目录执行 pnpm install，并勿用 sudo 安装依赖。"
  );
}

const becsyDir = resolveBecsyDir();

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  // 告诉 Next.js 包含这些本地包
  transpilePackages: [
    "@infinite-canvas-tutorial/ecs",
    "@infinite-canvas-tutorial/webcomponents",
    "@infinite-canvas-tutorial/fal-ai",
    "@infinite-canvas-tutorial/sam",
    "@infinite-canvas-tutorial/laser-pointer",
    "@infinite-canvas-tutorial/lasso",
    "@infinite-canvas-tutorial/eraser",
    "@infinite-canvas-tutorial/yoga",
  ],
  // output: 'standalone',
  serverExternalPackages: ['@neplex/vectorizer'],
  productionBrowserSourceMaps: true,
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    const alias = config.resolve.alias;
    if (Array.isArray(alias)) {
      alias.push({ name: "@lastolivegames/becsy", alias: becsyDir });
    } else {
      config.resolve.alias = { ...alias, "@lastolivegames/becsy": becsyDir };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
