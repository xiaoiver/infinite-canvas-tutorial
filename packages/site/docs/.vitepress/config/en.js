import { defineConfig } from 'vitepress';

export const en = defineConfig({
  lang: 'en-US',
  title: 'An infinite canvas tutorial',
  description: 'An infinite canvas tutorial.',
  themeConfig: {
    nav: [
      { text: 'Lessons', link: '/lesson-001' },
      { text: 'Demo', link: '/solar-system' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          {
            text: 'What is an infinite canvas?',
            link: '/what-is-an-infinite-canvas',
          },
        ],
      },
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
          { text: 'Lesson 007 - Web UI', link: '/lesson-007' },
          { text: 'Lesson 007 - Optimize performance', link: '/lesson-008' },
        ],
      },
      {
        text: 'Demo',
        items: [
          { text: 'A polar system', link: '/solar-system' },
          { text: 'Reduce draw calls with culling', link: '/culling' },
        ],
      },
    ],
  },
});
