import { defineConfig } from 'vitepress';
import { applyPageSeo, filterSitemapItems } from './seo';
import { search } from './zh';
import { search as searchKo } from './ko';
import { search as searchJa } from './ja';
import { search as searchZhHant } from './zh-Hant';
import { search as searchEs } from './es';
import { search as searchPtBR } from './pt-BR';

export const adsenseClient =
  process.env.ADSENSE_ENABLED === 'true'
    ? process.env.ADSENSE_CLIENT?.trim()
    : undefined;

// https://vitepress.dev/reference/site-config
export const shared = defineConfig({
  themeConfig: {
    lastUpdated: true,
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/xiaoiver/infinite-canvas-tutorial',
      },
      {
        icon: 'twitter',
        link: 'https://x.com/YuqiP45780',
      },
    ],
    search: {
      provider: 'algolia',
      options: {
        appId: 'OYCRGBDY7H',
        apiKey: 'c791695123f3eabfb4fd085687cc2ea6',
        indexName: 'infinitecanvas',
        locales: {
          zh: search,
          'zh-Hant': searchZhHant,
          ko: searchKo,
          ja: searchJa,
          es: searchEs,
          'pt-BR': searchPtBR,
        },
      },
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Yuqi Pan',
    },
  },
  sitemap: {
    hostname: 'https://infinitecanvas.cc',
    transformItems(items) {
      return filterSitemapItems(items);
    },
  },
  head: [
    // [
    //   'link',
    //   { rel: 'icon', type: 'image/svg+xml', href: '/vitepress-logo-mini.svg' },
    // ],
    ['link', { rel: 'icon', type: 'image/png', href: '/canvas-mini.png' }],
    ['meta', { name: 'theme-color', content: '#5f67ee' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site', content: 'https://infinitecanvas.cc' }],
    ['meta', { property: 'og:site_name', content: 'Infinite Canvas Tutorial' }],
    [
      'meta',
      {
        property: 'og:image',
        content: 'https://infinitecanvas.cc/canvas.png',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:site', content: '@YuqiP45780' }],
    [
      'meta',
      {
        name: 'twitter:image',
        content: 'https://infinitecanvas.cc/canvas.png',
      },
    ],
  ],
  // Per-page canonical, Open Graph, Twitter, and hreflang. Runs in dev and SSG,
  // so client navigations and crawlers see the same tags. cleanUrls stays extensionless.
  transformPageData(pageData, { siteConfig }) {
    applyPageSeo(pageData, {
      pages: siteConfig.pages,
      cleanUrls: siteConfig.cleanUrls === true,
      rewrites: siteConfig.rewrites,
    });
  },
  ignoreDeadLinks: true,
});
