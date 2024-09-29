---
outline: deep
---

# 课程 1 - 初始化画布

在这节课中你将学习到以下内容：

-   基于 WebGL1/2 和 WebGPU 的硬件抽象层
-   画布 API 设计
-   实现一个简单的插件系统
-   基于硬件抽象层实现一个渲染插件

启动项目后将看到一个空画布，可以修改宽高或者切换 WebGL / WebGPU 渲染器。

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

## 硬件抽象层 {#hardware-abstraction-layers}

我希望画布使用 WebGL 和 WebGPU 这样更底层的渲染 API，作为 WebGL 的继任者，WebGPU 有非常多的特性增强，详见[From WebGL to WebGPU]：

-   底层基于新一代原生 GPU API，包括 Direct3D12 / Metal / Vulkan 等。
-   无状态式的 API，不用再忍受难以管理的全局状态。
-   支持 Compute Shader。
-   每个 `<canvas>` 创建的上下文数目不再有限制。
-   开发体验提升。包括更友好的错误信息以及为 GPU 对象添加自定义标签。

目前 WebGPU 的生态已经延伸到了 JavaScript、C++ 和 Rust 中，很多 Web 端渲染引擎（例如 Three.js、Babylon.js）都正在或者已完成了对它的接入。这里特别提及 [wgpu]，除了游戏引擎 [bevy]，像 [Modyfi] 这样的 Web 端创意类设计工具也已经将其用于生产环境，并有着非常好的表现。下图来自：[WebGPU Ecosystem]

![WebGPU ecosystem in 2023](https://developer.chrome.com/static/blog/webgpu-ecosystem/image/diagram-the-webgpu-ecosy-384594168a61_1920.png)

当然，考虑到浏览器兼容性，现阶段我们仍需要尽可能兼容 WebGL1/2。在渲染引擎中，硬件抽象层（Hardware Abstraction Layer，简称 HAL）将 GPU 硬件细节抽象化，使得上层可以不依赖于具体的硬件实现。

我们希望基于 WebGL1/2 和 WebGPU 尽可能提供一套统一的 API，同时提供 Shader 转译和模块化功能。[@antv/g-device-api] 参考了 [noclip] 的实现，在其基础上兼容了 WebGL1，我们也在一些可视化相关的项目中使用了它。

由于 WebGL 和 WebGPU 使用 Shader 语言不同，又不希望维护 GLSL 和 WGSL 两套代码，因此我们选择在运行时对 Shader 进行转译：

![Transpile shader at runtime](/shader-transpile.png)

在项目中只需要维护一套使用 GLSL 300 语法的 Shader，降级到 WebGL1 时进行关键词替换即可，在 WebGPU 环境下先转换成 GLSL 440 再交给 WASM 格式的[编译器](https://github.com/antvis/g-device-api/tree/master/rust)（使用了 naga 和 naga-oil ）转译成 WGSL。

下面展示了 Vertex Shader 中常用的 attribute 声明。这只是一个非常简单的场景，实际上涉及到纹理采样部分的语法差别非常大。

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

好了，关于硬件抽象层部分已经介绍地够多了，如果对其中的实现细节感兴趣可以直接参考 [@antv/g-device-api] 源码。在本节课最后一小节中我们会使用到其中的部分 API。

## 画布 API 设计 {#design-the-canvas-api}

终于进入到了我们的画布 API 设计部分。我们期待的简单用法如下：

-   传入一个 HTMLCanvasElement `<canvas>` 完成画布的创建和初始化工作，包括使用硬件抽象层创建 Device（GPU 的抽象实例）
-   创建一个渲染循环，不断调用画布的渲染方法
-   支持重新设置画布宽高，例如响应 `resize` 事件
-   适时销毁

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

其中渲染循环的用法在渲染引擎中十分常见，例如 Three.js 中的 [Rendering the scene]。

看起来接口定义非常简单，但我们先不急着实现，因为这里存在一个异步初始化问题。

```ts
interface Canvas {
    constructor(config: { canvas: HTMLCanvasElement });
    render(): void;
    destroy(): void;
    resize(width: number, height: number): void;
}
```

### 异步初始化 {#asynchronous-initialization}

这也是 WebGPU 和 WebGL 的一大差异，在 WebGL 中获取上下文是同步的，而 WebGPU 获取 Device 是一个异步过程：

```ts
// 在 WebGL 中创建上下文
const gl = $canvas.getContext('webgl');

// 在 WebGPU 中获取 Device
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
```

因此在使用我们在上一节提到的硬件抽象层时，也只能使用异步方式。这一点对于所有希望从 WebGL 过渡到 WebGPU 的渲染引擎都是 Breaking Change，例如 Babylon.js [Creation of the WebGPU engine is asynchronous]：

```ts
import {
    WebGLDeviceContribution,
    WebGPUDeviceContribution,
} from '@antv/g-device-api';

// 创建一个 WebGL 的设备
const deviceContribution = new WebGLDeviceContribution({
    targets: ['webgl2', 'webgl1'],
});
// 或者创建一个基于 WebGPU 的设备
const deviceContribution = new WebGPUDeviceContribution({
    shaderCompilerPath: '/glsl_wgsl_compiler_bg.wasm',
});
// 这里是一个异步操作
const swapChain = await deviceContribution.createSwapChain($canvas);
const device = swapChain.getDevice();
// 调用 Device API 创建 GPU 对象
```

由于 JavaScript 中的构造函数不支持异步，因此为画布添加一个异步的 `init` 方法，初始化完成后再调用渲染方法：

```ts
const canvas = new Canvas();
await canvas.init();
canvas.render();
```

但我觉得这样并不好，首先 `new` 关键字已经表示了初始化含义，其次 `init` 方法似乎可以多次调用但实际上并不行。受 [Async Constructor Pattern in JavaScript] 启发，个人更倾向下面一种写法：

```ts
const canvas = await new Canvas().initialized;
```

事实上，例如 Web Animations API 的 [Animation: ready property] 也使用了这种设计模式：

```ts
animation.ready.then(() => {});
```

### 实现 {#implementation}

在实现中我们使用一个私有变量持有 Promise，getter 也能确保它是只读的：

```ts
export class Canvas {
    #instancePromise: Promise<this>;
    get initialized() {
        return this.#instancePromise.then(() => this);
    }
}
```

在构造函数中使用立即执行的异步函数表达式（IIAFE）完成初始化工作：

```ts
constructor() {
  this.#instancePromise = (async () => {
    // 执行异步初始化
    return this;
  })();
}
```

让我们继续优化目前的设计。

## 插件系统 {#plugin-based-architecture}

我们当然可以把调用硬件抽象层的代码放在 Canvas 的构造函数中，并在 `destroy` 方法中一并销毁。但后续在初始化、渲染、销毁阶段增加更多任务时，Canvas 的逻辑也会不断膨胀。我们很难在开始阶段就把所有需要支持的功能都想清楚，因此希望画布是具有可扩展性的。

```ts
destroy() {
  this.device.destroy();
  this.eventManager.destroy();
  // 省略更多需要在销毁阶段触发的任务
}
```

基于插件的架构是一种常见的设计模式，在 Webpack、VSCode 甚至是 Chrome 中都能看到它的身影。它有以下特点：

-   模块化。每个插件负责独立的部分，相互之间耦合度降低，更容易维护。
-   可扩展性。插件可以在运行时动态加载和卸载，不影响核心模块的结构，实现了应用程序的动态扩展能力。

通常该架构由以下部分组成：

-   主应用。提供插件的注册功能，在合适阶段调用插件执行，同时为插件提供运行所需的上下文。
-   插件接口。主应用和插件之间的桥梁。
-   插件集。一系列可独立执行的模块，每个插件遵循职责分离原则，仅包含所需的最小功能。

主应用如何调用插件执行呢？不妨先看看 webpack 的思路：

-   在主应用中定义一系列钩子，这些钩子可以是同步或异步，也可以是串行或并行。如果是同步串行，就和我们常见的事件监听一样了。在下面的例子中 `run` 就是一个同步串行钩子。
-   每个插件在注册时，监听自己关心的生命周期事件。下面例子中 `apply` 会在注册时调用。
-   主应用执行钩子。

```ts
class ConsoleLogOnBuildWebpackPlugin {
    apply(compiler) {
        compiler.hooks.run.tap(pluginName, (compilation) => {
            console.log('webpack 构建正在启动！');
        });
    }
}
```

webpack 实现了 [tapable] 工具库提供以上能力，为了提升大量调用场景下的性能还使用了 `new Function` 这样的手段，详见：[Is the new Function performance really good?] 的讨论。但我们只需要参考它的思路简单实现，例如同步串行执行的钩子使用了 `callbacks` 数组，没有任何黑科技：

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

我们定义以下钩子，名称直观反映了它们会在主应用的哪个阶段被调用：

```ts
export interface Hooks {
    init: SyncHook<[]>; // 初始化阶段
    initAsync: AsyncParallelHook<[]>; // 初始化阶段
    destroy: SyncHook<[]>; // 销毁阶段
    resize: SyncHook<[number, number]>; // 宽高改变时
    beginFrame: SyncHook<[]>; // 渲染阶段
    endFrame: SyncHook<[]>; // 渲染阶段
}
```

包含这些钩子的插件上下文在插件注册阶段被传入，后续我们会继续扩展插件上下文：

```ts
export interface PluginContext {
    hooks: Hooks;
    canvas: HTMLCanvasElement;
}
export interface Plugin {
    apply: (context: PluginContext) => void;
}
```

在画布初始化时调用 `apply` 方法并传入上下文完成插件的注册，同时触发初始化同步和异步钩子，在下一节中我们实现的渲染插件会完成异步初始化：

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

现在我们拥有了所需的全部知识，可以实现第一个插件了。

## 渲染插件 {#renderer-plugin}

我们希望支持 WebGL 和 WebGPU，因此在画布构造函数中支持通过 `renderer` 参数配置，随后传入插件上下文：

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

接下来我们介绍如何在渲染插件中使用硬件抽象层。

### SwapChain {#swapchain}

在 OpenGL / WebGL 中 [Default Framebuffer] 和通常的 Framebuffer Object(FBO) 不同，它是在初始化上下文时自动创建的。在调用绘制命令时如果没有特别指定 FBO，OpenGL 会自动将渲染结果写入 Default Framebuffer，其中的颜色缓冲区 Color Buffer 最终会显示在屏幕上。

但 Vulkan 中没有这个概念，取而代之的是 [SwapChain]，下图来自 [Canvas Context and Swap Chain] 展示了它的工作原理。GPU 向后缓冲中写入渲染结果，前缓冲用于向屏幕展示，两者可以交换。

![Double buffering](https://res.cloudinary.com/dx1kpewvo/image/upload/v1670938992/2022-12-19/webgpu_swap_1_nnce5v.png)

如果不使用这种双缓冲机制，由于屏幕的刷新频率和 GPU 写入渲染结果的频率不一致，就很有可能出现前者更新时恰好后者在写入的情况，此时会造成撕裂现象。因此还需要配合垂直同步，强制展示时不允许更新，下图来自 [Canvas Context and Swap Chain] 展示了这一过程的时序图。

![Double buffering and V-Sync](https://res.cloudinary.com/dx1kpewvo/image/upload/v1671030455/2022-12-19/webgpu_swap_5_asrq42.png)

在 WebGPU 中使用者通常不会直接接触到 SwapChain，这部分功能被整合进了 [GPUCanvasContext] 中。同样遵循 WebGPU 设计的 [wgpu] 将 SwapChain 合并到了 [Surface] 中，使用者同样也不会直接接触到。但我们的硬件抽象层仍使用了这一概念进行封装。这样在插件初始化时，就可以根据 `renderer` 参数创建 SwapChain 和 Device：

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

[devicePixelRatio] 描述了单个 CSS 像素应该用多少屏幕实际像素来绘制。通常我们会使用如下代码设置 `<canvas>`：

```ts
const $canvas = document.getElementById('canvas');
$canvas.style.width = `${width}px`; // CSS 像素
$canvas.style.height = `${height}px`;

const scale = window.devicePixelRatio;
$canvas.width = Math.floor(width * scale); // 屏幕实际像素
$canvas.height = Math.floor(height * scale);
```

我们在描述画布宽高、图形尺寸时使用 CSS 像素，而在创建 SwapChain 时使用屏幕实际像素。在 `resize` 时传入的宽高也使用了 CSS 像素，因此需要进行转换：

```ts{3}
hooks.resize.tap((width, height) => {
  this.#swapChain.configureSwapChain(
    width * devicePixelRatio,
    height * devicePixelRatio,
  );
});
```

那么如何获取 [devicePixelRatio] 呢？当然我们可以直接使用 `window.devicePixelRatio` 获取，绝大部分情况下都没有问题。但如果运行的环境中没有 `window` 对象呢？例如：

-   Node.js 服务端渲染。例如使用 [headless-gl]
-   在 WebWorker 中渲染，使用 [OffscreenCanvas]
-   小程序等非标准浏览器环境

因此更好的做法是支持创建画布时传入，未传入时再尝试从 [globalThis] 中获取。我们对 Canvas 的构造函数参数进行如下修改：

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

其他钩子实现如下：

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

最后，将该插件添加到画布的插件列表中：

```ts{1}
[new Renderer(), ...plugins].forEach((plugin) => {
  plugin.apply(this.#pluginContext);
});
```

## 效果展示 {#demo}

由于还没有绘制任何图形，画布一片空白，我们如何知道底层 WebGL / WebGPU 命令的调用情况呢？在 Web 端调试可以使用 Chrome 浏览器插件：[Spector.js] 和 [WebGPU Inspector]。

下图展示了使用 Spector.js 捕捉到的首帧命令，可以看到我们创建了一系列 FrameBuffer、Texture 等 GPU 对象：

![Spector.js snapshot](/spectorjs.png)

切换到 WebGPU 渲染后：

```ts{3}
const canvas = await new Canvas({
  canvas: $canvas,
  renderer: 'webgpu',
}).initialized;
```

打开 WebGPU Inspector 可以看到当前我们创建的 GPU 对象和每一帧调用的命令：

![WebGPU inspector snapshot](/webgpu-inspector.png)

## 扩展阅读 {#extended-reading}

如果你完全没有 WebGL 基础，可以先尝试学习：

-   [WebGL Fundamentals]
-   [WebGPU Fundamentals]

更多关于插件设计模式的介绍：

-   [Intro to Plugin Oriented Programming]

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
[Is the new Function performance really good?]: https://github.com/webpack/tapable/issues/162
[WebGL Fundamentals]: https://webglfundamentals.org/
[WebGPU Fundamentals]: https://webgpufundamentals.org/
[devicePixelRatio]: https://developer.mozilla.org/zh-CN/docs/Web/API/Window/devicePixelRatio
[headless-gl]: https://github.com/stackgl/headless-gl
[OffscreenCanvas]: https://developer.mozilla.org/zh-CN/docs/Web/API/OffscreenCanvas
[SwapChain]: https://vulkan-tutorial.com/Drawing_a_triangle/Presentation/Swap_chain
[Default Framebuffer]: https://www.khronos.org/opengl/wiki/Default_Framebuffer
[globalThis]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
[Surface]: https://docs.rs/wgpu/latest/wgpu/struct.Surface.html
[GPUCanvasContext]: https://gpuweb.github.io/gpuweb/#canvas-context
[Canvas Context and Swap Chain]: https://carmencincotti.com/2022-12-19/how-to-render-a-webgpu-triangle-series-part-three-video/#bonus-content-swap-chain
