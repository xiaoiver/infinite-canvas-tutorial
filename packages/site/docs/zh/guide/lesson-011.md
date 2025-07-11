---
outline: deep
description: '搭建包含Jest单元测试、视觉回归测试的完整测试环境。实现基于headless-gl的服务端渲染和Playwright的E2E测试方案。'
---

# 课程 11 - 截图测试与服务端渲染

目前我们的画布功能在逐渐变得复杂，是时候引入测试来提升项目质量了。在这节课中你将学习到以下内容：

-   基于 Jest 的测试环境搭建，包含本地和 CI 环境
-   使用单元测试提升代码覆盖率
-   视觉回归测试
    -   基于 headless-gl 的 WebGL1 服务端渲染方案
    -   基于 Playwright 的 WebGL2 / WebGPU 端到端测试方案
-   E2E 测试
-   浏览器兼容性测试
-   在 WebWorker 中渲染画布

以上所有工程相关代码都可以在我们项目的 [\_\_tests\_\_] 文件夹下找到。

## 配置基础环境 {#jest-configuration}

在测试框架上我们选择 Jest，在 `package.json` 中加入测试命令，统计代码覆盖率：

```json
"scripts": {
    "cov": "jest --coverage"
}
```

在 GitHub workflow 中执行测试命令 `pnpm cov`，前面的 `xvfb-run` 命令等介绍到服务端渲染时再介绍：

```yaml
- name: Cov
run: |
    xvfb-run -s "-ac -screen 0 1280x1024x16" pnpm cov
env:
    CI: true
- name: Coveralls
uses: coverallsapp/github-action@master
with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

由于使用了 `d3-color`，我们会遇到一个常见的问题。由于 D3 默认只提供 ESM 产物，在 Node.js 中是无法直接运行的。此时我们有两种选择：

1. Jest 提供了 [transformIgnorePatterns] 配置项，可以将 `d3-color` 甚至是 D3 相关依赖都加入，将它们编译成 CJS
2. 使用 D3 的替代库 [victory-vendor]，功能上完全一致，只是额外提供 CJS 产物，详见：[d3-color issue in recharts]

我们选择第一种方式：

```js
const esm = ['d3-*'].map((d) => `_${d}|${d}`).join('|');
module.exports = {
    transformIgnorePatterns: [`<rootDir>/node_modules/(?!(?:.pnpm/)?(${esm}))`],
};
```

测试环境准备完毕，现在可以开始编写第一个测试用例了。

## 单元测试 {#unit-test}

首先来看最容易实现的单元测试，它适合测试与渲染无关的功能，例如设置图形属性，计算包围盒大小，拾取判定，各种工具方法等等。

```ts
// __tests__/unit/circle.spec.ts
import { Circle } from '../../packages/core/src';

describe('Circle', () => {
    it('should get/set attributes correctly.', () => {
        const circle = new Circle({
            cx: 50,
            cy: 50,
            r: 50,
            fill: '#F67676',
        });
        expect(circle.cx).toBe(50);
    });
});
```

看起来不错，我们将 Circle 的测试覆盖率提升到了 100%

```bash
------------------------------|---------|----------|---------|---------|-----------------------
File                          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------------|---------|----------|---------|---------|-----------------------
All files                     |   14.21 |    10.44 |    8.18 |   14.29 |
 src/shapes                   |   26.81 |    22.64 |   21.62 |   28.15 |
  Circle.ts                   |     100 |      100 |     100 |     100 |
```

但是单元测试也有它的局限性，毕竟它只针对代码的一小部分，无法保证整个系统作为一个整体正常运行。例如我们也许可以判断一个圆画的是否正确，但如果是 100 个呢？写测试断言的时间和难度都会大大增加。

## 视觉回归测试 {#visual-regression-testing}

在测试领域，"golden image"（黄金图像）是一个术语，用于描述一组测试用例中的标准或参考图像。这个术语通常用于视觉回归测试（Visual Regression Testing），这是一种自动化测试方法，通过比较应用程序或网站的屏幕截图与一组预先定义的参考图像来检测视觉变化。

对于渲染引擎来说，相比单元测试，它更容易验证渲染结果的正确性，可以大大减少手动断言的编写。[pixelmatch] 可以很方便地进行图片比对，高亮展示差异部分：

![pixelmatch](/pixelmatch.png)

在 Node.js 中获取截图有两种思路：

1. 服务端渲染。依据不同的渲染技术选择对应的 Node.js 实现即可：

    - [node-canvas] 基于 Cairo 实现的 Canvas
    - [jsdom] DOM 和 HTML 的纯 JS 实现
    - [headless-gl] 支持创建一个 WebGL 上下文，但是仅支持 WebGL1

2. 无头浏览器。例如早期的 puppeteer、electron 或者较新的 Playwright

不妨看看目前流行的渲染引擎都采用了哪些方案：

-   [Three.js Puppeteer]
-   Babylon.js 之前使用 Jest + Puppeteer，目前已经换成了 Playwright，详见：[Move visualization testing to playwright]
-   luma.gl 使用 headless-gl。详见：[Register devices]
-   plot 使用 [mocha + JSDOM]

我们分别探索一下这两种方案。

### 服务端渲染 {#server-side-rendering}

虽然基于 headless-gl 实现的服务端渲染方案仅支持 WebGL1。但服务端渲染也有其适合的场景：

-   弱交互甚至是无需交互的场景
-   对实时性要求不高，可以离线生成无运行时性能问题
-   产物为像素图或矢量图，可跨端展示

要支持服务端渲染，需要保证我们的代码能运行在 Node.js 环境，那代码中对于 DOM API 的调用应该如何处理呢？第一种思路是根据环境判断，例如只有在浏览器环境下才注册事件监听器，调用 `addEventListener()` 方法：

```ts{2}
const plugins = [
    isBrowser ? new DOMEventListener() : undefined,
    //...
];
```

另一种思路可以参考 [d3-selector]，我们注意到它并没有假定全局变量 `document` 的存在，而是选择从上下文中获取，这样上层就有机会传入类似 `jsdom` 这样的 DOM API 纯 JS 实现，也就能在服务端运行了。

```ts{3}
function creatorInherit(name) {
  return function() {
    var document = this.ownerDocument,
        uri = this.namespaceURI;
    return uri === xhtml && document.documentElement.namespaceURI === xhtml
        ? document.createElement(name)
        : document.createElementNS(uri, name);
  };
}
```

同样的思路在 [react-reconciler] 中也能见到，不同运行环境例如 DOM、Canvas、控制台等只需要实现配置中约定的接口：

> A "host config" is an object that you need to provide, and that describes how to make something happen in the "host" environment (e.g. DOM, canvas, console, or whatever your rendering target is). It looks like this:

```ts
const HostConfig = {
    createInstance(type, props) {
        // e.g. DOM renderer returns a DOM node
    },
    // ...
    appendChild(parent, child) {
        // e.g. DOM renderer would call .appendChild() here
    },
    // ...
};
```

Vite 的 [Environment API] 也尝试解决类似的问题：

> The changes started by the Runtime API are now prompting a complete review of the way Vite handles environments (client, SSR, workerd, etc).

回到我们的场景，需要提供以下配置项供 Node.js 环境使用：

```ts
export interface CanvasConfig {
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
     */
    devicePixelRatio?: number;
    /**
     * There is no `style.cursor = 'pointer'` in WebWorker.
     */
    setCursor?: (cursor: Cursor | string) => void;
}
```

#### 生成 PNG {#ssr-png}

使用 [headless-gl] 可以创建一个 WebGLRenderingContext 并封装成一个类 HTMLCanvasElement 对象。稍后使用它就可以正常创建画布了：

```ts
export function getCanvas(width = 100, height = 100) {
    let gl = _gl(width, height, {
        antialias: false,
        preserveDrawingBuffer: true,
        stencil: true,
    });

    const mockedCanvas: HTMLCanvasElement = {
        width,
        height,
        getContext: () => {
            gl.canvas = mockedCanvas;
            return gl;
        },
        addEventListener: () => {},
    };

    return mockedCanvas;
}
```

拿到 WebGLRenderingContext 后，就可以调用 [readPixels] 获取指定区域内的像素值，随后写入 PNG 中就得到了基准图片。

```ts
async function writePNG(gl: WebGLRenderingContext, path: string) {
    const width = gl.canvas.width;
    const height = gl.canvas.height;

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    await createPNGFromRawdata(path, width, height, pixels);
}
```

每次运行测试时就可以通过 [pixelmatch] 对比基准图片和本次测试生成的图片，同时将差异部分也写入文件便于查看。这里使用 Jest 提供的自定义断言扩展：

```ts
// useSnapshotMatchers.ts
// @see https://jestjs.io/docs/26.x/expect#expectextendmatchers
expect.extend({
    toMatchWebGLSnapshot,
    toMatchSVGSnapshot,
});

// Diff with golden image in test case.
expect($canvas.getContext()).toMatchWebGLSnapshot(dir, 'rect');
```

完整代码详见：[toMatchWebGLSnapshot.ts]

#### 生成 SVG {#ssr-svg}

为了测试我们的图片导出功能，我们需要为 ImageExporter 提供 [jsdom] 和 [xmlserializer] 作为浏览器环境的替代品。前者用来在 Node.js 环境中创建 SVGElement，后者用来将其序列化成字符串：

```ts{6,7}
import xmlserializer from 'xmlserializer';
import { JSDOM } from 'jsdom';

const exporter = new ImageExporter({
    canvas,
    document: new JSDOM().window._document,
    xmlserializer,
});
```

得到 SVGElement 的字符串就可以写入文件了，写入之前我们还可以用 prettier 格式化一下便于阅读：

```ts{11}
import xmlserializer from 'xmlserializer';
import { format } from 'prettier';

export function toMatchSVGSnapshot(
    dom: SVGElement | null,
    dir: string,
    name: string,
    options: ToMatchSVGSnapshotOptions = {},
) {
    let actual = dom
      ? format(xmlserializer.serializeToString(dom), {
          parser: 'babel',
        })
}
```

完整代码详见：[toMatchSVGSnapshot.ts]

#### 测试交互 {#how-to-mock-event}

使用 JSDOM 可以模拟类似 `MouseEvent` 这样的交互事件，创建后直接触发对应 Hook，这样可以绕过需要通过 DOM API 监听事件的限制：

```ts
const window = new JSDOM().window;

const pointerdownEvent = new window.MouseEvent('pointerdown', {
    clientX: 100,
    clientY: 100,
});
canvas.pluginContext.hooks.pointerDown.call(pointerdownEvent);
```

这样也很容易模拟类似拖拽这样的组合事件。下面的测试用例展示了对于 [拖拽插件] 判定阈值的测试。我们模拟了一组连续的 `pointerdown` `pointermove` 和 `pointerup` 事件，但由于相邻事件间隔太短并且距离过近，将不会触发 `dragstart` 事件：

```ts
const dragstartHandler = jest.fn();

canvas.root.addEventListener('dragstart', dragstartHandler);
canvas.pluginContext.hooks.pointerDown.call(
    createMouseEvent('pointerdown', { clientX: 100, clientY: 100 }),
);
canvas.pluginContext.hooks.pointerMove.call(
    createMouseEvent('pointermove', { clientX: 101, clientY: 101 }),
);
canvas.pluginContext.hooks.pointerUp.call(
    createMouseEvent('pointerup', { clientX: 101, clientY: 101 }),
);
expect(dragstartHandler).not.toBeCalled();
```

#### CI 环境配置 {#ssr-ci}

[headless-gl] 在 CI 环境运行需要进行一些额外的依赖安装，详见 [How can I use headless-gl with a continuous integration service?]

```yaml
- name: Install headless-gl dependencies
    run: |
        sudo apt-get update
        sudo apt-get install -y mesa-utils xvfb libgl1-mesa-dri libglapi-mesa libosmesa6

- name: Cov
    run: |
        xvfb-run -s "-ac -screen 0 1280x1024x16" pnpm cov
```

完整代码详见：[github workflows - test]

### 无头浏览器 {#headless-browser}

尽管服务端渲染很好，但无头浏览器方案在测试中还是有其不可替代的优势，以 Playwright 为例：

-   使用最新的 Chrome 可以支持 WebGL 1/2 甚至 WebGPU
-   官方直接提供了 toHaveScreenshot 这样的断言，内置像素级对比，失败后在 report 中展示 diff，详见：[Visual comparisons]
-   支持 [sharding] 在 CI 上支持多机器并行

#### 启动开发服务器 {#run-webserver}

Playwright 浏览器需要访问部署在开发服务器上的测试用例，我们选择 Vite 作为测试用服务器：

```ts{6}
import { devices, defineConfig } from '@playwright/test';

export default defineConfig({
    // Run your local dev server before starting the tests
    webServer: {
        command: 'npm run dev:e2e', // vite dev
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
    },
});
```

#### 访问测试用例 {#browse-testcase}

启动服务器后访问测试用例对应的 URL：

```ts
test(name, async ({ page, context }) => {
    const url = `./infinitecanvas/?name=${name}`;
    await page.goto(url);
    await readyPromise;

    await expect(page.locator('canvas')).toHaveScreenshot(`${name}.png`);
});
```

生成的测试报告中会直观展示本次结果与基准图片间的对比：

![Playwright image diff](/playwright-image-diff.png)

在实际使用中，我发现在本地生成的截图常常和 CI 环境存在细微差异。例如下图左侧为我的本地环境生成的截图，右侧为 CI 环境生成的，一些矩形有怪异的斜线。
此时可以使用 CI 环境而非本地生成的基准图片来保证一致性。上传 GitHub workflow artifacts 就可以获取 CI 环境的截图，下载到本地作为基准图片。

![Diff between local and CI environments](/playwright-local-vs-ci.png)

#### WebGL2 & WebGPU {#webgl2-webgpu}

相比基于 [headless-gl] 服务端渲染的方案，端到端测试方案的最大优势就在于支持 WebGL2 和 WebGPU。我们可以只编写一套测试案例，根据 URL 中的渲染器配置项创建画布，分别生成 WebGL2 和 WebGPU 下的基准图片。

```ts
['webgl', 'webgpu'].forEach((renderer) => {
    test(`${name} with ${renderer}`, async ({ page, context }) => {
        const url = `./infinitecanvas/?name=${name}`; // [!code --]
        const url = `./infinitecanvas/?name=${name}&renderer=${renderer}`; // [!code ++]
        await page.goto(url);
        await expect(page.locator('canvas')).toHaveScreenshot([
            renderer,
            `${name}.png`,
        ]);
    });
});
```

#### CI 环境配置 {#e2e-ci}

之前提到过，[sharding] 在 CI 上支持多机器并行，每个机器又可以开启多线程。例如我们使用 4 个机器，每个机器开 10 个 worker 并行，最后将 report 合并成一份。

```yaml
jobs:
    e2e:
        timeout-minutes: 60
        runs-on: ubuntu-latest
        strategy:
            fail-fast: false
            matrix:
                shard: [1/4, 2/4, 3/4, 4/4]
```

运行效果如下，详见：[E2E action]

![Playwright sharding](/playwright-sharding.png)

## E2E 测试 {#e2e-test}

[Playwright Components (experimental)] 支持对 React、Svelte、Vue 等 UI 框架进行组件粒度的测试。相比正常使用 `@playwright/test` 编写测试用例时，参数对象中增加了一个 `mount` 方法：

```ts{3}
import { test, expect } from '@playwright/experimental-ct-react';

test('should work', async ({ mount }) => {
  const component = await mount(<HelloWorld msg="greetings" />);
  await expect(component).toContainText('Greetings');
});
```

[Lit Testing] 中推荐的测试框架并不包含 Playwright，但我们可以使用社区中的 [Playwright Web component testing] 测试我们的 [Web Components]。

```ts
import { defineConfig } from '@playwright/test'; // [!code --]
import { defineConfig } from '@sand4rt/experimental-ct-web'; // [!code ++]

export default defineConfig({});
```

下面就可以针对我们的 Web Component 组件编写测试了。

### 测试 Web Component {#webcomponent-test}

以相机缩放工具栏组件为例，我们可以测试 `zoom` 属性是否被正确展示：

```ts
import { test, expect } from '@sand4rt/experimental-ct-web';
import { ZoomToolbar } from '../../packages/ui/src';

test('should display zoom correctly.', async ({ mount }) => {
    const component = await mount(ZoomToolbar, {
        props: {
            zoom: 100,
        },
    });
    await expect(component).toContainText('100%');
});
```

## 浏览器兼容性测试 {#browser-compatibility-test}

BrowserStack 是一个云测试平台，它提供了一系列工具和服务，用于在不同的浏览器、操作系统、设备和真实环境中测试 Web 和移动应用程序。BrowserStack 允许开发者和 QA（质量保证）团队在各种配置上测试他们的应用程序，以确保兼容性、性能和用户体验。

Babylon.js 在兼容性测试中就使用了 [browserstack-local]。

## 在 WebWorker 中运行 {#rendering-in-webworker}

除了服务端，WebWorker 也算是一种特殊的运行时环境。在 WebWorker 中运行渲染代码可以避免阻塞主线程，提高性能。知名渲染引擎都会提供使用案例：

-   [Three.js OffscreenCanvas]
-   [Babylon.js OffscreenCanvas]

在我们的 [WebWorker 示例] 中，由于主线程并不忙碌因此体现不出它的优势。但还是可以体验画布交互例如缩放、平移和旋转相机、拾取图形等功能。

### 创建 OffscreenCanvas {#offscreen-canvas}

首先需要确保运行环境支持 OffscreenCanvas，参考 [Can I use OffscreenCanvas?]：

```ts
if ('OffscreenCanvas' in window && 'transferControlToOffscreen' in mainCanvas) {
    // Ok to use offscreen canvas
}
```

然后需要让我们的画布支持从 OffscreenCanvas 创建：

```ts
export interface CanvasConfig {
    canvas: HTMLCanvasElement; // [!code --]
    canvas: HTMLCanvasElement | OffscreenCanvas; // [!code ++]
}
```

主线程代码如下：

1. 首先通过 [transferControlToOffscreen] 将主画布的控制权转移到 OffscreenCanvas 中
2. 创建一个 WebWorker，这里使用 Vite 提供的方式。监听后续传递过来的消息，例如设置鼠标样式等
3. 通常我们会通过 [postMessage] 的第一个参数向 WebWorker 传参，但由于 OffscreenCanvas 是 [Transferable] 的，因此这里需要使用到第二个参数

```ts
// @see https://vitejs.dev/guide/features.html#import-with-query-suffixes
import Worker from './worker.js?worker&inline';

// 1.
const offscreenCanvas = mainCanvas.transferControlToOffscreen();

// 2.
worker = new Worker();
worker.onmessage = function (event) {
    // TODO: Handle message from WebWorker later.
};

// 3.
worker.postMessage(
    {
        type: 'init',
        offscreenCanvas,
        devicePixelRatio,
        boundingClientRect: mainCanvas.getBoundingClientRect(),
    },
    [offscreenCanvas],
);
```

WebWorker 代码如下：

1. 从事件对象中获取主线程传递过来的 OffscreenCanvas
2. 使用 OffscreenCanvas 创建画布，并设置 devicePixelRatio
3. 创建 [渲染循环]，正常创建图形并添加到画布中

```ts
// worker.js
self.onmessage = function (event) {
    const { type } = event.data;
    if (type === 'init') {
        // 1.
        const { offscreenCanvas, devicePixelRatio } = event.data;

        (async () => {
            // 2.
            const canvas = await new Canvas({
                canvas: offscreenCanvas,
                devicePixelRatio,
            }).initialized;

            // 3.
            const animate = () => {
                canvas.render();
                self.requestAnimationFrame(animate);
            };
            animate();
        })();
    }
    // ...Handle other messages.
};
```

在实际使用中，不可避免地需要手动处理主线程和 WebWorker 间的通信，例如：

1. 交互事件。[事件系统]依赖 DOM API，但 WebWorker 中无法使用，因此需要监听主线程画布的交互事件并通知 WebWorker。
2. 画布尺寸改变。同上。
3. 设置主画布鼠标样式。

### 交互事件 {#events-in-webworker}

以 `pointerdown` 事件为例，我们在主画布上监听它，由于原生 Event 不是 [Transferable] 的，因此需要将它序列化后传递给 WebWorker：

```ts
mainCanvas.addEventListener(
    'pointerdown',
    (e) => {
        worker.postMessage({
            type: 'event',
            name: 'pointerdown',
            event: clonePointerEvent(e), // 简单拷贝事件对象上的常用属性
        });
    },
    true,
);
```

在 WebWorker 中接收到该类消息后，直接触发对应的 Hook：

```ts
self.onmessage = function (event) {
    const { type } = event.data;
    if (type === 'event') {
        const { name, event: ev } = event.data;
        if (name === 'pointerdown') {
            canvas.pluginContext.hooks.pointerDown.call(ev);
        }
    }
};
```

画布尺寸改变同理。

### 设置鼠标样式 {#set-cursor}

渲染过程中 WebWorker 也需要向主线程传递消息，例如：

-   每一帧通知主线程渲染完毕，传递实际渲染图形、被剔除图形数量等统计数据
-   拾取到图形时设置鼠标样式

```ts
setCursor: (cursor) => {
    self.postMessage({ type: 'cursor', cursor });
},
```

主线程接收到消息后设置画布鼠标样式：

```ts
worker.onmessage = function (event) {
    if (event.data.type === 'cursor') {
        mainCanvas.style.cursor = event.data.cursor;
    }
};
```

总之在 WebWorker 中渲染画布需要额外处理和主线程间的通信，交互事件、样式、UI 组件都需要设计对应的事件。我想这也是大多数 Web 3D 渲染引擎只提供简单示例或指引的原因吧。

## 扩展阅读 {#extended-reading}

-   [How can I use headless-gl with a continuous integration service?]
-   [Playwright Components (experimental)]

[node-canvas]: https://github.com/Automattic/node-canvas
[headless-gl]: https://github.com/stackgl/headless-gl
[jsdom]: https://github.com/jsdom/jsdom
[Lit Testing]: https://lit.dev/docs/tools/testing/
[transformIgnorePatterns]: https://jestjs.io/docs/configuration#transformignorepatterns-arraystring
[d3-color issue in recharts]: https://github.com/recharts/recharts/commit/bcb199c0d60b79fa09704413ed9a440cc0a7b1c9
[victory-vendor]: https://www.npmjs.com/package/victory-vendor
[Three.js Puppeteer]: https://github.com/mrdoob/three.js/blob/dev/test/e2e/puppeteer.js
[Move visualization testing to playwright]: https://github.com/BabylonJS/Babylon.js/pull/15149
[Register devices]: https://github.com/visgl/luma.gl/blob/master/modules/test-utils/src/register-devices.ts#L7
[pixelmatch]: https://github.com/mapbox/pixelmatch
[sharding]: https://playwright.dev/docs/test-sharding
[d3-selector]: https://github.com/d3/d3-selection/blob/main/src/creator.js#L6
[mocha + JSDOM]: https://github.com/observablehq/plot/blob/main/test/jsdom.js
[Can I use OffscreenCanvas?]: https://caniuse.com/#feat=offscreencanvas
[react-reconciler]: https://www.npmjs.com/package/react-reconciler
[Environment API]: https://github.com/vitejs/vite/discussions/16358
[Transferable]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
[postMessage]: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
[Three.js OffscreenCanvas]: https://threejs.org/examples/webgl_worker_offscreencanvas.html
[Babylon.js OffscreenCanvas]: https://doc.babylonjs.com/features/featuresDeepDive/scene/offscreenCanvas
[transferControlToOffscreen]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen
[渲染循环]: /zh/guide/lesson-001#design-the-canvas-api
[事件系统]: /zh/guide/lesson-006
[WebWorker 示例]: /zh/example/webworker
[readPixels]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/readPixels
[toMatchWebGLSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchWebGLSnapshot.ts
[toMatchSVGSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchSVGSnapshot.ts
[xmlserializer]: https://www.npmjs.com/package/xmlserializer
[github workflows - test]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/.github/workflows/test.yml
[How can I use headless-gl with a continuous integration service?]: https://github.com/stackgl/headless-gl?tab=readme-ov-file#how-can-i-use-headless-gl-with-a-continuous-integration-service
[拖拽插件]: /zh/guide/lesson-006#dragndrop-plugin
[E2E action]: https://github.com/xiaoiver/infinite-canvas-tutorial/actions/runs/10282078732
[\_\_tests\_\_]: https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/__tests__
[Visual comparisons]: https://playwright.dev/docs/test-snapshots
[Playwright Web component testing]: https://github.com/sand4rt/playwright-ct-web
[Playwright Components (experimental)]: https://playwright.dev/docs/test-components
[Web Components]: /zh/guide/lesson-007
[browserstack-local]: https://github.com/browserstack/browserstack-local-nodejs
