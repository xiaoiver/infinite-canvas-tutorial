import { defineConfig } from 'vitepress';
import { genjiAttrs } from 'genji-theme-vitepress/config';
import config from 'genji-theme-vitepress/config';
import implicitFigures from 'markdown-it-implicit-figures';
import { RssPlugin } from 'vitepress-plugin-rss';
import { shared } from './shared';
import { en } from './en';
import { zh } from './zh';

export default defineConfig({
  markdown: {
    config: (md) => {
      md.use(implicitFigures, {
        figcaption: true,
        copyAttrs: '^class$',
      });
      md.use(genjiAttrs);
    },
    math: true
  },
  cleanUrls: true,
  extends: config,
  ...shared,
  locales: {
    root: {
      label: 'English',
      ...en,
    },
    zh: { label: '简体中文', ...zh },
  },
  vue: {
    template: {
      compilerOptions: {
        // treat all tags with a dash as custom elements
        isCustomElement: (tag) => tag.includes('-'),
      },
    },
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 800,
    },
    ssr: {
      noExternal: ["@antv/g-device-api"]
    },
    plugins: [RssPlugin({
      title: 'An infinite canvas tutorial',
      baseUrl: 'https://infinitecanvas.cc',
      copyright: 'Copyright (c) 2024-present xiaoiver',
      author: {
        name: 'xiaoiver',
        email: 'pyqiverson@gmail.com',
        link: 'https://github.com/xiaoiver'
      },
    })]
  }
});
