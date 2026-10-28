---
outline: deep
description: 'Lit과 Shoelace로 프레임워크에 묶이지 않는 Web UI 컴포넌트를 만듭니다. 재사용할 수 있는 캔버스 컴포넌트와 줌 도구 모음을 만들고, 적절한 생명 주기 관리와 비동기 작업 처리를 함께 다룹니다.'
head:
    - ['meta', { property: 'og:title', content: '7강 - Web UI' }]
---

# 7강 - Web UI {#lesson-7-web-ui}

이번 강의에서는 다음 내용을 배웁니다.

-   Lit과 Shoelace로 Web UI를 개발합니다
-   캔버스 컴포넌트를 구현합니다
-   줌 도구 모음 컴포넌트를 구현합니다

<div style="width: 100%; height: 200px;">
  <ic-canvas-lesson7 />
</div>

## Lit과 Shoelace로 만드는 Web UI {#web-ui-with-lit-and-shoelace}

컴포넌트 라이브러리를 고를 때, 특정 프레임워크 구현에 묶이고 싶지 않았습니다. [Web Components are not Framework Components — and That’s Okay]를 참고하세요. Web Components는 좋은 선택이고, [Lit]은 반응형 상태, 범위가 한정된 스타일, 선언적 템플릿 시스템을 제공해 개발을 더 쉽게 만듭니다. [Shoelace]는 [Lit] 기반 UI 라이브러리이고, [Web Awesome]는 그 화려한 새 이름입니다. 이들을 쓰면 React, Vue, Angular를 동시에 지원하여, 프레임워크에 묶이지 않는 캔버스 컴포넌트를 만들 수 있습니다. Photoshop Web이 사용하는 [spectrum-web-components] 컴포넌트 라이브러리도 Lit 기반입니다. [Photoshop is now on the web!]를 참고하세요.

> Photoshop은 Adobe의 더 넓은 Creative Cloud 생태계의 일부입니다. Lit 위에 구축한 표준화된 Web Components 전략을 쓰면, 애플리케이션 사이에서 UI를 일관되게 유지할 수 있습니다.

이 튜토리얼의 정적 사이트는 [VitePress]로 작성했기 때문에, 예제 페이지에서는 [Vue instructions]를 쓰지만, 컴포넌트 안에서는 Vue 문법을 쓰지 않습니다.

다음으로, 이미 있는 단순한 기능을 UI 컴포넌트로 감싸겠습니다.

## 캔버스 컴포넌트 {#canvas-component}

캔버스 컴포넌트는 [Lit]으로 선언하며, 이름 충돌을 피하려고 컴포넌트 접두사로 `ic`를 씁니다.

```ts
import { LitElement } from 'lit';

@customElement('ic-canvas')
export class InfiniteCanvas extends LitElement {}
```

데코레이터로 `renderer` 속성을 정의하면, `<ic-canvas renderer="webgl" />` 같은 문법으로 쓸 수 있습니다.

```ts
import { property } from 'lit/decorators.js';

export class InfiniteCanvas extends LitElement {
    @property()
    renderer = 'webgl';
}
```

캔버스가 페이지의 너비와 높이를 따르게 하고 싶습니다. Shoelace는 요소의 너비나 높이가 바뀔 때 커스텀 이벤트 `sl-resize`를 발생시키는, 바로 쓸 수 있는 [Resize Observer]를 제공합니다. [Lit]이 제공하는 `render` 생명 주기에서 HTML을 선언하고, 실제 HTMLCanvasElement는 [query]로 빠르게 조회할 수 있습니다.

```ts
export class InfiniteCanvas extends LitElement {
    @query('canvas', true)
    $canvas: HTMLCanvasElement;

    render() {
        return html`
            <sl-resize-observer>
                <canvas></canvas>
            </sl-resize-observer>
        `;
    }
}
```

[connectedCallback] 생명 주기에서 크기 변화를 수신하고, [disconnectedCallback] 생명 주기에서 수신을 해제합니다.

```ts
export class InfiniteCanvas extends LitElement {
    connectedCallback() {
        this.addEventListener('sl-resize', this.resize);
    }
    disconnectedCallback() {
        this.removeEventListener('sl-resize', this.resize);
    }
}
```

### 캔버스 초기화의 생명 주기 {#lifecycle-for-canvas-initialization}

캔버스를 언제 만들지가 한동안 고민이었습니다. [connectedCallback] 생명 주기에서 `<canvas>`를 얻으려 하면 `undefined`가 반환됩니다. 아직 CustomElement가 문서에 추가되지 않아, DOM API로 조회할 수 없기 때문입니다. 결국 [firstUpdated]가 적당한 시점이라는 것을 알았습니다. 캔버스를 만든 뒤 커스텀 이벤트 `ic-ready`를 발생시키고 이벤트 객체에 캔버스 인스턴스를 담으며, 매 틱마다 커스텀 이벤트 `ic-frame`을 발생시킵니다.

```ts
export class InfiniteCanvas extends LitElement {
    async firstUpdated() {
        this.#canvas = await new Canvas({
            canvas: this.$canvas,
            renderer: this.renderer as 'webgl' | 'webgpu',
        }).initialized;

        this.dispatchEvent(
            new CustomEvent('ic-ready', { detail: this.#canvas }),
        );

        const animate = (time?: DOMHighResTimeStamp) => {
            this.dispatchEvent(new CustomEvent('ic-frame', { detail: time }));
            this.#canvas.render();
            this.#rafHandle = window.requestAnimationFrame(animate);
        };
        animate();
    }
}
```

이 임시 방편보다 더 나은 방법이 있을까요?

### 비동기 작업 사용 {#async-task}

비동기 작업을 실행한 뒤에 렌더링하는 이런 상황에는, React가 [\<Suspense\>]를 제공합니다.

```tsx
<Suspense fallback={<Loading />}>
    <SomeComponent />
</Suspense>
```

Lit도 비슷한 [Async Tasks]를 제공하므로, 비동기 작업이 끝나기 전의 로딩 상태와, 오류가 났을 때의 오류 상태를 표시할 수 있습니다. `Task`로 비동기 작업을 만들 때는 매개변수를 지정하고, 만든 `<canvas>`를 반환값에 포함해야 합니다. 그러면 렌더 함수의 `complete` 훅에서 그것을 가져와 렌더링할 수 있습니다.

```ts
private initCanvas = new Task(this, {
    task: async ([renderer]) => {
      return canvas.getDOM();
    },
    args: () => [this.renderer as 'webgl' | 'webgpu'] as const,
});

render() {
  return this.initCanvas.render({
    pending: () => html`<sl-spinner></sl-spinner>`,
    complete: ($canvas) => html`
      <sl-resize-observer>
        ${$canvas}
        <ic-zoom-toolbar-lesson7 zoom=${this.zoom}></ic-zoom-toolbar-lesson7>
      </sl-resize-observer>
    `,
    error: (e) => html`<sl-alert variant="danger" open>${e}</sl-alert>`,
  });
}
```

예를 들어 WebGPU를 지원하지 않는 Safari에서는 다음 오류 메시지가 표시됩니다.

<sl-alert variant="danger" open>
  <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
  <strong>캔버스 초기화에 실패했습니다</strong><br />
  브라우저가 WebGPU를 지원하지 않습니다.
</sl-alert>

이렇게 캔버스 컴포넌트가 작성됩니다. Web Components는 프레임워크에 묶이지 않으므로, 일관된 방식으로 사용할 수 있습니다. Vue와 React를 예로 들면 다음과 같습니다.

```vue
<template>
    <ic-canvas renderer="webgl"></ic-canvas>
</template>
```

```tsx
<div>
    <ic-canvas renderer="webgl"></ic-canvas>
</div>
```

캔버스가 로드되면 `ic-ready` 커스텀 이벤트를 수신해 캔버스 인스턴스를 얻습니다.

```ts
const $canvas = document.querySelector('ic-canvas');
$canvas.addEventListener('ic-ready', (e) => {
    const canvas = e.detail;
    // 创建场景图
    canvas.appendChild(circle);
});
```

여기서 카메라 줌 컴포넌트를 구현하겠습니다.

## 줌 컴포넌트 {#zoom-component}

다음 그림은 Miro의 줌 컴포넌트입니다.

![Miro 줌 도구 모음](/miro-toolbar.png)

먼저 `ic-zoom-toolbar`를 만들겠습니다.

```ts
@customElement('ic-zoom-toolbar')
export class ZoomToolbar extends LitElement {}
```

캔버스 컴포넌트에 추가합니다.

```html
<sl-resize-observer>
    <canvas></canvas>
    <ic-zoom-toolbar zoom="${this.zoom}"></ic-zoom-toolbar> // [!code ++]
</sl-resize-observer>
```

이 컴포넌트의 내부 구조는 다음과 같으며, Lit의 템플릿 문법이 Vue와 매우 가깝다는 것을 알 수 있습니다.

```html
<sl-button-group label="Zoom toolbar">
    <sl-tooltip content="Zoom out">
        <sl-icon-button
            name="dash-lg"
            label="Zoom out"
            @click="${this.zoomOut}"
        ></sl-icon-button>
    </sl-tooltip>
    <span>${this.zoom}%</span>
    <sl-tooltip content="Zoom in">
        <sl-icon-button
            name="plus-lg"
            label="Zoom in"
            @click="${this.zoomIn}"
        ></sl-icon-button>
    </sl-tooltip>
</sl-button-group>
```

캔버스 인스턴스를 캔버스 컴포넌트에서 자식으로 넘기려고 [Lit Context]를 사용하며, 인스턴스를 만든 뒤 컨텍스트에 저장합니다.

```ts{9}
const canvasContext = createContext<Canvas>(Symbol('canvas'));

export class InfiniteCanvas extends LitElement {
    #provider = new ContextProvider(this, { context: canvasContext });

    private initCanvas = new Task(this, {
      task: async ([renderer]) => {
        // ...省略实例化画布过程
        this.#provider.setValue(this.#canvas);
      }
    });
}
```

그다음 자식 컴포넌트에서 컨텍스트를 통해 사용할 수 있습니다. 캔버스 생성은 비동기이므로, 컨텍스트를 실시간으로 따라가려면 `subscribe`해야 합니다.

```ts
export class ZoomToolbar extends LitElement {
    @consume({ context: canvasContext, subscribe: true })
    canvas: Canvas;
}
```

카메라나 투영 행렬이 바뀔 때마다 호출되는 콜백 함수를 카메라에 추가합니다.

```ts
export class Camera {
    onchange: () => void;
    private updateViewProjectionMatrix() {
        if (this.onchange) {
            this.onchange();
        }
    }
}
```

콜백이 호출되면 반응형 변수 `zoom`이 바뀝니다.

```ts
this.#canvas.camera.onchange = () => {
    this.zoom = Math.round(this.#canvas.camera.zoom * 100);
};
```

## 테마 {#theme}

테마는 UI 컴포넌트와 캔버스 양쪽에 적용해야 합니다. 먼저 전자부터 보겠습니다.

### UI 컴포넌트 {#theme-in-ui}

Shoelace는 쉽게 전환할 수 있는 [Themes] 기능을 제공합니다. 먼저 두 테마의 스타일시트를 가져옵니다.

```ts
import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/themes/dark.css';
```

다크 테마로 전환할 때는 루트 요소에 식별용 클래스를 추가하기만 하면 됩니다.

```ts
this.classList.toggle('sl-theme-dark', this.theme === 'dark');
```

마지막으로 컴포넌트 스타일을 작성할 때는 고정값 대신 CSS 변수를 사용합니다. 그러면 테마를 전환할 때 자동으로 적용됩니다.

```ts
:host {
    background: var(--sl-panel-background-color);
}
```

이후의 [18강 - ECS로 리팩터링][Lesson 18 - Refactor with ECS]에서 Web Components 구현을 Shoelace에서 Spectrum으로 바꿨고, Spectrum도 라이트/다크 테마 전환 기능을 제공합니다.

![18강 이후의 다크 테마](/spectrum-theme-dark.png)

### 캔버스 배경과 그리드 {#theme-in-canvas}

캔버스의 배경과 [그리드][Grid]도 테마 색과 연결해야 합니다. [Theme colors in DGM.js]를 참고해, 캔버스를 만들 때 라이트 테마와 다크 테마의 색 값을 넘길 수 있게 했습니다.

```ts
enum Theme {
    LIGHT,
    DARK,
}

interface ThemeColors {
    background: string;
    grid: string;
}

interface CanvasConfig {
    themeColors?: Partial<{
        [Theme.LIGHT]: Partial<ThemeColors>; // [!code ++]
        [Theme.DARK]: Partial<ThemeColors>; // [!code ++]
    }>; // [!code ++]
}
```

런타임 전환을 지원합니다.

```ts
canvas.theme = Theme.DARK;
```

이후에는 UI 구현의 세부 내용을 다루지 않겠습니다.

## 국제화 {#i18n}

Lit은 [Localization] 방안을 제공하며, 적절한 도구를 쓰면 자동화할 수 있습니다.

### 지역화 템플릿 빌드 {#build-localized-template}

먼저 국제화가 필요한 문자열을 `msg` 메서드로 감싸야 합니다. 주 메뉴를 예로 들면 다음과 같습니다.

```ts
import { msg, str } from '@lit/localize';

<sp-tooltip slot="tooltip" self-managed placement="bottom">
    ${msg(str`Main menu`)}
</sp-tooltip>;
```

그다음 아래 명령을 실행해, 소스 코드에서 사용하는 언어 문자열을 추출합니다.

```bash
lit-localize extract
```

이 시점에 일련의 `xlf` 파일을 얻습니다. 이 `xlf` 파일을 번역 서비스에 보내면 됩니다. 물론 직접 번역해도 됩니다. 그러면 다음과 비슷한 결과를 받습니다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
<file target-language="zh-Hans" source-language="en" original="lit-localize-inputs" datatype="plaintext">
<body>
<trans-unit id="sa10f310edb35fa9f">
  <source>Main menu</source>
  <target>主菜单</target>
</trans-unit>
</body>
</file>
</xliff>
```

그다음 아래 명령을 실행하면, 번역된 문자열이 컴포넌트로 컴파일되어 소스 코드 폴더에 놓입니다.

```bash
lit-localize build
```

### 로케일 전환 {#switch-locale}

이 웹사이트는 VitePress로 구축했습니다. 오른쪽 위에서 언어 전환 컴포넌트를 찾을 수 있습니다.

```ts
import { localized } from '@lit/localize';

@customElement('ic-spectrum-top-navbar')
@localized()
export class TopNavbar extends LitElement {}
```

런타임에 필요할 때만 로드할 수 있습니다.

```ts
import { configureLocalization } from '@lit/localize';
// Generated via output.localeCodesModule
import { sourceLocale, targetLocales } from './generated/locale-codes.js';

export const { getLocale, setLocale } = configureLocalization({
    sourceLocale,
    targetLocales,
    loadLocale: (locale) => import(`/locales/${locale}.js`),
});
```

시연을 위해 [정적 import][static imports]를 쓰기로 했습니다. 물론 이 방식은 모든 언어 파일을 로드하므로, 첫 콘텐츠가 보이기까지의 시간에 영향을 줍니다.

## slot으로 조합하기 {#composite-with-slot}

이후의 [18강 - ECS로 리팩터링][Lesson 18 - Refactor with ECS]에서 캔버스 왼쪽에 도구 모음을 구현했습니다. 도구 모음에 새 도구를 추가하려면, Web Components의 `<slot>` 요소로 쉽게 할 수 있습니다.

많은 확장 가능한 플러그인(예를 들어 [지우개 플러그인][Eraser plugin])에서 비슷한 사용법을 구현했습니다.

```html
<ic-spectrum-canvas>
    <ic-spectrum-penbar-eraser slot="penbar-item"><ic-spectrum-penbar-eraser />
</ic-spectrum-canvas>
```

Lit 컴포넌트 안에서는 `<slot>`으로 확장할 수 있는 위치를 남겨 둡니다.

```ts
export class Penbar extends LitElement {
    render() {
        return html`<sp-action-group class="penbar">
            <slot name="penbar-item"></slot>
        </sp-action-group>`;
    }
}
```

컴포넌트 트리를 통해 `<slot>`을 전달할 때는, 부모 컴포넌트에서 이름이 있는 slot을 써야 합니다.

```html
<!-- ic-spectrum-canvas -->
<ic-spectrum-penbar>
    <slot name="penbar-item" slot="penbar-item"></slot>
</ic-spectrum-penbar>
```

## 더 읽어보기 {#extended-reading}

-   [Discussion about Lit on HN]
-   [Change themes in Figma]
-   [Using templates and slots]

[Shoelace]: https://shoelace.style/
[VitePress]: https://vitepress.dev/
[Vue instructions]: https://shoelace.style/frameworks/vue
[Resize Observer]: https://shoelace.style/components/resize-observer
[Lit]: https://lit.dev/
[connectedCallback]: https://lit.dev/docs/components/lifecycle/#connectedcallback
[disconnectedCallback]: https://lit.dev/docs/components/lifecycle/#disconnectedCallback
[query]: https://lit.dev/docs/api/decorators/#query
[firstUpdated]: https://lit.dev/docs/components/lifecycle/#firstupdated
[Lit Context]: https://lit.dev/docs/data/context/
[Async Tasks]: https://lit.dev/docs/data/task/#overview
[\<Suspense\>]: https://react.dev/reference/react/Suspense
[Web Components are not Framework Components — and That’s Okay]: https://lea.verou.me/blog/2024/wcs-vs-frameworks/
[Photoshop is now on the web!]: https://medium.com/@addyosmani/photoshop-is-now-on-the-web-38d70954365a
[spectrum-web-components]: https://opensource.adobe.com/spectrum-web-components/
[Web Awesome]: https://www.kickstarter.com/projects/fontawesome/web-awesome
[Themes]: https://shoelace.style/getting-started/themes
[Grid]: /ko/guide/lesson-005
[Theme colors in DGM.js]: https://dgmjs.dev/api-core/variables/themecolors
[Discussion about Lit on HN]: https://news.ycombinator.com/item?id=45112720
[Lesson 18 - Refactor with ECS]: /ko/guide/lesson-018
[Change themes in Figma]: https://help.figma.com/hc/en-us/articles/5576781786647-Change-themes-in-Figma
[Localization]: https://lit.dev/docs/localization/overview/
[static imports]: https://lit.dev/docs/localization/runtime-mode/#static-imports
[Using templates and slots]: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots
[Eraser plugin]: /reference/eraser
