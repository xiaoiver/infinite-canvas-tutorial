import { defineConfig } from 'vitepress';

export const en = defineConfig({
  lang: 'en-US',
  title: 'An infinite canvas tutorial',
  description: 'An infinite canvas tutorial.',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/en/' },
      { text: 'Lessons', link: '/en/lesson-001' },
    ],

    sidebar: [
      {
        text: 'Lessons',
        items: [
          { text: 'Lesson 001', link: '/en/lesson-001' },
          { text: 'Lesson 002', link: '/en/lesson-002' },
          { text: 'Lesson 003', link: '/en/lesson-003' },
          { text: 'Lesson 004', link: '/en/lesson-004' },
          { text: 'Lesson 005', link: '/en/lesson-005' },
          { text: 'Lesson 006', link: '/en/lesson-006' },
        ],
      },
    ],
  },
});
