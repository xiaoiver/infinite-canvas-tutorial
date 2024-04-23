import { defineConfig } from 'vitepress';

export const en = defineConfig({
  lang: 'en-US',
  title: 'An infinite canvas tutorial',
  description: 'An infinite canvas tutorial.',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Lessons', link: '/lesson-001' },
    ],

    sidebar: [
      {
        text: 'Lessons',
        items: [
          { text: 'Lesson 001 - Initialize canvas', link: '/lesson-001' },
          { text: 'Lesson 002 - Draw a circle', link: '/lesson-002' },
          {
            text: 'Lesson 003 - Scene graph and transform',
            link: '/lesson-003',
          },
          { text: 'Lesson 004 - Camera', link: '/lesson-004' },
          { text: 'Lesson 005 - Grid', link: '/lesson-005' },
          { text: 'Lesson 006 - Event system', link: '/lesson-006' },
        ],
      },
    ],
  },
});
