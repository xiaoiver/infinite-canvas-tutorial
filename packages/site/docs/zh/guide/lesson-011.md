---
outline: deep
---

# 课程 11 - 截图测试与服务端渲染

目前我们的画布功能在逐渐变得复杂，是时候引入测试来提升项目质量了。在这节课中你将学习到以下内容：

-   基于 Jest 的测试环境搭建，包含本地和 CI 环境
-   使用单元测试提升代码覆盖率
-   基于 headless-gl 的服务端渲染与视觉回归测试
-   E2E UI 测试

## 配置基础环境

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

## 单元测试

首先来看最容易实现的单元测试，它适合测试与渲染无关的功能，例设置图形属性，计算包围盒大小，拾取判定，各种工具方法等等。

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

回到我们的场景。

### 在 WebWorker 中运行 {#rendering-in-webworker}

除了服务端，WebWorker 也算是一种特殊的运行时环境。在 WebWorker 中运行渲染代码可以避免阻塞主线程。

[Can I use OffscreenCanvas?]

```ts
if ('OffscreenCanvas' in window && 'transferControlToOffscreen' in canvas) {
    // Ok to use offscreen canvas
}
```

主线程代码如下。使用 [transferControlToOffscreen] 将 Canvas 的控制权由主线程交给 WebWorker 线程。通常我们会通过 postMessage 的第一个参数向 WebWorker 传参，但由于 OffscreenCanvas 是 Transferable 的，因此这里需要使用到第二个参数：

```ts
// create a canvas in main thread
const $canvas = document.createElement('canvas') as HTMLCanvasElement;
$canvas.height = 500;
$canvas.width = 500;
document.getElementById('container').appendChild($canvas);
// transfer canvas to worker
const offscreen = $canvas.transferControlToOffscreen();
```

WebWorker 代码如下，也可以使用 rAF：

```ts
const canvas = await new Canvas({
    canvas: offscreenCanvas, // 使用主线程 transfer 过来的 OffscreenCanvas
}).initialized;
```

### 无头浏览器 {#headless-browser}

-   使用最新的 Chrome 可以支持 WebGL 1/2 甚至 WebGPU
-   官方直接提供了 toHaveScreenshot 这样的断言，内置像素级对比，失败后在 report 中展示 diff
-   支持 [sharding] 在 CI 上支持多机器并行，每个机器又可以开启多线程。例如我们使用 4 个机器，每个机器开 10 个 worker 并行：

但它在本地生成的截图常常和 CI 环境存在细微差异。使用 CI 环境而非本地生成的基准图片来保证一致性。上传 GitHub workflow artifacts 就可以获取 CI 环境的截图，下载到本地作为基准图片。

```ts
// Playwright 截图
const buffer = await page.locator('canvas').screenshot();
// 断言截图是否与基准图片一致
expect(buffer).toMatchCanvasSnapshot(dir, key, { maxError });
```

## E2E UI 测试

-   如何测试 UI [Lit Testing]
-   如何测试事件响应

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
[transferControlToOffscreen]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen
