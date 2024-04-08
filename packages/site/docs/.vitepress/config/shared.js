import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export const shared = defineConfig({
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/xiaoiver/infinite-canvas-tutorial',
      },
    ],
  },
});
