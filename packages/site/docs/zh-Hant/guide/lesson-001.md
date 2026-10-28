---
outline: deep
description: '學習如何以基於 WebGL/WebGPU 的硬體抽象層初始化畫布、設計 Canvas API、實作以外掛為基礎的架構，並建立渲染外掛。打造支援多種渲染器、可擴充的畫布框架。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第 1 課 - 初始化畫布' },
      ]
---
# 第 1 課 - 初始化畫布 {#lesson-1-initialize-canvas}

在這一課中，你將學到下列內容：

-   以 WebGL1/2 與 WebGPU 為基礎的硬體抽象層（HAL）
-   設計我們的 Canvas API
-   實作一個簡單的外掛系統
-   實作基於 HAL 的渲染外掛

::: warning 安全性注意：@antv/g-device-api

[GHSA-hqjp-pg4j-q8g2](https://github.com/advisories/GHSA-hqjp-pg4j-q8g2) 將 npm 版本 **1.7.13 與 1.8.13** 標示為含有竊取憑證的 `preinstall` 指令碼的惡意發行版本。**請勿安裝這些版本。** 截至 2026 年 10 月 13 日，該公告未列出已修補的版本。

下方著色器編譯器的 WASM URL 固定在 **1.6.13**。這是截至該日可從 npm 與 UNPKG 取得的最新版本，並與本儲存庫 `pnpm-lock.yaml` 中的 JavaScript 套件一致。其 WASM 與先前使用的 **1.6.8** 產物，以及本儲存庫內建的編譯器，位元組完全相同；這次變更只是對齊版本號，並未改變編譯器的功能。版本 1.6.13 未被列為受影響版本，而且在瀏覽器中取得 WASM 並不會執行 npm 的安裝指令碼。這兩項事實都不構成對該產物的安全性稽核。

依照本儲存庫跟著課程操作時，請以 `pnpm install --frozen-lockfile` 保持鎖定檔不變。避免未指定版本或 `latest` 的安裝，並檢查任何相依性更新的來源。替代編譯器必須先經過驗證，才能在此建議使用。目前使用 `@infinite-canvas-tutorial/device-api` 的 ECS 專案，請優先採用其[內建的 WASM 資源](/reference/create-app#shader-compiler)，讓 JavaScript 繫結與編譯器放在一起，並避免在執行期向 CDN 發出請求。

:::

啟動專案時，你會看到一塊空白畫布，可以改變寬高，或在 WebGL 與 WebGPU 渲染器之間切換。

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
            'https://unpkg.com/@antv/g-device-api@1.6.13/dist/pkg/glsl_wgsl_compiler_bg.wasm',
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

## 硬體抽象層 {#hardware-abstraction-layers}

我希望畫布使用更低階的渲染 API，例如 WebGL，以及 WebGL 的後繼者 WebGPU。WebGPU 有許多功能強化，請見 [從 WebGL 到 WebGPU]：

-   底層基於新一代原生 GPU API，包括 Direct3D12 / Metal / Vulkan 等。
-   無狀態 API，不再有難以管理的全域狀態。
-   支援 Compute Shader。
-   不再限制每個 `<canvas>` 能建立的 context 數量。
-   改善開發者體驗。包括更友善的錯誤訊息，以及可為 GPU 物件自訂標籤。

WebGPU 生態系現已延伸到 JavaScript、C++ 與 Rust，不少 Web 端渲染引擎（例如 Three.js、Babylon.js）正在接上，或已經完成接上。特別要提到 [wgpu]：除了遊戲引擎 [bevy] 之外，它也被 [Modyfi] 這類基於 Web 的創意設計工具用於正式環境，而且表現非常好。下圖來自：[WebGPU 生態系]

![2023 年的 WebGPU 生態系](https://developer.chrome.com/static/blog/webgpu-ecosystem/image/diagram-the-webgpu-ecosy-384594168a61_1920.png)

當然，考量瀏覽器相容性，我們仍然需要盡可能相容 WebGL1/2。在渲染引擎中，硬體抽象層（HAL）會抽象 GPU 硬體的細節，讓上層不必依賴特定的硬體實作。

我們希望盡可能提供一套基於 WebGL1/2 與 WebGPU 的統一 API，並一併處理 Shader 的翻譯與模組化。本課使用 [@antv/g-device-api]，它的實作參考了 [noclip]，並加入 WebGL1 相容性。安裝此相依性之前，請先參閱上方的安全性注意。

由於 WebGL 與 WebGPU 使用不同的著色器語言，而我們不想維護 GLSL 與 WGSL 兩套程式碼，因此選擇在執行期翻譯著色器：

![在執行期轉譯著色器](/shader-transpile.png)

專案中只需要維護一套使用 GLSL 300 語法的著色器：降級到 WebGL1 時替換關鍵字，交給 WASM 形式的 [編譯器](https://github.com/antvis/g-device-api/tree/master/rust)（使用 naga 與 naga-oil）之前先轉換成 GLSL 440，再轉成 WGSL。無獨有偶，[Three.js Shading Language] 也使用更高層的抽象，並同樣用編譯器為目標執行期平台輸出著色器程式碼。

下面展示頂點著色器中常用的 attribute 宣告。這是非常簡單的情境；一到紋理取樣，語法實際上會差很多。

```glsl
// GLSL 300
layout(location = 0) in vec4 a_Position;

// compiled GLSL 100
attribute vec4 a_Position;

// compiled GLSL 440
layout(location = 0) in vec4 a_Position;

// compiled WGSL
var<private> a_Position_1: vec4<f32>;
@vertex
fn main(@location(0) a_Position: vec4<f32>) -> VertexOutput {
    a_Position_1 = a_Position;
}
```

最近我讀到這篇文章：[Figma 渲染：由 WebGPU 驅動]，發現 Figma 也採用了類似的實作方式來完成 WebGPU 升級：

> 我們維持既有的 GLSL 著色器，以符合 WebGL 1 的格式撰寫。著色器處理器接著會自動把它們翻譯成 WGSL。這包含解析著色器、進行必要的翻譯以轉成較新版本的 GLSL，再執行開源工具 naga 把它們轉成 WGSL。

硬體抽象層就先談到這裡。如果你對實作細節有興趣，可以直接參考 [@antv/g-device-api] 的原始碼。本課最後一小節會用到其中一部分 API。

## 設計畫布 API {#design-the-canvas-api}

終於來到我們畫布 API 的設計部分。我們期待的簡單用法如下：

-   傳入 HTMLCanvasElement `<canvas>`，完成畫布的建立與初始化，包括使用硬體抽象層建立 Device（GPU 的抽象實例）。
-   建立渲染迴圈，持續呼叫畫布的渲染方法。
-   支援調整畫布大小，例如回應 `resize` 事件。
-   在適當的時機銷毀自身。

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

渲染迴圈在渲染引擎中非常常見，例如 Three.js 的 [渲染場景]，以及 CanvasKit 的 [基本繪製迴圈]。關於為什麼使用 `requestAnimationFrame` 而不是 `setTimeout`，請見 [JavaScript 中的高效能遊戲迴圈]。

看起來是很簡單的介面定義，但先別急著實作，因為這裡有非同步初始化的問題。

```ts
interface Canvas {
    constructor(config: { canvas: HTMLCanvasElement });
    render(): void;
    destroy(): void;
    resize(width: number, height: number): void;
}
```

### 非同步初始化 {#asynchronous-initialization}

這也是 WebGPU 與 WebGL 的一個重大差異。在 WebGL 中，取得 context 是同步過程；在 WebGPU 中，取得 Device 則是非同步的：

```ts
// create a context in WebGL
const gl = $canvas.getContext('webgl');

// obtaining a device in WebGPU
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
```

因此，使用上一節提到的硬體抽象層時，也必須採用非同步做法。對所有想從 WebGL 過渡到 WebGPU 的渲染引擎來說，這都是破壞性變更，例如 Babylon.js：[WebGPU 引擎的建立是非同步的]：

```ts
import {
    WebGLDeviceContribution,
    WebGPUDeviceContribution,
} from '@antv/g-device-api';

// create a device in WebGL
const deviceContribution = new WebGLDeviceContribution({
    targets: ['webgl2', 'webgl1'],
});
// create a device in WebGPU
const deviceContribution = new WebGPUDeviceContribution({
    shaderCompilerPath: '/glsl_wgsl_compiler_bg.wasm',
});
// here's the asynchronous process
const swapChain = await deviceContribution.createSwapChain($canvas);
const device = swapChain.getDevice();
// create GPU objects with Device API
```

由於 JavaScript 的建構子不支援非同步操作，因此為畫布加上非同步的 init 方法來完成初始化，並在初始化完成後呼叫渲染方法：

```ts
const canvas = new Canvas();
await canvas.init();
canvas.render();
```

但我不認為這是好做法。首先，`new` 關鍵字本身已經暗示了初始化。其次，init 方法看起來可以呼叫多次，實際上卻不行。受到 [JavaScript 的非同步建構子模式] 的啟發，我個人更喜歡下面這種語法：

```ts
const canvas = await new Canvas().initialized;
```

事實上，這個設計模式也有其他使用者，例如 Web Animations API 的 [Animation：ready 屬性]：

```ts
animation.ready.then(() => {});
```

### 實作 {#implementation}

在實作中，我們用一個私有變數保存 Promise，getter 也確保它是唯讀的：

```ts
export class Canvas {
    #instancePromise: Promise<this>;
    get initialized() {
        return this.#instancePromise.then(() => this);
    }
}
```

在建構子中使用立即呼叫的非同步函式運算式（IIAFE）來執行初始化：

```ts
constructor() {
  this.#instancePromise = (async () => {
    // Omit the specific implementation...
    return this;
  })();
}
```

讓我們繼續最佳化目前的設計。

## 以外掛為基礎的架構 {#plugin-based-architecture}

當然，我們可以把呼叫硬體抽象層的程式碼放在 Canvas 建構子裡，並在 `destroy` 方法中一起銷毀。然而，隨著初始化、渲染與銷毀階段要做的事情變多，Canvas 的邏輯會不斷膨脹。一開始很難把所有需要支援的功能都想清楚，因此我們希望畫布是可擴充的。

```ts
destroy() {
  this.device.destroy();
  this.eventManager.destroy();
  // Omit other tasks...
}
```

以外掛為基礎的架構是常見的設計模式，webpack、VS Code，甚至 Chrome 都看得到。它有下列特性：

-   模組化。每個外掛負責獨立的一部分，彼此耦合降低，較容易維護。
-   可擴充性。外掛可以在執行期動態載入與卸載，不影響核心模組的結構，讓應用程式具備動態擴充的能力。

這種架構通常包含下列部分：

-   主應用程式。它提供註冊外掛的功能，在適當時機呼叫外掛執行，並提供外掛執行所需的 context。
-   外掛介面。它是主應用程式與外掛之間的橋樑。
-   外掛集合。一組可獨立執行的模組，每個外掛遵循職責分離原則，只包含最少的必要功能。

主應用程式如何呼叫外掛執行？先看看 webpack 的做法：

-   在主應用程式中定義一系列鉤子。這些鉤子可以是同步或非同步，也可以是序列或平行。如果是同步且序列，它們就類似我們熟悉的一般事件監聽器。在下面的範例中，`run` 是同步序列鉤子。
-   每個外掛在註冊時監聽自己關心的生命週期事件。在下面的範例中，註冊期間會呼叫 `apply`。
-   主應用程式觸發這些鉤子。

```ts
class ConsoleLogOnBuildWebpackPlugin {
    apply(compiler) {
        compiler.hooks.run.tap(pluginName, (compilation) => {
            console.log('webpack starting...');
        });
    }
}
```

webpack 實作了 [tapable] 工具組來提供這些能力，並在大量呼叫的情境中使用 `new Function` 來提升效能，討論見 [new Function 的效能真的好嗎？]。不過我們可以沿著同樣的思路簡單實作。例如，同步序列執行的鉤子使用一個 `callbacks` 陣列，沒有黑魔法：

```ts
export class SyncHook<T> {
    #callbacks: ((...args: AsArray<T>) => void)[] = [];

    tap(fn: (...args: AsArray<T>) => void) {
        this.#callbacks.push(fn);
    }

    call(...argsArr: AsArray<T>): void {
        this.#callbacks.forEach(function (callback) {
            /* eslint-disable-next-line prefer-spread */
            callback.apply(void 0, argsArr);
        });
    }
}
```

我們定義下列鉤子，名稱能直接看出它們會在主應用程式的哪個階段被呼叫：

```ts
export interface Hooks {
    init: SyncHook<[]>;
    initAsync: AsyncParallelHook<[]>;
    destroy: SyncHook<[]>;
    resize: SyncHook<[number, number]>; // When height or width changed.
    beginFrame: SyncHook<[]>;
    endFrame: SyncHook<[]>;
}
```

包含這些鉤子的外掛 context 會在外掛註冊階段傳入，之後我們還會繼續擴充外掛 context：

```ts
export interface PluginContext {
    hooks: Hooks;
    canvas: HTMLCanvasElement;
}
export interface Plugin {
    apply: (context: PluginContext) => void;
}
```

在畫布初始化時呼叫 `apply` 並傳入 context，就完成了外掛註冊，並觸發同步與非同步鉤子的初始化。下一節實作的渲染外掛會完成非同步初始化：

```ts{8}
import { Renderer } from './plugins';

this.#instancePromise = (async () => {
  const { hooks } = this.#pluginContext;
  [new Renderer()].forEach((plugin) => {
    plugin.apply(this.#pluginContext);
  });
  hooks.init.call();
  await hooks.initAsync.promise();
  return this;
})();
```

現在我們已經具備實作第一個外掛所需的全部知識。

## 渲染器外掛 {#renderer-plugin}

我們希望支援 WebGL 與 WebGPU，因此在畫布建構子中透過 `renderer` 參數進行設定，之後再傳入外掛 context：

```ts{3}
constructor(config: {
  canvas: HTMLCanvasElement;
  renderer?: 'webgl' | 'webgpu';
}) {}

this.#pluginContext = {
  canvas,
  renderer,
};
```

接下來說明如何在渲染外掛中使用硬體抽象層。

### SwapChain {#swapchain}

在 OpenGL / WebGL 中，[預設 Framebuffer] 不同於一般的 Framebuffer Object（FBO）。初始化 context 時會自動建立預設 Framebuffer。呼叫繪製命令時如果沒有指定 FBO，OpenGL 會自動把渲染結果寫入預設 Framebuffer，其中的 Color Buffer 最終會顯示在螢幕上。

Vulkan 則不是這樣，而是使用 [SwapChain]。下圖來自 [Canvas Context 與 Swap Chain]，說明它的運作方式：GPU 把渲染結果寫入 backbuffer，frontbuffer 用來顯示到螢幕上，兩者可以交換。

![雙緩衝](https://res.cloudinary.com/dx1kpewvo/image/upload/v1670938992/2022-12-19/webgpu_swap_1_nnce5v.png)

如果沒有這種雙緩衝機制，GPU 寫入渲染結果的同時，螢幕很可能正在更新，從而造成撕裂。因此也需要使用垂直同步，強制顯示器在不允許的時機不更新。下圖來自 [Canvas Context 與 Swap Chain]，顯示這個過程的時序。

![雙緩衝與垂直同步](https://res.cloudinary.com/dx1kpewvo/image/upload/v1671030455/2022-12-19/webgpu_swap_5_asrq42.png)

在 WebGPU 中，使用者通常不能直接存取 SwapChain，它被整合進 [GPUCanvasContext]。同樣遵循 WebGPU 設計的 [wgpu] 把 SwapChain 合併進 [Surface]，使用者也不能直接存取。不過我們的硬體抽象層仍然用這個概念來封裝。這樣就能在外掛初始化期間，依照 `renderer` 參數建立 SwapChain 與 Device：

```ts{13}
import {
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import type { SwapChain, DeviceContribution, Device } from '@antv/g-device-api';

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
      const { width, height } = canvas;
      const swapChain = await deviceContribution.createSwapChain(canvas);
      swapChain.configureSwapChain(width, height);

      this.#swapChain = swapChain;
      this.#device = swapChain.getDevice();
    });
  }
}
```

### devicePixelRatio {#devicepixelratio}

[devicePixelRatio] 描述繪製單一 CSS 像素時應該使用多少實際螢幕像素。通常我們會用下面的程式碼設定 `<canvas>`：

```ts
const $canvas = document.getElementById('canvas');
$canvas.style.width = `${width}px`; // CSS Pixels
$canvas.style.height = `${height}px`;

const scale = window.devicePixelRatio;
$canvas.width = Math.floor(width * scale); // Screen Pixels
$canvas.height = Math.floor(height * scale);
```

描述畫布寬高與圖形尺寸時，我們使用 CSS 像素；建立 SwapChain 時則使用螢幕上的實際像素。`resize` 傳入的寬高也使用 CSS 像素，因此需要轉換：

```ts{3}
hooks.resize.tap((width, height) => {
  this.#swapChain.configureSwapChain(
    width * devicePixelRatio,
    height * devicePixelRatio,
  );
});
```

那麼要如何取得 [devicePixelRatio]？當然可以使用 `window.devicePixelRatio`，大多數情況下都沒問題。但如果執行環境中沒有 `window` 物件呢？例如：

-   Node.js 伺服器端渲染。例如使用 [headless-gl]
-   在 WebWorker 中渲染，使用 [OffscreenCanvas]。
-   小程式這類非標準瀏覽器環境

因此更好的做法是：建立畫布時支援傳入這個值，沒有傳入時再嘗試從 [globalThis] 取得。我們把 Canvas 的建構子參數修改如下：

```ts{2}
export interface CanvasConfig {
  devicePixelRatio?: number;
}

const { devicePixelRatio } = config;
const globalThis = getGlobalThis();
this.#pluginContext = {
  devicePixelRatio: devicePixelRatio ?? globalThis.devicePixelRatio,
};
```

其他鉤子的實作如下：

```ts
hooks.destroy.tap(() => {
    this.#device.destroy();
});

hooks.beginFrame.tap(() => {
    this.#device.beginFrame();
});

hooks.endFrame.tap(() => {
    this.#device.endFrame();
});
```

最後，把外掛加入畫布的外掛清單：

```ts{1}
[new Renderer(), ...plugins].forEach((plugin) => {
  plugin.apply(this.#pluginContext);
});
```

## 示範 {#demo}

由於我們還沒有繪製任何圖形，畫布是空白的，要怎麼知道底層呼叫了哪些 WebGL / WebGPU 命令？在 Web 端除錯可以使用 Chrome 外掛：[Spector.js] 與 [WebGPU Inspector]。

下圖是使用 Spector.js 擷取的第一幀命令，可以看到我們建立了一系列 GPU 物件，例如 FrameBuffer、Texture 等：

![Spector.js 快照](/spectorjs.png)

切換到 WebGPU 渲染之後：

```ts{3}
const canvas = await new Canvas({
  canvas: $canvas,
  renderer: 'webgpu',
}).initialized;
```

打開 WebGPU Inspector，就能看到目前建立的 GPU 物件，以及每一幀呼叫的命令：

![WebGPU Inspector 快照](/webgpu-inspector.png)

## 延伸閱讀 {#extended-reading}

如果你完全沒有 WebGL 的基礎，可以先試著學習：

-   [WebGL Fundamentals]
-   [WebGPU Fundamentals]

更多關於外掛設計模式的內容：

-   [外掛導向程式設計簡介]
-   [介紹：Penpot 外掛系統]
-   [Tiptap 中的擴充功能]

[WebGPU 生態系]: https://developer.chrome.com/blog/webgpu-ecosystem/
[從 WebGL 到 WebGPU]: https://developer.chrome.com/blog/from-webgl-to-webgpu
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[外掛導向程式設計簡介]: https://pop-book.readthedocs.io/en/latest/index.html
[wgpu]: https://wgpu.rs/
[bevy]: https://bevyengine.org/
[noclip]: https://github.com/magcius/noclip.website
[Modyfi]: https://digest.browsertech.com/archive/browsertech-digest-how-modyfi-is-building-with/
[JavaScript 的非同步建構子模式]: https://qwtel.com/posts/software/async-constructor-pattern/
[Animation：ready 屬性]: https://developer.mozilla.org/en-US/docs/Web/API/Animation/ready
[渲染場景]: https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene
[WebGPU 引擎的建立是非同步的]: https://doc.babylonjs.com/setup/support/WebGPU/webGPUBreakingChanges#creation-of-the-webgpu-engine-is-asynchronous
[Spector.js]: https://spector.babylonjs.com/
[WebGPU Inspector]: https://github.com/brendan-duncan/webgpu_inspector
[tapable]: https://github.com/webpack/tapable
[new Function 的效能真的好嗎？]: https://github.com/webpack/tapable/issues/162
[WebGL Fundamentals]: https://webglfundamentals.org/
[WebGPU Fundamentals]: https://webgpufundamentals.org/
[devicePixelRatio]: https://developer.mozilla.org/zh-CN/docs/Web/API/Window/devicePixelRatio
[headless-gl]: https://github.com/stackgl/headless-gl
[OffscreenCanvas]: https://developer.mozilla.org/zh-CN/docs/Web/API/OffscreenCanvas
[SwapChain]: https://vulkan-tutorial.com/Drawing_a_triangle/Presentation/Swap_chain
[預設 Framebuffer]: https://www.khronos.org/opengl/wiki/Default_Framebuffer
[globalThis]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
[Surface]: https://docs.rs/wgpu/latest/wgpu/struct.Surface.html
[GPUCanvasContext]: https://gpuweb.github.io/gpuweb/#canvas-context
[Canvas Context 與 Swap Chain]: https://carmencincotti.com/2022-12-19/how-to-render-a-webgpu-triangle-series-part-three-video/#bonus-content-swap-chain
[介紹：Penpot 外掛系統]: https://www.smashingmagazine.com/2024/11/open-source-meets-design-tooling-penpot/
[JavaScript 中的高效能遊戲迴圈]: https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/
[Tiptap 中的擴充功能]: https://tiptap.dev/docs/editor/core-concepts/extensions#what-are-extensions
[基本繪製迴圈]: https://skia.org/docs/user/modules/quickstart/#basic-draw-loop
[Three.js Shading Language]: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
[Figma 渲染：由 WebGPU 驅動]: https://www.figma.com/blog/figma-rendering-powered-by-webgpu/
