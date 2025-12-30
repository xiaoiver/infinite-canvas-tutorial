import { defineConfig } from 'vitepress';
import { search } from './zh';

const title = 'Infinite Canvas Tutorial';
const description =
  'An in-depth and open-source infinite canvas tutorial built with HTML5 Canvas, WebGL/WebGPU, ECS, SDF rendering, collaboration via CRDT/Yjs—empowering developers to craft Figma‑like interactive workspaces.';

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
  },
  head: [
    // [
    //   'link',
    //   { rel: 'icon', type: 'image/svg+xml', href: '/vitepress-logo-mini.svg' },
    // ],
    ['link', { rel: 'icon', type: 'image/png', href: '/canvas-mini.png' }],
    ['meta', { name: 'theme-color', content: '#5f67ee' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en-US' }],
    ['meta', { property: 'og:title', content: 'Infinite Canvas Tutorial' }],
    ['meta', { property: 'og:site', content: 'https://infinitecanvas.cc' }],
    ['meta', { property: 'og:site_name', content: 'Infinite Canvas Tutorial' }],
    [
      'meta',
      {
        property: 'og:image',
        content: 'https://infinitecanvas.cc/canvas.png',
      },
    ],
    ['meta', { property: 'og:url', content: 'https://infinitecanvas.cc' }],
    ['meta', { property: 'og:description', content: description }],

    // Twitter
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:site', content: '@YuqiP45780' }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: description }],
  ],
  // @see https://vitepress.dev/reference/site-config#example-adding-a-canonical-url-link
  transformPageData(pageData) {
    const canonicalUrl = `https://infinitecanvas.cc/${pageData.relativePath}`
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '.html');

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push([
      'link',
      { rel: 'canonical', href: canonicalUrl },
    ]);
  },
  ignoreDeadLinks: true,
});
