import { defineConfig } from 'vitepress';
import { search } from './zh';

// https://vitepress.dev/reference/site-config
export const shared = defineConfig({
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/xiaoiver/infinite-canvas-tutorial',
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
    ['meta', { property: 'og:locale', content: 'en' }],
    ['meta', { property: 'og:title', content: 'Infinite Canvas Tutorial' }],
    ['meta', { property: 'og:site_name', content: 'Infinite Canvas Tutorial' }],
    [
      'meta',
      {
        property: 'og:image',
        content: 'https://infinitecanvas.cc/canvas.png',
      },
    ],
    ['meta', { property: 'og:url', content: 'https://infinitecanvas.cc' }],
  ],
});
