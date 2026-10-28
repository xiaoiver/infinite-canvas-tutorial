import { defineConfig } from 'vitepress';

export const ko = defineConfig({
  lang: 'ko-KR',
  title: '무한 캔버스 튜토리얼',
  description:
    'HTML5 Canvas, WebGL/WebGPU, ECS, SDF 렌더링, CRDT/Yjs를 이용한 협업 등 Figma와 같은 인터렉티브 워크스페이스를 만들기 위한 심층적인 오픈소스 무한 캔버스 튜토리얼입니다.',
  keywords: ['무한 캔버스', '캔버스', 'webgl', 'webgpu', 'ecs'],
  themeConfig: {
    nav: [
      { text: '앱', link: 'https://app.infinitecanvas.cc/' },
      {
        text: '가이드',
        link: '/ko/guide/lesson-001',
        activeMatch: '/ko/guide/',
      },
      // Example, reference, and experiment pages are not translated.
      // These links open the English locale so the sidebar never 404s.
      { text: '예제 (EN)', link: '/example/solar-system' },
      { text: '레퍼런스 (EN)', link: '/reference/canvas' },
      { text: '실험 (EN)', link: '/experiment/particles' },
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
              {
                text: '강의 002 - 원 그리기',
                link: 'lesson-002',
              },
              {
                text: '강의 003 - 씬 그래프와 변환',
                link: 'lesson-003',
              },
              {
                text: '강의 004 - 카메라',
                link: 'lesson-004',
              },
              {
                text: '강의 005 - 그리드',
                link: 'lesson-005',
              },
              {
                text: '강의 006 - 이벤트 시스템',
                link: 'lesson-006',
              },
              {
                text: '강의 007 - Web UI',
                link: 'lesson-007',
              },
              {
                text: '강의 008 - 성능 최적화',
                link: 'lesson-008',
              },
              {
                text: '강의 009 - 타원과 사각형 그리기',
                link: 'lesson-009',
              },
              {
                text: '강의 010 - 이미지 가져오기와 내보내기',
                link: 'lesson-010',
              },
              {
                text: '강의 011 - 테스트와 서버 사이드 렌더링',
                link: 'lesson-011',
              },
              {
                text: '강의 012 - 폴리라인 그리기',
                link: 'lesson-012',
              },
              {
                text: '강의 013 - 패스 그리기와 스케치 스타일',
                link: 'lesson-013',
              },
              {
                text: '강의 014 - 캔버스 모드와 보조 UI',
                link: 'lesson-014',
              },
              {
                text: '강의 015 - 텍스트 렌더링',
                link: 'lesson-015',
              },
              {
                text: '강의 016 - 텍스트 고급 기능',
                link: 'lesson-016',
              },
              {
                text: '강의 017 - 그라디언트와 패턴',
                link: 'lesson-017',
              },
              {
                text: '강의 018 - ECS로 리팩터링',
                link: 'lesson-018',
              },
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
                text: '강의 030 - 후처리와 렌더 그래프',
                link: 'lesson-030',
              },
              {
                text: '강의 031 - 도형 간 바인딩',
                link: 'lesson-031',
              },
              {
                text: '강의 032 - 텍스트로 다이어그램 만들기',
                link: 'lesson-032',
              },
              {
                text: '강의 033 - 레이아웃 엔진',
                link: 'lesson-033',
              },
              {
                text: '강의 034 - Group, Frame 과 클리핑',
                link: 'lesson-034',
              },
              {
                text: '강의 035 - 타일 기반 렌더링',
                link: 'lesson-035',
              },
              {
                text: '강의 036 - 애니메이션',
                link: 'lesson-036',
              },
              {
                text: '강의 037 - Radiance Cascades를 이용한 GI',
                link: 'lesson-037',
              },
              {
                text: '강의 038 - 디자인에서 코드로',
                link: 'lesson-038',
              },
              {
                text: '강의 039 - 3D 메시 렌더링',
                link: 'lesson-039',
              },
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

    docFooter: {
      prev: '이전 페이지',
      next: '다음 페이지',
    },

    outline: {
      label: '페이지 탐색',
    },

    lastUpdated: {
      text: '마지막 업데이트',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
    },

    langMenuLabel: '언어',
    returnToTopLabel: '맨 위로',
    sidebarMenuLabel: '메뉴',
    darkModeSwitchLabel: '테마',
    lightModeSwitchTitle: '라이트 모드로 전환',
    darkModeSwitchTitle: '다크 모드로 전환',
  },
});

export const search = {
  placeholder: '문서 검색',
  translations: {
    button: {
      buttonText: '문서 검색',
      buttonAriaLabel: '문서 검색',
    },
    modal: {
      searchBox: {
        resetButtonTitle: '검색어 지우기',
        resetButtonAriaLabel: '검색어 지우기',
        cancelButtonText: '취소',
        cancelButtonAriaLabel: '취소',
      },
      startScreen: {
        recentSearchesTitle: '최근 검색',
        noRecentSearchesText: '최근 검색 없음',
        saveRecentSearchButtonTitle: '최근 검색에 저장',
        removeRecentSearchButtonTitle: '최근 검색에서 제거',
        favoriteSearchesTitle: '즐겨찾기',
        removeFavoriteSearchButtonTitle: '즐겨찾기에서 제거',
      },
      errorScreen: {
        titleText: '결과를 가져올 수 없습니다',
        helpText: '네트워크 연결을 확인해 주세요',
      },
      footer: {
        selectText: '선택',
        navigateText: '이동',
        closeText: '닫기',
        searchByText: '검색 제공',
      },
      noResultsScreen: {
        noResultsText: '관련 결과 없음',
        suggestedQueryText: '이런 검색을 시도해 보세요',
        reportMissingResultsText: '이 검색에는 결과가 있어야 하나요?',
        reportMissingResultsLinkText: '피드백 보내기',
      },
    },
  },
};
