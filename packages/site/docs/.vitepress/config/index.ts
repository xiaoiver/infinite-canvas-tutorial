import { defineConfig } from 'vitepress';
import vueJsx from '@vitejs/plugin-vue-jsx';
import VueMacros from 'unplugin-vue-macros/vite';
import { genjiAttrs } from 'genji-theme-vitepress/config';
import config from 'genji-theme-vitepress/config';
import implicitFigures from 'markdown-it-implicit-figures';
import { RssPlugin } from 'vitepress-plugin-rss';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { adsenseClient, shared } from './shared';
import { rssFeedSizeGuardPlugin, rssPluginOptions } from './rss-feed.mjs';
import { en } from './en';
import { zh } from './zh';
import { ko } from './ko';
import { ja } from './ja';
import { zhHant } from './zh-Hant';
import { es } from './es';
import { ptBR } from './pt-BR';
import { resolve } from 'path';
import { writeAdsTxt } from '../adsense-ads-txt';
import { buildWorkflowExample, workflowExample } from './workflow-example';

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
  async buildEnd(siteConfig) {
    writeAdsTxt(siteConfig.outDir);
    await buildWorkflowExample(siteConfig.outDir);
  },
  ...shared,
  locales: {
    root: {
      label: 'English',
      ...en,
    },
    zh: { label: '简体中文', ...zh },
    'zh-Hant': { label: '繁體中文', ...zhHant },
    ko: { label: '한국어', ...ko },
    ja: { label: '日本語', ...ja },
    es: { label: 'Español', ...es },
    'pt-BR': { label: 'Português (Brasil)', ...ptBR },
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
    optimizeDeps: { exclude: ['@infinite-canvas-tutorial/device-api'] },
    // d3-color Hoisting problem: color is undefined
    resolve: {
      alias: [
        {
          find: 'd3-color',
          replacement: resolve(
            __dirname,
            '../../../node_modules/d3-color/dist/d3-color.min.js',
          ),
        },
      ],
    },
    build: {
      chunkSizeWarningLimit: 800,
    },
    // @see https://github.com/adobe/spectrum-web-components/issues/4268
    define: {
      'window.__swc.DEBUG': 'false',
      'import.meta.env.VITE_ADSENSE_CLIENT': JSON.stringify(
        adsenseClient ?? '',
      ),
    },
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
    plugins: [
      workflowExample(),
      VueMacros({
        plugins: {
          vueJsx: vueJsx(),
        },
      }),
      RssPlugin(rssPluginOptions),
      rssFeedSizeGuardPlugin(),
      wasm(),
      topLevelAwait(),
    ],
  },
});
