---
outline: deep
description: 'WebGL/WebGPU 하드웨어 추상화 레이어를 활용한 캔버스 초기화 방법을 알아봅니다. Canvas API 설계부터 플러그인 아키텍처, 렌더링 플러그인 구현까지, 다양한 환경에 대응 가능한 확장성 있는 캔버스 프레임워크 구축 과정을 다룹니다.'
head:
    - ['meta', { property: 'og:title', content: '1강 - 캔버스 초기화' }]
---

# 1강 - 캔버스 초기화

이번 강의에서는 다음 내용을 중점적으로 다룹니다.

-   WebGL1/2 및 WebGPU 기반 하드웨어 추상화 레이어(HAL)의 이해
-   캔버스 API 설계 및 인터페이스 정의
-   유연한 확장을 위한 플러그인 시스템 구현
-   하드웨어 추상화 레이어를 활용한 렌더링 플러그인 개발

구현을 마치면 캔버스의 크기를 조절하거나 WebGL과 WebGPU 렌더러를 자유롭게 전환할 수 있는 기초 환경이 완성됩니다.

```js eval code=false
width = Inputs.range([50, 300], { label: 'width', value: 100, step: 1 });
```

```js eval code=false
height = Inputs.range([50, 300], { label: 'height', value: 100, step: 1 });
```

```js eval code=false
renderer = Inputs.select(['webgl', 'webgpu'], { label: 'renderer' });
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson1;

    const $canvas = document.createElement('canvas');
    $canvas.style.outline = 'none';
    $canvas.style.padding = '0px';
    $canvas.style.margin = '0px';
    $canvas.style.border = '1px solid black';

    const canvas = await new Canvas({
        canvas: $canvas,
        renderer,
        shaderCompilerPath:
            'https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm',
    }).initialized;

    const resize = (width, height) => {
        const scale = window.devicePixelRatio;
        $canvas.width = Math.floor(width * scale);
        $canvas.height = Math.floor(height * scale);
        $canvas.style.width = `${width}px`;
        $canvas.style.height = `${height}px`;
        canvas.resize(width, height);
    };
    resize(width, height);

    const animate = () => {
        canvas.render();
        requestAnimationFrame(animate);
    };
    animate();
    return $canvas;
})();
```

## 하드웨어 추상화 레이어 (HAL) {#hardware-abstraction-layers}

캔버스가 WebGL이나 그 차세대 규격인 WebGPU 같은 저수준 렌더링 API를 효율적으로 다루도록 만들고자 합니다. WebGPU는 WebGL에 비해 비약적인 기능 향상이 이루어졌는데, 주요 특징은 다음과 같습니다. 자세한 내용은 [From WebGL to WebGPU]를 참고해 보세요.

-   Direct3D12, Metal, Vulkan 등 최신 네이티브 GPU API를 기반으로 동작합니다.
-   상태 비저장(Stateless) API 설계로 관리하기 까다로운 전역 상태 문제를 해결했습니다.
-   컴퓨트 셰이더(Compute Shader)를 지원합니다.
-   한 페이지의 `<canvas>`당 생성 가능한 컨텍스트 수 제한이 사라졌습니다.
-   명확한 오류 메시지와 GPU 객체별 커스텀 레이블 기능을 제공해 개발자 경험이 대폭 개선되었습니다.

이미 WebGPU 생태계는 JavaScript, C++, Rust 등 다양한 언어로 확장되고 있습니다. Three.js나 Babylon.js 같은 주요 렌더링 엔진들도 이미 도입을 마쳤거나 진행 중입니다. 특히 게임 엔진인 [bevy]에서 쓰이는 [wgpu]는 [Modyfi] 같은 디자인 도구의 실제 서비스 환경에서도 뛰어난 성능을 입증하고 있습니다. 아래 도표는 [WebGPU Ecosystem]에서 인용한 자료입니다.

![WebGPU ecosystem in 2023](https://developer.chrome.com/static/blog/webgpu-ecosystem/image/diagram-the-webgpu-ecosy-384594168a61_1920.png)

다만 여전한 브라우저 호환성 문제를 고려하면 WebGL1/2 지원도 놓칠 수 없습니다. 이때 필요한 것이 바로 하드웨어 추상화 레이어(HAL)입니다. HAL은 구체적인 GPU 하드웨어 제어 방식을 추상화하여, 상위 로직이 특정 API에 의존하지 않고도 동일하게 동작하도록 돕습니다.

우리는 WebGL1/2와 WebGPU를 아우르는 통합 API 세트를 구축하고, 셰이더 변환 및 모듈화 기능을 제공할 계획입니다. [@antv/g-device-api]는 [noclip]의 구현을 참고해 WebGL1 호환성까지 확장한 라이브러리로, 실제 여러 데이터 시각화 프로젝트에서 활용되고 있습니다.

WebGL과 WebGPU는 서로 다른 셰이더 언어를 사용합니다. 하지만 GLSL과 WGSL 두 벌의 코드를 직접 관리하는 것은 비효율적이므로, 런타임에 셰이더를 자동 변환하는 전략을 택했습니다.

![Transpile shader at runtime](/shader-transpile.png)

개발자는 GLSL 300 문법으로 셰이더 한 세트만 작성하면 됩니다. WebGL1 환경에서는 키워드 치환을 통해 대응하고, WebGPU 환경에서는 GLSL 440으로 변환 후 WASM 기반 [컴파일러](https://github.com/antvis/g-device-api/tree/master/rust)(naga, naga-oil 활용)를 거쳐 WGSL로 최종 변환됩니다. [Three.js Shading Language] 역시 유사하게 높은 수준의 추상화 계층을 두고 타겟 플랫폼에 맞는 코드를 출력하는 방식을 사용합니다.

아래 코드는 버텍스 셰이더의 간단한 attribute 선언이 각 환경에 맞춰 어떻게 변환되는지 보여줍니다.

```glsl
// 작성한 GLSL 300 코드
layout(location = 0) in vec4 a_Position;

// 변환된 GLSL 100 (WebGL 1)
attribute vec4 a_Position;

// 변환된 GLSL 440 (WebGPU 전단계)
layout(location = 0) in vec4 a_Position;

// 최종 변환된 WGSL (WebGPU)
var<private> a_Position_1: vec4<f32>;
@vertex
fn main(@location(0) a_Position: vec4<f32>) -> VertexOutput {
    a_Position_1 = a_Position;
}
```

흥미롭게도 최근 [Figma rendering: Powered by WebGPU] 블로그 포스트를 통해 Figma 역시 이와 매우 유사한 방식으로 WebGPU 업그레이드를 진행했다는 사실이 알려졌습니다.

> 우리는 WebGL 1 규격의 기존 GLSL 셰이더를 그대로 유지합니다. 셰이더 프로세서가 이를 분석하여 최신 GLSL 버전으로 변환한 뒤, 오픈소스 도구인 naga를 실행해 WGSL로 자동 번역합니다.

HAL의 상세한 구현 방식이 궁금하다면 [@antv/g-device-api]의 소스 코드를 참고해 보시기 바랍니다. 이번 강의의 마지막 단계에서 이 API들을 직접 사용해 볼 예정입니다.

## 캔버스 API 설계 {#design-the-canvas-api}

이제 캔버스 API를 설계할 차례입니다. 우리가 목표로 하는 사용 방식은 다음과 같이 직관적이어야 합니다.

-   `HTMLCanvasElement`를 전달받아 초기화하며, 내부적으로 HAL을 이용해 디바이스(GPU 인스턴스)를 생성합니다.
-   지속적으로 `render` 메서드를 호출하는 렌더 루프를 구성합니다.
-   브라우저의 `resize` 이벤트 등에 대응해 캔버스 크기를 유연하게 조절합니다.
-   필요한 시점에 자원을 안전하게 해제(`destroy`)합니다.

```ts
const canvas = new Canvas({
    canvas: $canvas,
});

const animate = () => {
    requestAnimationFrame(animate);
    canvas.render();
};
animate();

canvas.resize(500, 500);
canvas.destroy();
```

이러한 렌더 루프 방식은 Three.js의 [Rendering the scene]이나 CanvasKit의 [Basic draw loop] 등 현대적인 렌더링 엔진에서 표준처럼 쓰입니다. `setTimeout` 대신 `requestAnimationFrame`을 사용하는 이유는 [Performant Game Loops in JavaScript]에서 더 자세히 확인할 수 있습니다.

인터페이스 자체는 단순해 보이지만, 실제 구현 시에는 한 가지 중요한 복병이 있습니다. 바로 '비동기 초기화' 문제입니다.

```ts
interface Canvas {
    constructor(config: { canvas: HTMLCanvasElement });
    render(): void;
    destroy(): void;
    resize(width: number, height: number): void;
}
```

### 비동기 초기화 문제 {#asynchronous-initialization}

WebGPU와 WebGL의 가장 큰 차이점 중 하나는 초기화 방식입니다. WebGL은 컨텍스트를 동기적으로 가져올 수 있지만, WebGPU는 디바이스를 가져오는 과정이 비동기적으로 이루어집니다.

```ts
// WebGL: 동기 방식
const gl = $canvas.getContext('webgl');

// WebGPU: 비동기 방식
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
```

따라서 앞서 설명한 HAL을 사용할 때도 비동기 처리가 필수적입니다. 이는 WebGL 기반 엔진이 WebGPU로 전환할 때 겪는 대표적인 하위 호환성 파괴(Breaking Change) 사례이기도 합니다. Babylon.js의 [Creation of the WebGPU engine is asynchronous] 문서를 보면 그 고민의 흔적을 엿볼 수 있습니다.

```ts
import {
    WebGLDeviceContribution,
    WebGPUDeviceContribution,
} from '@antv/g-device-api';

// WebGL 디바이스 생성
const deviceContribution = new WebGLDeviceContribution({
    targets: ['webgl2', 'webgl1'],
});

// WebGPU 디바이스 생성 (비동기 처리 필요)
const deviceContribution = new WebGPUDeviceContribution({
    shaderCompilerPath: '/glsl_wgsl_compiler_bg.wasm',
});

// 실제 스왑체인과 디바이스 생성 과정
const swapChain = await deviceContribution.createSwapChain($canvas);
const device = swapChain.getDevice();
```

문제는 JavaScript의 생성자(`constructor`) 내에서는 `await`를 쓸 수 없다는 점입니다. 흔히 `init()` 같은 별도의 비동기 메서드를 두기도 하지만, 이는 사용자가 초기화 완료 시점을 일일이 챙겨야 하므로 번거롭습니다.

```ts
const canvas = new Canvas();
await canvas.init();
canvas.render();
```

대신 저는 [Async Constructor Pattern in JavaScript]와 Web Animations API의 [Animation: ready property]에서 영감을 받은 다음과 같은 패턴을 선호합니다. `new`를 통한 인스턴스 생성은 즉시 이루어지되, 초기화 완료 시점을 `initialized` 프로미스로 추적하는 방식입니다.

```ts
const canvas = await new Canvas().initialized;
```

### 실제 구현 {#implementation}

구현 시에는 내부 프라이빗 변수에 프로미스를 보관하고, getter를 통해 읽기 전용으로 노출합니다.

```ts
export class Canvas {
    #instancePromise: Promise<this>;
    get initialized() {
        return this.#instancePromise.then(() => this);
    }
}
```

생성자 안에서는 즉시 실행 비동기 함수(IIAFE)를 사용해 초기화 로직을 시작합니다.

```ts
constructor() {
  this.#instancePromise = (async () => {
    // 내부 초기화 로직 수행...
    return this;
  })();
}
```

이제 이 구조를 바탕으로 더 확장성 있는 설계를 고민해 봅시다.

## 플러그인 기반 아키텍처 {#plugin-based-architecture}

HAL 호출 로직을 전부 `Canvas` 클래스에 넣을 수도 있겠지만, 기능이 늘어날수록 클래스는 비대해지고 유지보수는 어려워집니다. 초기화, 렌더링, 자원 해제 등 각 단계별 로직을 깔끔하게 분리하고 기능을 유연하게 확장하기 위해 '플러그인 시스템'을 도입하고자 합니다.

```ts
destroy() {
  this.device.destroy();
  this.eventManager.destroy();
  // 기능이 추가될수록 이 메서드는 계속 길어집니다...
}
```

플러그인 아키텍처는 webpack, VS Code, Chrome 브라우저 등 대규모 프로젝트에서 흔히 쓰이는 검증된 패턴입니다.

-   **모듈성**: 각 플러그인이 독립적인 기능을 수행하므로 결합도가 낮아집니다.
-   **확장성**: 코어 로직을 건드리지 않고도 런타임에 기능을 동적으로 추가하거나 제거할 수 있습니다.

이 아키텍처는 크게 세 부분으로 나뉩니다.

1. **메인 애플리케이션**: 플러그인 등록 및 라이프사이클 관리, 컨텍스트 제공
2. **플러그인 인터페이스**: 코어와 플러그인 사이의 규격(Bridge)
3. **플러그인 컬렉션**: 실제 기능을 수행하는 독립 모듈들

플러그인을 호출하는 방식은 webpack의 사례를 참고할 수 있습니다. 메인 애플리케이션이 주요 시점마다 '훅(Hook)'을 트리거하면, 해당 시점에 관심 있는 플러그인들이 반응하는 방식입니다.

```ts
class ConsoleLogOnBuildWebpackPlugin {
    apply(compiler) {
        // 'run' 시점에 동작할 로직 등록
        compiler.hooks.run.tap(pluginName, (compilation) => {
            console.log('webpack starting...');
        });
    }
}
```

우리는 [tapable] 같은 복잡한 도구 대신, 콜백 배열을 활용한 간단한 `SyncHook`을 직접 구현해 사용할 것입니다.

```ts
export class SyncHook<T> {
    #callbacks: ((...args: AsArray<T>) => void)[] = [];

    tap(fn: (...args: AsArray<T>) => void) {
        this.#callbacks.push(fn);
    }

    call(...argsArr: AsArray<T>): void {
        this.#callbacks.forEach((callback) => callback.apply(void 0, argsArr));
    }
}
```

메인 애플리케이션의 진행 단계에 맞춰 다음 훅들을 정의합니다.

```ts
export interface Hooks {
    init: SyncHook<[]>;
    initAsync: AsyncParallelHook<[]>;
    destroy: SyncHook<[]>;
    resize: SyncHook<[number, number]>;
    beginFrame: SyncHook<[]>;
    endFrame: SyncHook<[]>;
}
```

플러그인은 등록 시 이 훅들이 담긴 컨텍스트를 전달받아 필요한 작업을 수행합니다.

```ts
export interface PluginContext {
    hooks: Hooks;
    canvas: HTMLCanvasElement;
}
export interface Plugin {
    apply: (context: PluginContext) => void;
}
```

이제 캔버스 초기화 과정에서 플러그인들을 로드하고 각 시점에 맞는 훅을 트리거하기만 하면 됩니다.

## 렌더러 플러그인 구현 {#renderer-plugin}

본격적으로 WebGL과 WebGPU를 지원하는 첫 번째 플러그인인 '렌더러 플러그인'을 만들어 보겠습니다.

### 스왑체인 (SwapChain) 이해하기 {#swapchain}

WebGL에서는 컨텍스트 초기화 시 '기본 프레임버퍼(Default Framebuffer)'가 자동으로 생성됩니다. 별도의 설정을 하지 않으면 렌더링 결과는 이곳의 컬러 버퍼에 기록되어 화면에 출력됩니다.

하지만 Vulkan이나 WebGPU에서는 **스왑체인(SwapChain)**이라는 개념이 등장합니다. GPU가 렌더링 결과를 기록하는 '백버퍼'와 현재 화면에 표시 중인 '프론트버퍼'를 서로 교체(Swap)하며 동작하는 방식입니다.

![Double buffering](https://res.cloudinary.com/dx1kpewvo/image/upload/v1670938992/2022-12-19/webgpu_swap_1_nnce5v.png)

이러한 더블 버퍼링 메커니즘은 화면이 갱신되는 도중에 새로운 데이터가 쓰여 화면이 찢어지는 현상(Tearing)을 방지합니다. HAL 라이브러리인 `g-device-api`는 이러한 복잡한 과정을 캡슐화하여 제공하므로, 우리는 다음과 같이 렌더러 설정에 맞춰 스왑체인과 디바이스를 생성해주기만 하면 됩니다.

```ts
export class Renderer implements Plugin {
    apply(context: PluginContext) {
        const { hooks, canvas, renderer } = context;

        hooks.initAsync.tapPromise(async () => {
            let deviceContribution: DeviceContribution;
            if (renderer === 'webgl') {
                deviceContribution = new WebGLDeviceContribution();
            } else {
                deviceContribution = new WebGPUDeviceContribution();
            }

            const swapChain = await deviceContribution.createSwapChain(canvas);
            swapChain.configureSwapChain(canvas.width, canvas.height);

            this.#swapChain = swapChain;
            this.#device = swapChain.getDevice();
        });
    }
}
```

### 고해상도 대응: devicePixelRatio {#devicepixelratio}

디스플레이의 물리적 픽셀과 CSS 픽셀의 비율인 [devicePixelRatio] 대응도 중요합니다. 캔버스의 크기를 설정할 때는 이 비율을 곱해 실제 픽셀 크기를 맞춰줘야 선명한 화면을 얻을 수 있습니다.

```ts
const scale = window.devicePixelRatio;
$canvas.width = Math.floor(width * scale); // 실제 픽셀
$canvas.height = Math.floor(height * scale);
$canvas.style.width = `${width}px`; // CSS 픽셀
```

이때 `window.devicePixelRatio`를 직접 쓰기보다는, SSR이나 WebWorker 환경 등을 고려해 설정값으로 전달받거나 `globalThis`에서 가져오는 방식이 더 안전합니다.

```ts
hooks.resize.tap((width, height) => {
    this.#swapChain.configureSwapChain(
        width * devicePixelRatio,
        height * devicePixelRatio,
    );
});
```

나머지 훅(자원 해제, 프레임 시작/종료 등) 역시 동일한 방식으로 구현하여 플러그인 리스트에 추가하면 렌더러 준비가 끝납니다.

## 데모 및 디버깅 {#demo}

아직 아무것도 그리지 않아 캔버스는 비어있지만, 내부적으로 WebGL/WebGPU 명령이 잘 호출되고 있는지 확인할 수 있습니다. Chrome의 [Spector.js]나 [WebGPU Inspector] 확장을 사용해 보세요.

Spector.js로 캡처해보면 첫 프레임부터 FrameBuffer, Texture 등 다양한 GPU 객체들이 정상적으로 생성된 것을 확인할 수 있습니다.

![Spector.js snapshot](/spectorjs.png)

WebGPU로 전환한 후 WebGPU Inspector를 통해 살펴봐도 각 프레임마다 적절한 명령들이 실행되는 것을 볼 수 있습니다.

![WebGPU inspector snapshot](/webgpu-inspector.png)

## 더 읽어보기 {#extended-reading}

그래픽스 기초 지식이 필요하다면 다음 자료를 먼저 살펴보는 것을 추천합니다.

-   [WebGL Fundamentals]
-   [WebGPU Fundamentals]

플러그인 설계 패턴에 대해 더 깊이 알고 싶다면:

-   [Intro to Plugin Oriented Programming]
-   [Introducing: Penpot Plugin System] - Penpot의 플러그인 시스템 사례
-   [Extensions in Tiptap]

[WebGPU Ecosystem]: https://developer.chrome.com/blog/webgpu-ecosystem/
[From WebGL to WebGPU]: https://developer.chrome.com/blog/from-webgl-to-webgpu
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[Intro to Plugin Oriented Programming]: https://pop-book.readthedocs.io/en/latest/index.html
[wgpu]: https://wgpu.rs/
[bevy]: https://bevyengine.org/
[noclip]: https://github.com/magcius/noclip.website
[Modyfi]: https://digest.browsertech.com/archive/browsertech-digest-how-modyfi-is-building-with/
[Async Constructor Pattern in JavaScript]: https://qwtel.com/posts/software/async-constructor-pattern/
[Animation: ready property]: https://developer.mozilla.org/en-US/docs/Web/API/Animation/ready
[Rendering the scene]: https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene
[Creation of the WebGPU engine is asynchronous]: https://doc.babylonjs.com/setup/support/WebGPU/webGPUBreakingChanges#creation-of-the-webgpu-engine-is-asynchronous
[Spector.js]: https://spector.babylonjs.com/
[WebGPU Inspector]: https://github.com/brendan-duncan/webgpu_inspector
[tapable]: https://github.com/webpack/tapable
[WebGL Fundamentals]: https://webglfundamentals.org/
[WebGPU Fundamentals]: https://webgpufundamentals.org/
[devicePixelRatio]: https://developer.mozilla.org/zh-CN/docs/Web/API/Window/devicePixelRatio
[Introducing: Penpot Plugin System]: https://www.smashingmagazine.com/2024/11/open-source-meets-design-tooling-penpot/
[Performant Game Loops in JavaScript]: https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/
[Extensions in Tiptap]: https://tiptap.dev/docs/editor/core-concepts/extensions#what-are-extensions
[Basic draw loop]: https://skia.org/docs/user/modules/quickstart/#basic-draw-loop
[Three.js Shading Language]: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
[Figma rendering: Powered by WebGPU]: https://www.figma.com/blog/figma-rendering-powered-by-webgpu/
