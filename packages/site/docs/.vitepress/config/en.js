import { defineConfig } from 'vitepress';

export const en = defineConfig({
  lang: 'en-US',
  title: 'An infinite canvas tutorial',
  description: 'An infinite canvas tutorial.',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/lesson-001', activeMatch: '/guide/' },
      {
        text: 'Example',
        link: '/example/solar-system',
        activeMatch: '/example/',
      },
      {
        text: 'Reference',
        link: '/reference/canvas',
        activeMatch: '/reference/',
      },
    ],

    sidebar: {
      '/guide/': {
        base: '/guide/',
        items: [
          {
            text: 'Introduction',
            items: [
              {
                text: 'What is an infinite canvas?',
                link: 'what-is-an-infinite-canvas',
              },
            ],
          },
          {
            text: 'Lessons',
            items: [
              {
                text: 'Lesson 001 - Initialize canvas',
                link: 'lesson-001',
              },
              { text: 'Lesson 002 - Draw a circle', link: 'lesson-002' },
              {
                text: 'Lesson 003 - Scene graph and transform',
                link: 'lesson-003',
              },
              { text: 'Lesson 004 - Camera', link: 'lesson-004' },
              { text: 'Lesson 005 - Grid', link: 'lesson-005' },
              { text: 'Lesson 006 - Event system', link: 'lesson-006' },
              { text: 'Lesson 007 - Web UI', link: 'lesson-007' },
              {
                text: 'Lesson 008 - Optimize performance',
                link: 'lesson-008',
              },
              {
                text: 'Lesson 009 - Draw ellipse and rectangle',
                link: 'lesson-009',
              },
              {
                text: 'Lesson 010 - Import and export images',
                link: 'lesson-010',
              },
              {
                text: 'Lesson 011 - Test and server-side rendering',
                link: 'lesson-011',
              },
              { text: 'Lesson 012 - Draw polyline', link: 'lesson-012' },
              {
                text: 'Lesson 013 - Draw path and sketchy style',
                link: 'lesson-013',
              },
              {
                text: 'Lesson 014 - Canvas mode and auxiliary UI',
                link: 'lesson-014',
              },
              { text: 'Lesson 015 - Text rendering', link: 'lesson-015' },
              {
                text: 'Lesson 016 - Text advanced features',
                link: 'lesson-016',
              },
              { text: 'Lesson 017 - Collaborative', link: 'lesson-017' },
            ],
          },
        ],
      },
      '/reference/': {
        base: '/reference/',
        items: [
          {
            text: 'Environment adapter',
            link: 'environment',
          },
          {
            text: 'Canvas',
            link: 'canvas',
          },
          {
            text: 'Camera',
            link: 'camera',
          },
          {
            text: 'Shape',
            items: [
              { text: 'Shape', link: 'shape' },
              { text: 'Group', link: 'group' },
              { text: 'Circle', link: 'circle' },
              { text: 'Ellipse', link: 'ellipse' },
              { text: 'Rect', link: 'rect' },
              { text: 'Polyline', link: 'polyline' },
              { text: 'Path', link: 'path' },
              { text: 'Text', link: 'text' },
            ],
          },
        ],
      },
      '/example/': {
        base: '/example/',
        items: [
          {
            text: 'Example',
            items: [
              { text: 'WebGPU', link: 'webgpu' },
              { text: 'A polar system', link: 'solar-system' },
              {
                text: 'Reduce draw calls with culling',
                link: 'culling',
              },
              {
                text: 'Reduce draw calls with instanced array',
                link: 'instanced',
              },
              {
                text: 'Optimize picking performance with RBush',
                link: 'picking',
              },
              {
                text: 'Render a Rect',
                link: 'rect',
              },
              {
                text: 'Render a rounded rect with shadow',
                link: 'rounded-rectangle-shadow',
              },
              {
                text: 'Render canvas in WebWorker',
                link: 'webworker',
              },
              {
                text: 'Export canvas content as image',
                link: 'exporter',
              },
              {
                text: 'Import SVG',
                link: 'import-svg',
              },
              {
                text: 'Wikipedia Datamap',
                link: 'wikipedia-datamap',
              },
              {
                text: 'Rough shapes',
                link: 'rough',
              },
              {
                text: 'Wireframe',
                link: 'wireframe',
              },
              {
                text: 'Draw holes in Path',
                link: 'holes',
              },
              {
                text: 'Fill rule',
                link: 'fill-rule',
              },
              {
                text: 'Use SDF to draw text',
                link: 'sdf-text',
              },
              {
                text: 'Use Bitmap Font to draw text',
                link: 'bitmap-font',
              },
              {
                text: 'Use MSDF to draw text',
                link: 'msdf-text',
              },
              {
                text: 'Draw emoji',
                link: 'emoji',
              },
              {
                text: 'Draw bidirectional text',
                link: 'bidi',
              },
              {
                text: 'Shaping with HarfBuzz',
                link: 'harfbuzz',
              },
              {
                text: 'Shaping with Opentype.js',
                link: 'opentype',
              },
              {
                text: 'Text Baseline',
                link: 'text-baseline',
              },
              {
                text: 'Load web font',
                link: 'web-font-loader',
              },
              {
                text: 'Pythagorean theorem',
                link: 'pythagorean-theorem',
              },
              {
                text: 'Render TeX math',
                link: 'tex-math',
              },
              {
                text: 'Web Animations API',
                link: 'web-animations-api',
              },
            ],
          },
        ],
      },
    },

    editLink: {
      pattern:
        'https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/packages/site/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
