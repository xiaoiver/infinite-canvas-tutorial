---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
    name: 무한 캔버스 튜토리얼
    tagline: 무한 캔버스를 단계별로 구축해 보세요.
    image:
        src: /canvas.png
        alt: 무한 캔버스
    actions:
        - theme: brand
          text: 가이드
          link: /ko/guide/lesson-001
        - theme: alt
          text: 예제
          link: /ko/example/solar-system
        - theme: alt
          text: 레퍼런스
          link: /ko/reference/canvas
        - theme: alt
          text: 실험실
          link: /ko/experiment/particles

features:
    - title: 고성능 렌더링
      details: WebGL 및 WebGPU를 사용한 기본 렌더링
    - title: 인터렉티브
      details: <a href="https://genji-md.dev">genji</a>를 통한 실행 가능한 코드 블록
    - title: 모든 프레임워크와 연동
      details: Web Components로 구현된 UI
    - title: 풍부한 그래픽
      details: 스티커 메모, 도형 및 펜 도구
---

<script setup>
import WebGL from '../components/WebGL.vue'
import WhenCanvasMeetsChat from '../components/WhenCanvasMeetsChat.vue'
</script>

강의 17 이후에는 ECS 아키텍처와 UI를 위해 spectrum을 사용합니다:

<WhenCanvasMeetsChat />

강의 17 이전의 결과물은 다음과 같았습니다:

<WebGL />

이 튜토리얼은 WebGL / WebGPU 기반의 기본적인 2D 그래픽 렌더링 구현을 다룹니다:

-   [강의 002 - 원 그리기]
-   [강의 005 - 그리드]
-   [강의 009 - 타원과 사각형 그리기]
-   [강의 012 - 폴리라인 그리기]
-   [강의 013 - 패스 그리기와 스케치 스타일]
-   [강의 015 - 텍스트 렌더링]
-   [강의 016 - 텍스트 고급 기능]

또한 Web Components 기술을 사용하여 구현된 UI 컴포넌트들을 포함합니다:

-   [강의 007 - Web UI]
-   [강의 018 - ECS로 리팩토링]
-   [강의 024 - 컨텍스트 메뉴와 클립보드]

그리고 몇 가지 흥미로운 주제들:

-   [강의 017 - 그라디언트와 패턴]
-   [강의 019 - 히스토리]
-   [강의 022 - VectorNetwork]

[강의 002 - 원 그리기]: /ko/guide/lesson-002
[강의 005 - 그리드]: /ko/guide/lesson-005
[강의 009 - 타원과 사각형 그리기]: /ko/guide/lesson-009
[강의 012 - 폴리라인 그리기]: /ko/guide/lesson-012
[강의 013 - 패스 그리기와 스케치 스타일]: /ko/guide/lesson-013
[강의 015 - 텍스트 렌더링]: /ko/guide/lesson-015
[강의 016 - 텍스트 고급 기능]: /ko/guide/lesson-016
[강의 007 - Web UI]: /ko/guide/lesson-007
[강의 018 - ECS로 리팩토링]: /ko/guide/lesson-018
[강의 019 - 히스토리]: /ko/guide/lesson-019
[강의 024 - 컨텍스트 메뉴와 클립보드]: /ko/guide/lesson-024
[강의 022 - VectorNetwork]: /ko/guide/lesson-022
[강의 017 - 그라디언트와 패턴]: /ko/guide/lesson-017
