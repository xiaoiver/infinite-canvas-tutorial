import { defineConfig } from 'vitepress';

export const ko = defineConfig({
  lang: 'ko-KR',
  title: '무한 캔버스 튜토리얼',
  description:
    'HTML5 Canvas, WebGL/WebGPU, ECS, SDF 렌더링, CRDT/Yjs를 이용한 협업 등 Figma와 같은 인터렉티브 워크스페이스를 만들기 위한 심층적인 오픈소스 무한 캔버스 튜토리얼입니다.',
  keywords: ['무한 캔버스', '캔버스', 'webgl', 'webgpu', 'ecs'],
  themeConfig: {
    nav: [
      {
        text: '가이드',
        link: '/ko/guide/lesson-001',
        activeMatch: '/ko/guide/',
      },
      {
        text: '예제',
        link: '/ko/example/solar-system',
        activeMatch: '/ko/example/',
      },
      {
        text: '레퍼런스',
        link: '/ko/reference/canvas',
        activeMatch: '/ko/reference/',
      },
      {
        text: '실험실',
        link: '/ko/experiment/particles',
        activeMatch: '/ko/experiment/',
      },
    ],

    sidebar: {
      '/ko/guide/': {
        base: '/ko/guide/',
        items: [
          {
            text: '소개',
            items: [
              {
                text: '무한 캔버스란 무엇인가요?',
                link: 'what-is-an-infinite-canvas',
              },
            ],
          },
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
              { text: '강의 005 - 그리드', link: 'lesson-005' },
              { text: '강의 006 - 이벤트 시스템', link: 'lesson-006' },
              { text: '강의 007 - Web UI', link: 'lesson-007' },
              {
                text: '강의 008 - 성능 최적화',
                link: 'lesson-008',
              },
              {
                text: '강의 009 - 타원과 사각형 그리기',
                link: 'lesson-009',
              },
              {
                text: '강의 010 - 이미지 가져오기 및 내보내기',
                link: 'lesson-010',
              },
              {
                text: '강의 011 - 테스트와 서버 사이드 렌더링',
                link: 'lesson-011',
              },
              { text: '강의 012 - 폴리라인 그리기', link: 'lesson-012' },
              {
                text: '강의 013 - 패스 그리기와 스케치 스타일',
                link: 'lesson-013',
              },
              {
                text: '강의 014 - 캔버스 모드와 보조 UI',
                link: 'lesson-014',
              },
              { text: '강의 015 - 텍스트 렌더링', link: 'lesson-015' },
              {
                text: '강의 016 - 텍스트 고급 기능',
                link: 'lesson-016',
              },
              { text: '강의 017 - 그라디언트와 패턴', link: 'lesson-017' },
              { text: '강의 018 - ECS로 리팩토링', link: 'lesson-018' },
              {
                text: '강의 019 - 히스토리',
                link: 'lesson-019',
              },
              {
                text: '강의 020 - 협업',
                link: 'lesson-020',
              },
              {
                text: '강의 021 - 트랜스포머',
                link: 'lesson-021',
              },
              {
                text: '강의 022 - VectorNetwork',
                link: 'lesson-022',
              },
              {
                text: '강의 023 - 마인드맵',
                link: 'lesson-023',
              },
              {
                text: '강의 024 - 컨텍스트 메뉴와 클립보드',
                link: 'lesson-024',
              },
              {
                text: '강의 025 - 그리기 모드와 브러시',
                link: 'lesson-025',
              },
              {
                text: '강의 026 - 선택 도구',
                link: 'lesson-026',
              },
              {
                text: '강의 027 - 스냅과 정렬',
                link: 'lesson-027',
              },
              {
                text: '강의 028 - AI 통합',
                link: 'lesson-028',
              },
              {
                text: '강의 029 - HTML 콘텐츠 삽입',
                link: 'lesson-029',
              },
              {
                text: '강의 030 - 후처리 및 렌더 그래프',
                link: 'lesson-030',
              },
            ],
          },
        ],
      },
      '/ko/reference/': {
        base: '/ko/reference/',
        items: [
          {
            text: '환경 어댑터',
            link: 'environment',
          },
          {
            text: '앱 생성',
            link: 'create-app',
          },
          {
            text: 'API',
            items: [
              {
                text: '캔버스',
                link: 'canvas',
              },
              {
                text: '카메라',
                link: 'camera',
              },
              {
                text: '펜',
                link: 'pen',
              },
              {
                text: '이미지 내보내기',
                link: 'export-image',
              },
              {
                text: 'AI',
                link: 'ai',
              },
            ],
          },
          {
            text: '플러그인',
            items: [
              { text: '채팅', link: 'chat' },
              { text: 'fal.ai', link: 'fal' },
              { text: 'Segment Anything Model', link: 'sam' },
              { text: 'LaMa', link: 'lama' },
              { text: 'UpscalerJS', link: 'upscaler' },
              { text: 'Laser pointer', link: 'laser-pointer' },
              { text: 'Lasso', link: 'lasso' },
            ],
          },
          {
            text: '도형',
            items: [
              { text: '도형', link: 'shape' },
              { text: '그룹', link: 'group' },
              { text: '원', link: 'circle' },
              { text: '타원', link: 'ellipse' },
              { text: '사각형', link: 'rect' },
              { text: '폴리라인', link: 'polyline' },
              { text: '패스', link: 'path' },
              { text: '텍스트', link: 'text' },
              { text: '러프 원', link: 'rough-circle' },
              { text: '러프 타원', link: 'rough-ellipse' },
              { text: '러프 사각형', link: 'rough-rect' },
              { text: '러프 폴리라인', link: 'rough-polyline' },
              { text: '러프 패스', link: 'rough-path' },
            ],
          },
        ],
      },
      '/ko/example/': {
        base: '/ko/example/',
        items: [
          {
            text: '예제',
            items: [
              { text: 'WebGPU', link: 'webgpu' },
              { text: '태양계', link: 'solar-system' },
              {
                text: '컬링으로 드로우 콜 줄이기',
                link: 'culling',
              },
              {
                text: '인스턴싱으로 드로우 콜 줄이기',
                link: 'instanced',
              },
              {
                text: 'RBush로 피킹 성능 최적화',
                link: 'picking',
              },
              {
                text: '사각형 렌더링',
                link: 'rect',
              },
              {
                text: '그림자가 있는 둥근 사각형 렌더링',
                link: 'rounded-rectangle-shadow',
              },
              {
                text: 'WebWorker에서 캔버스 렌더링',
                link: 'webworker',
              },
              {
                text: '캔버스 내용을 이미지로 내보내기',
                link: 'exporter',
              },
              {
                text: 'SVG 가져오기',
                link: 'import-svg',
              },
              {
                text: '위키피디아 데이터맵',
                link: 'wikipedia-datamap',
              },
              {
                text: '러프 도형',
                link: 'rough',
              },
              {
                text: '와이어프레임',
                link: 'wireframe',
              },
              {
                text: '패스에 구멍 뚫기',
                link: 'holes',
              },
              {
                text: '채우기 규칙 (Fill rule)',
                link: 'fill-rule',
              },
              {
                text: '텍스트',
                items: [
                  {
                    text: 'SDF를 이용한 텍스트 그리기',
                    link: 'sdf-text',
                  },
                  {
                    text: '비트맵 폰트를 이용한 텍스트 그리기',
                    link: 'bitmap-font',
                  },
                  {
                    text: 'MSDF를 이용한 텍스트 그리기',
                    link: 'msdf-text',
                  },
                  {
                    text: '이모지 그리기',
                    link: 'emoji',
                  },
                  {
                    text: '양방향 텍스트 그리기',
                    link: 'bidi',
                  },
                  {
                    text: 'HarfBuzz를 이용한 쉐이핑',
                    link: 'harfbuzz',
                  },
                  {
                    text: 'Opentype.js를 이용한 쉐이핑',
                    link: 'opentype',
                  },
                  {
                    text: '텍스트 베이스라인',
                    link: 'text-baseline',
                  },
                  {
                    text: '텍스트 그림자',
                    link: 'text-dropshadow',
                  },
                  {
                    text: '텍스트 테두리',
                    link: 'text-stroke',
                  },
                  {
                    text: '텍스트 장식',
                    link: 'text-decoration',
                  },
                  {
                    text: '텍스트 패스',
                    link: 'text-path',
                  },
                  {
                    text: '물리 기반 텍스트',
                    link: 'physical-text',
                  },
                  {
                    text: '웹 폰트 로드',
                    link: 'web-font-loader',
                  },
                  {
                    text: 'TeX 수식 렌더링',
                    link: 'tex-math',
                  },
                  {
                    text: '텍스트 에디터',
                    link: 'text-editor',
                  },
                ],
              },
              {
                text: 'Web Animations API',
                link: 'web-animations-api',
              },
              {
                text: '캔버스 모드 선택',
                link: 'canvas-mode-select',
              },
              {
                text: 'z-index 조절 (맨 앞으로 가져오기/맨 뒤로 보내기)',
                link: 'zindex',
              },
              {
                text: '이미지 드래그 앤 드롭',
                link: 'dragndrop-image',
              },
              {
                text: '선언적 그라디언트',
                link: 'declarative-gradient',
              },
              {
                text: '패턴',
                link: 'pattern',
              },
              {
                text: '이미지 처리',
                link: 'image-processing',
              },
              {
                text: '마인드맵과 레이아웃',
                items: [
                  {
                    text: '마인드맵',
                    link: 'mindmap',
                  },
                  {
                    text: '트리',
                    link: 'tree',
                  },
                  {
                    text: 'FlexTree',
                    link: 'flextree',
                  },
                  {
                    text: '그래프 간 바인딩',
                    link: 'binding',
                  },
                ],
              },
              {
                text: '그리기 도구',
                items: [
                  {
                    text: '사각형 도구',
                    link: 'draw-rect',
                  },
                  {
                    text: '화살표 도구',
                    link: 'draw-arrow',
                  },
                  {
                    text: '연필 도구',
                    link: 'pencil',
                  },
                  {
                    text: '연필 도구 (자유 곡선)',
                    link: 'pencil-freehand',
                  },
                  {
                    text: '붓 도구',
                    link: 'brush-with-stamp',
                  },
                  {
                    text: '레이저 포인터',
                    link: 'laser-pointer',
                  },
                  {
                    text: '로프 도구',
                    link: 'lasso',
                  },
                ],
              },
              {
                text: 'HTML 및 임베디드 콘텐츠',
                items: [
                  {
                    text: 'HTML 콘텐츠',
                    link: 'html',
                  },
                  {
                    text: 'YouTube',
                    link: 'iframe',
                  },
                ],
              },
              {
                text: '협업',
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
                    text: '댓글 오버레이',
                    link: 'comments-overlay',
                  },
                ],
              },
            ],
          },
        ],
      },
      '/ko/experiment/': {
        base: '/ko/experiment/',
        items: [
          { text: 'WebGPU를 이용한 파티클 그리기', link: 'particles' },
          { text: '프로그래밍 방식의 그라디언트', link: 'gradient' },
          { text: '메쉬 그라디언트', link: 'mesh-gradient' },
          { text: '보로노이', link: 'voronoi' },
          { text: '프랙탈 브라운 운동 (FBM)', link: 'fractal-brownian-motion' },
          { text: '도메인 워핑 (Domain Warping)', link: 'domain-warping' },
          {
            text: '피타고라스의 정리',
            link: 'pythagorean-theorem',
          },
          { text: '텍스트 예술 효과', link: 'signature' },
          { text: '캔버스와 채팅의 만남', link: 'when-canvas-meets-chat' },
          {
            text: 'WebWorker에서 SAM을 이용한 이미지 세그먼테이션',
            link: 'sam-in-worker',
          },
          {
            text: 'WebWorker에서 LaMa를 이용한 객체 제거',
            link: 'lama-in-worker',
          },
          { text: '오디오 시각화', link: 'audio-visualizer' },
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
