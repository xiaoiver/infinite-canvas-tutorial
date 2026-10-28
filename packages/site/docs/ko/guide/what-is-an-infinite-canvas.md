---
description: '높은 확장성, 확대·축소, 직접 조작을 포함한 무한 캔버스의 개념을 소개합니다. 현대적인 렌더링 기술과, GPU로 가속하는 무한 캔버스를 만들기 위한 로드맵을 개괄합니다.'
head:
    - ['meta', { property: 'og:title', content: '무한 캔버스란 무엇인가요?' }]
---

# 무한 캔버스란 무엇인가요? {#what-is-an-infinite-canvas}

[infinitecanvas]에서 “무한”이라는 말은 다음과 같이 설명됩니다.

-   높은 확장성. 사용자는 비선형적인 방식으로 콘텐츠 구조를 자유롭게 조직할 수 있습니다.
-   확대·축소. 실제 세계에서처럼 “확대”로 전체를 조망하고 “축소”로 세부 사항을 관찰하는 것을 흉내 냅니다.
-   직접 조작. 기본 도형을 직관적으로 편집하는 기능을 제공합니다. 이동, 그룹화, 스타일 수정이 포함됩니다.

[infinitecanvas]는 디자인 도구부터 크리에이티브 보드까지 수많은 사례를 보여 주며, [Figma], [Modyfi], [rnote], [tldraw], [excalidraw] 같은 잘 알려진 제품도 포함합니다.

프론트엔드 개발자로서, 여기에 쓰이는 렌더링 기술에 큰 관심이 있습니다. tldraw, excalidraw 등은 대개 Canvas2D/SVG처럼 더 다루기 쉬운 기술을 쓰지만, JS와 Rust 생태계에도 더 낮은 수준의 렌더링 기술로 2D 그래픽을 GPU 가속하여 더 나은 성능과 경험을 얻는 에디터와 디자인 도구가 많이 있습니다.

-   [Figma]는 C++로 작성한 타일 기반 렌더링 엔진을 WASM으로 컴파일한 뒤 WebGL과 WebGPU를 호출하여 렌더링합니다.
-   [Modyfi]는 Rust 생태계의 [wgpu]를 사용하며, 역시 WASM으로 컴파일한 뒤 WebGL2를 호출하여 렌더링합니다.
-   [Zed]는 GPUI로 사각형, 그림자, 텍스트, 이미지와 그 밖의 UI 요소를 렌더링합니다.
-   [Vello]와 [xilem]은 실험적으로 Compute Shader를 2D 렌더링에 사용합니다.

그래서 이 튜토리얼에서는 다음 기능을 구현하고자 합니다.

-   [@antv/g-device-api]를 하드웨어 추상화 레이어로 사용하여 WebGL1/2와 WebGPU를 지원합니다.
-   [mapbox]와 [Figma]를 참고하여 타일 기반 렌더링을 시도합니다.
-   원, 타원, 사각형 등에 SDF(부호 있는 거리장) 렌더링을 사용합니다.
-   GPU로 가속하는 텍스트와 베지어 곡선 렌더링.
-   [rough.js]로 손그림 스타일을 지원합니다.
-   CRDT(충돌 없는 복제 데이터 타입)로 협업용 [Yjs]를 지원합니다.

앞으로 캔버스의 렌더링 부분을 Rust로 다시 작성하고 싶지만, 현재 프로젝트의 완성도는 아직 비교적 낮습니다.

-   [wgpu]는 매우 믿을 만한 하드웨어 추상화 레이어이며, [piet]의 백엔드까지 구현할 수 있습니다.
-   셰이더는 기본적으로 재사용할 수 있습니다.
-   손그림 스타일에는 [rough-rs]를 쓸 수 있습니다.
-   [y-crdt]는 [Yjs]의 Rust 구현입니다.

![Rust 스택](/rust.png)

[vello]를 사용해 Rust에서 기본 도형, 스케치 스타일과 관련 기능의 렌더링을 이미 구현했고, WASM을 통해 호출합니다.

시작해 봅시다!

[infinitecanvas]: https://infinitecanvas.tools/
[Figma]: https://madebyevan.com/figma/building-a-professional-design-tool-on-the-web/
[Modyfi]: https://digest.browsertech.com/archive/browsertech-digest-how-modyfi-is-building-with/
[rnote]: https://github.com/flxzt/rnote
[tldraw]: https://github.com/tldraw/tldraw
[excalidraw]: https://github.com/excalidraw/excalidraw
[rough.js]: https://github.com/rough-stuff/rough
[rough-rs]: https://github.com/orhanbalci/rough-rs
[Zed]: https://zed.dev/blog/videogame
[wgpu]: https://wgpu.rs/
[vello]: https://github.com/linebender/vello
[xilem]: https://github.com/linebender/xilem
[piet]: https://github.com/linebender/piet
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[mapbox]: https://blog.mapbox.com/rendering-big-geodata-on-the-fly-with-geojson-vt-4e4d2a5dd1f2?gi=e5acafcf219d
[Yjs]: https://yjs.dev/
[y-crdt]: https://github.com/y-crdt/y-crdt
