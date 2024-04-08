import { defineConfig } from 'vitepress';
import config from 'genji-theme-vitepress/config';
import { shared } from './shared';
import { en } from './en';
import { zh } from './zh';

export default defineConfig({
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
