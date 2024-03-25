import { defineConfig } from 'vitepress';

export const en = defineConfig({
  lang: 'en-US',
  description: 'An infinite canvas tutorial.',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/en' },
      { text: 'Lessons', link: '/en/lesson-001' },
    ],

    sidebar: [
      {
        text: 'Lessons',
        items: [
          { text: 'Lesson 001', link: '/en/lesson-001' },
          { text: 'Lesson 002', link: '/en/lesson-002' },
        ],
      },
    ],
  },
});
