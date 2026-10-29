import { statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cloudflare Pages rejects a deployment when any one file is 25 MiB or larger.
 * `vitepress-plugin-rss` writes a single `feed.rss` into the site output.
 */
export const CLOUDFLARE_PAGES_MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * Hard cap for each item summary. Page count can grow; this bound cannot,
 * so the feed stays far under the Pages limit without dropping items.
 */
export const RSS_SUMMARY_MAX_CHARS = 360;

/**
 * RSS options for vitepress-plugin-rss@0.2.10.
 *
 * The plugin's default `renderHTML: true` renders every Markdown page to HTML
 * and stores that HTML in `content:encoded`. Shiki and MathJax expand the
 * four locales into one ~37.7 MiB file. `renderHTML: false` omits that element.
 * `renderExpect` supplies the item description (frontmatter summary, otherwise
 * a short plain-text excerpt).
 */
export const rssPluginOptions = {
  title: 'An infinite canvas tutorial',
  description:
    'An in-depth open-source infinite canvas tutorial built with HTML5 Canvas, WebGL/WebGPU, and ECS.',
  baseUrl: 'https://infinitecanvas.cc',
  copyright: 'Copyright (c) 2024-present xiaoiver',
  author: {
    name: 'xiaoiver',
    email: 'pyqiverson@gmail.com',
    link: 'https://github.com/xiaoiver',
  },
  renderHTML: false,
  renderExpect(markdownBody, frontmatter) {
    return rssItemSummary(markdownBody, frontmatter);
  },
};

export function rssItemSummary(markdownBody, frontmatter = {}) {
  const described =
    typeof frontmatter.description === 'string'
      ? frontmatter.description.trim()
      : '';
  const summary = described || plainExcerpt(markdownBody);
  return summary.slice(0, RSS_SUMMARY_MAX_CHARS);
}

export function assertRssFeedWithinPagesLimit(bytes, filename = 'feed.rss') {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error(`${filename} size is not a valid byte length`);
  }
  if (bytes >= CLOUDFLARE_PAGES_MAX_FILE_BYTES) {
    const mib = (bytes / (1024 * 1024)).toFixed(2);
    throw new Error(
      `${filename} is ${bytes} bytes (${mib} MiB), which meets or exceeds Cloudflare Pages' 25 MiB per-file upload limit. Keep the feed summary-only (renderHTML: false).`,
    );
  }
  return bytes;
}

export function assertRssFeedFileWithinPagesLimit(
  outDir,
  filename = 'feed.rss',
) {
  const bytes = statSync(join(outDir, filename)).size;
  return assertRssFeedWithinPagesLimit(bytes, filename);
}

/**
 * Vite plugin that runs after `vitepress-plugin-rss` writes `feed.rss`.
 * Fails the site build (Vercel and Pages) before a too-large file can ship.
 */
export function rssFeedSizeGuardPlugin() {
  let wrapped = false;
  return {
    name: 'rss-feed-size-guard',
    enforce: 'post',
    configResolved(config) {
      if (wrapped) return;
      const vp = config.vitepress;
      if (!vp) return;
      wrapped = true;
      const previousBuildEnd = vp.buildEnd;
      vp.buildEnd = async (siteConfig) => {
        if (previousBuildEnd) await previousBuildEnd(siteConfig);
        const bytes = assertRssFeedFileWithinPagesLimit(siteConfig.outDir);
        const mib = (bytes / (1024 * 1024)).toFixed(2);
        console.log(
          `feed.rss ${mib} MiB, under Cloudflare Pages' 25 MiB per-file limit`,
        );
      };
    },
  };
}

function plainExcerpt(markdown) {
  const withoutFences = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ');
  return withoutFences
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*:::.*$/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, RSS_SUMMARY_MAX_CHARS);
}
