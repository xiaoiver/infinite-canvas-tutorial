import { defineConfig } from 'vitepress';
import config from 'genji-theme-vitepress/config';
// import implicitFigures from 'markdown-it-implicit-figures';
import { shared } from './shared';
import { en } from './en';
import { zh } from './zh';

export default defineConfig({
  // markdown: {
  //   config: (md) => {
  //     md.use(implicitFigures, {
  //       figcaption: true,
  //       copyAttrs: '^class$',
  //     });
  //   },
  // },
  extends: config,
  ...shared,
  locales: {
    en: { label: 'English', ...en },
    zh: { label: '简体中文', ...zh },
  },
  vite: {
    optimizeDeps: {
      include: [
        'genji-theme-vitepress > esprima',
        'genji-theme-vitepress > estraverse',
      ],
    },
  },
});
