import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export const shared = defineConfig({
  title: 'An infinite canvas tutorial',
  //   locales: {
  //     root: {
  //       label: 'English',
  //       lang: 'en',
  //     },
  //     zh: {
  //       label: '简体中文',
  //       lang: 'zh-Hans',
  //     },
  //   },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    // nav: [
    //   { text: 'Home', link: '/' },
    //   { text: 'Lessons', link: '/lesson-001' },
    // ],

    // sidebar: [
    //   {
    //     text: 'Lessons',
    //     items: [
    //       { text: 'Lesson 001', link: '/lesson-001' },
    //       { text: 'Lesson 002', link: '/lesson-002' },
    //     ],
    //   },
    // ],

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/xiaoiver/infinite-canvas-tutorial',
      },
    ],
  },
});
