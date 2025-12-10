import { defineConfig } from 'vitepress';

export const en = defineConfig({
  lang: 'en-US',
  title: 'An infinite canvas tutorial',
  description:
    'An in-depth and open-source infinite canvas tutorial built with HTML5 Canvas, WebGL/WebGPU, ECS, SDF rendering, collaboration via CRDT/Yjs—empowering developers to craft Figma‑like interactive workspaces.',
  keywords: ['infinite canvas', 'canvas', 'webgl', 'webgpu', 'ecs'],
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
      {
        text: 'Experiment',
        link: '/experiment/particles',
        activeMatch: '/experiment/',
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
              { text: 'Lesson 017 - Gradient and pattern', link: 'lesson-017' },
              { text: 'Lesson 018 - Refactor with ECS', link: 'lesson-018' },
              {
                text: 'Lesson 019 - History',
                link: 'lesson-019',
              },
              {
                text: 'Lesson 020 - Collaboration',
                link: 'lesson-020',
              },
              {
                text: 'Lesson 021 - Transformer',
                link: 'lesson-021',
              },
              {
                text: 'Lesson 022 - VectorNetwork',
                link: 'lesson-022',
              },
              {
                text: 'Lesson 023 - Mindmap',
                link: 'lesson-023',
              },
              {
                text: 'Lesson 024 - Context menu and clipboard',
                link: 'lesson-024',
              },
              {
                text: 'Lesson 025 - Drawing mode and brush',
                link: 'lesson-025',
              },
              {
                text: 'Lesson 026 - Selection tool',
                link: 'lesson-026',
              },
              {
                text: 'Lesson 027 - Snap and align',
                link: 'lesson-027',
              },
              {
                text: 'Lesson 028 - Integrating with AI',
                link: 'lesson-028',
              },
              {
                text: 'Lesson 029 - Embedding HTML content',
                link: 'lesson-029',
              },
              {
                text: 'Lesson 030 - Post-processing and render graph',
                link: 'lesson-030',
              },
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
            text: 'Create app',
            link: 'create-app',
          },
          {
            text: 'API',
            items: [
              {
                text: 'Canvas',
                link: 'canvas',
              },
              {
                text: 'Camera',
                link: 'camera',
              },
              {
                text: 'Export image',
                link: 'export-image',
              },
              {
                text: 'AI',
                link: 'ai',
              },
            ],
          },
          {
            text: 'Plugins',
            items: [
              { text: 'fal.ai', link: 'fal' },
              { text: 'Segment Anything Model', link: 'sam' },
            ],
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
              { text: 'RoughCircle', link: 'rough-circle' },
              { text: 'RoughEllipse', link: 'rough-ellipse' },
              { text: 'RoughRect', link: 'rough-rect' },
              { text: 'RoughPolyline', link: 'rough-polyline' },
              { text: 'RoughPath', link: 'rough-path' },
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
                text: 'Wikipedia datamap',
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
                text: 'Text',
                items: [
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
                    text: 'Text baseline',
                    link: 'text-baseline',
                  },
                  {
                    text: 'Text drop shadow',
                    link: 'text-dropshadow',
                  },
                  {
                    text: 'Text stroke',
                    link: 'text-stroke',
                  },
                  {
                    text: 'Text decoration',
                    link: 'text-decoration',
                  },
                  {
                    text: 'Text path',
                    link: 'text-path',
                  },
                  {
                    text: 'Physical text',
                    link: 'physical-text',
                  },
                  {
                    text: 'Load web font',
                    link: 'web-font-loader',
                  },
                  {
                    text: 'Render TeX math',
                    link: 'tex-math',
                  },
                  {
                    text: 'Text editor',
                    link: 'text-editor',
                  },
                ],
              },
              {
                text: 'Web Animations API',
                link: 'web-animations-api',
              },
              {
                text: 'Select canvas mode',
                link: 'canvas-mode-select',
              },
              {
                text: 'Adjust z-index with bring to front and send to back',
                link: 'zindex',
              },
              {
                text: 'Drag and drop image',
                link: 'dragndrop-image',
              },
              {
                text: 'Declarative gradient',
                link: 'declarative-gradient',
              },
              {
                text: 'Pattern',
                link: 'pattern',
              },
              {
                text: 'Image processing',
                link: 'image-processing',
              },
              {
                text: 'Mindmap and layout',
                items: [
                  {
                    text: 'Mindmap',
                    link: 'mindmap',
                  },
                  {
                    text: 'Tree',
                    link: 'tree',
                  },
                  {
                    text: 'FlexTree',
                    link: 'flextree',
                  },
                ],
              },
              {
                text: 'Draw rect',
                link: 'draw-rect',
              },
              {
                text: 'HTML and embeded content',
                items: [
                  {
                    text: 'HTML content',
                    link: 'html',
                  },
                  {
                    text: 'YouTube',
                    link: 'iframe',
                  },
                ],
              },
              {
                text: 'Collaboration',
                items: [
                  {
                    text: 'Loro',
                    link: 'loro',
                  },
                  {
                    text: 'Yjs',
                    link: 'yjs',
                  },
                  {
                    text: 'Liveblocks',
                    link: 'liveblocks',
                  },
                  {
                    text: 'Perfect Cursors',
                    link: 'perfect-cursors',
                  },
                  {
                    text: 'Comments Overlay',
                    link: 'comments-overlay',
                  },
                ],
              },
            ],
          },
        ],
      },
      '/experiment/': {
        base: '/experiment/',
        items: [
          { text: 'Use WebGPU to draw particles', link: 'particles' },
          { text: 'Programmatic Gradient', link: 'gradient' },
          { text: 'Mesh Gradient', link: 'mesh-gradient' },
          { text: 'Voronoi', link: 'voronoi' },
          { text: 'Fractal Brownian Motion', link: 'fractal-brownian-motion' },
          { text: 'Domain Warping', link: 'domain-warping' },
          {
            text: 'Pythagorean theorem',
            link: 'pythagorean-theorem',
          },
          { text: 'A textual artistic effect', link: 'signature' },
          { text: 'When canvas meets chat', link: 'when-canvas-meets-chat' },
          {
            text: 'Use SAM in WebWorker for image segmentation',
            link: 'sam-in-worker',
          },
          { text: 'Audio visualizer', link: 'audio-visualizer' },
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
