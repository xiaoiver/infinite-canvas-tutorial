import { defineConfig } from 'vitepress';
import vueJsx from '@vitejs/plugin-vue-jsx';
import VueMacros from 'unplugin-vue-macros/vite';
import { genjiAttrs } from 'genji-theme-vitepress/config';
import config from 'genji-theme-vitepress/config';
import implicitFigures from 'markdown-it-implicit-figures';
import mathjax3 from 'markdown-it-mathjax3';
import { RssPlugin } from 'vitepress-plugin-rss';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { shared } from './shared';
import { en } from './en';
import { zh } from './zh';
import { ko } from './ko';

export default defineConfig({
  markdown: {
    config: (md) => {
      md.use(implicitFigures, {
        figcaption: true,
        copyAttrs: '^class$',
      });
      md.use(genjiAttrs);
    },
    math: true,
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
    ko: { label: '한국어', ...ko },
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
    // @see https://github.com/adobe/spectrum-web-components/issues/4268
    define: { 'window.__swc.DEBUG': 'false' },
    ssr: {
      noExternal: [
        '@antv/g-device-api',
        '@antv/hierarchy',
        'ant-design-vue',
        '@ant-design/icons-vue',
        'perfect-cursors',
        'onnxruntime-web',
      ],
    },
    optimizeDeps: {
      exclude: [
        '@spectrum-web-components',
        '@infinite-canvas-tutorial/webcomponents',
      ],
    },
    plugins: [
      VueMacros({
        plugins: {
          vueJsx: vueJsx(),
        },
      }),
      RssPlugin({
        title: 'An infinite canvas tutorial',
        baseUrl: 'https://infinitecanvas.cc',
        copyright: 'Copyright (c) 2024-present xiaoiver',
        author: {
          name: 'xiaoiver',
          email: 'pyqiverson@gmail.com',
          link: 'https://github.com/xiaoiver',
        },
      }),
      wasm(),
      topLevelAwait(),
    ],
  },
});
