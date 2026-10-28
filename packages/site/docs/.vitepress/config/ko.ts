import { defineConfig } from 'vitepress';

export const ko = defineConfig({
  lang: 'ko-KR',
  title: '무한 캔버스 튜토리얼',
  description:
    'HTML5 Canvas, WebGL/WebGPU, ECS, SDF 렌더링, CRDT/Yjs를 이용한 협업 등 Figma와 같은 인터렉티브 워크스페이스를 만들기 위한 심층적인 오픈소스 무한 캔버스 튜토리얼입니다.',
  keywords: ['무한 캔버스', '캔버스', 'webgl', 'webgpu', 'ecs'],
  themeConfig: {
    nav: [
      { text: 'App', link: 'https://app.infinitecanvas.cc/' },
      {
        text: '가이드',
        link: '/ko/guide/lesson-001',
        activeMatch: '/ko/guide/',
      },
      { text: 'English', link: '/guide/what-is-an-infinite-canvas' },
      { text: '简体中文', link: '/zh/guide/what-is-an-infinite-canvas' },
    ],

    // Only lessons 001–004 exist under docs/ko. Untranslated routes 404, so the
    // sidebar does not list example, reference, experiment, or later lessons.
    sidebar: {
      '/ko/guide/': {
        base: '/ko/guide/',
        items: [
          {
            text: '강의',
            items: [
              {
                text: '강의 001 - 캔버스 초기화',
                link: 'lesson-001',
              },
              { text: '강의 002 - 원 그리기', link: 'lesson-002' },
              {
                text: '강의 003 - 씬 그래프와 변환',
                link: 'lesson-003',
              },
              { text: '강의 004 - 카메라', link: 'lesson-004' },
            ],
          },
        ],
      },
    },

    editLink: {
      pattern:
        'https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/packages/site/docs/:path',
      text: 'GitHub에서 이 페이지 수정하기',
    },
  },
});
