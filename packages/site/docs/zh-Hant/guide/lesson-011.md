---
outline: deep
description: '使用 Jest 建立完整測試，包含單元測試、視覺回歸測試、以 headless-gl 進行伺服器端渲染、以 Playwright 進行 E2E 測試，以及瀏覽器相容性測試。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第 11 課 - 測試與伺服器端渲染',
          },
      ]
---
# 第 11 課 - 測試與伺服器端渲染 {#lesson-11-test-and-server-side-rendering}

目前畫布的功能正逐漸變得複雜，是時候引入測試來提升專案品質了。在本課中，你將學到以下內容：

-   以 Jest 為基礎的測試環境設定，包含本機與 CI 環境
-   使用單元測試提升程式碼覆蓋率
-   視覺回歸測試
    -   以 headless-gl 為基礎的伺服器端渲染，目標是 WebGL1
    -   以 Playwright 為基礎的 E2E 測試，目標是 WebGL2 與 WebGPU
-   E2E UI 測試
-   以 BrowserStack 為基礎的瀏覽器相容性測試
-   在 WebWorker 中渲染

以上所有與專案相關的程式碼，都可以在專案的 [\_\_tests\_\_] 資料夾中找到。

## 測試環境 {#test-environment}

我們選擇 Jest 作為測試框架，並在 `package.json` 中加入測試命令，用來統計程式碼覆蓋率：

```json
"scripts": {
    "cov": "jest --coverage"
}
```

在 GitHub workflow 中執行測試命令 `pnpm cov`。介紹到伺服器端渲染時，會在這個命令前面加上 `xvfb-run`：

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

因為使用了 `d3-color`，我們會遇到一個常見問題。D3 預設只提供 ESM 輸出，所以無法在 Node.js 中直接執行。我們有兩個選擇。

1. Jest 提供 [transformIgnorePatterns] 設定，可以把 `d3-color` 甚至 D3 相關的相依套件加進去，並把它們編譯成 CJS。
2. 使用 D3 的替代函式庫 [victory-vendor]。功能完全相同，但額外提供 CJS 輸出，見 [recharts 中的 d3-color 問題]。

我們選擇第一種做法：

```js
const esm = ['d3-*'].map((d) => `_${d}|${d}`).join('|');
module.exports = {
    transformIgnorePatterns: [`<rootDir>/node_modules/(?!(?:.pnpm/)?(${esm}))`],
};
```

測試環境已經準備好，現在可以開始撰寫第一個測試案例。

## 單元測試 {#unit-test}

先從最容易實作的單元測試開始。它適合測試與渲染無關的功能，例如設定圖形屬性、計算包圍盒大小、拾取判定、各種工具方法等等。

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

看起來不錯。我們已經把 Circle 的測試覆蓋率提高到 100%。

```bash
------------------------------|---------|----------|---------|---------|-----------------------
File                          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------------|---------|----------|---------|---------|-----------------------
All files                     |   14.21 |    10.44 |    8.18 |   14.29 |
 src/shapes                   |   26.81 |    22.64 |   21.62 |   28.15 |
  Circle.ts                   |     100 |      100 |     100 |     100 |
```

但單元測試有其限制。畢竟它只針對一小部分程式碼，無法保證整個系統整體運作正常。例如，我們或許能判斷一個圓是否畫得正確，但如果有 100 個呢？撰寫測試斷言會耗費更多時間，也困難得多。

## 視覺回歸測試 {#visual-regression-testing}

在測試領域，「黃金影像」（golden image）用來指一組測試案例中的標準或參考影像。這個詞常用於視覺回歸測試（Visual Regression Testing），也就是一種自動化測試方法：把應用程式或網站的螢幕截圖，與一組預先定義的參考影像相比，藉此偵測視覺變化。

對渲染引擎來說，驗證渲染結果是否正確比單元測試更容易，也能大幅減少手動撰寫斷言的需求。[pixelmatch] 讓比較影像並標示差異變得容易：

![pixelmatch 差異比對](/pixelmatch.png)

在 Node.js 中取得螢幕截圖，可以從兩個方向思考：

1. 伺服器端渲染。依渲染技術不同，可以選擇這些 Node.js 實作：

    - [node-canvas] 以 Cairo 為基礎的 Canvas 實作
    - [jsdom] 以純 JS 實作的 DOM 與 HTML。
    - [headless-gl] 支援建立 WebGL context，但只支援 WebGL1。2.

2. 無頭瀏覽器。例子包括早期的 puppeteer、electron，或較新的 Playwright。

看看目前常見的渲染引擎在用什麼，會很有意思：

-   [Three.js Puppeteer]
-   Babylon.js 曾經使用 Jest + Puppeteer，現在改用 Playwright，見：[將視覺化測試遷移至 Playwright]
-   luma.gl 使用 [headless-gl]，見：[註冊裝置]
-   plot 使用 [mocha + JSDOM]

讓我們分別探索這兩個選項。

### 伺服器端渲染 {#server-side-rendering}

雖然以 headless-gl 實作的伺服器端渲染只支援 WebGL1，仍有一些情境適合使用伺服器端渲染：

-   幾乎沒有互動，或完全沒有互動的情境
-   互動很弱、甚至沒有互動的場景。它們不需要很高的即時效能，可以離線產生，也不會有執行期效能問題。
-   輸出是像素圖或向量圖，可以在多個網站上顯示。

為了支援伺服器端渲染，我們必須確保程式碼能在 Node.js 環境中執行。那麼程式碼裡的 DOM API 呼叫該如何處理？第一個想法是依環境判斷。例如只在瀏覽器環境註冊事件監聽器，並呼叫 `addEventListener()` 方法：

```ts{2}
const plugins = [
    isBrowser ? new DOMEventListener() : undefined,
    //...
];
```

另一種思路可以在 [d3-selector] 裡看到。我們注意到它並不假設全域變數 `document` 存在，而是選擇從 context 取得它。這樣上層就有機會傳入像 `jsdom` 這樣以純 JS 實作的 DOM API，在伺服器端也能運作。

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

[react-reconciler] 也能看到同樣的想法。DOM、Canvas、console 等不同環境，只需要實作設定中約定好的介面：

> 「host config」是你需要提供的物件，用來描述如何在「host」環境（例如 DOM、canvas、console，或任何你的渲染目標）中讓事情發生。它看起來像這樣：

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

Vite 的 [Environment API] 試圖解決類似的問題：

> Runtime API 帶動的這些變更，正促使我們完整重新檢視 Vite 處理各種環境（client、SSR、workerd 等）的方式。

回到我們的情境。Node.js 環境需要提供下列設定項：

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

#### 產生 PNG {#ssr-png}

使用 [headless-gl] 可以建立 WebGLRenderingContext，並把它封裝成類別為 HTMLCanvasElement 的物件。之後就能用它正常建立畫布：

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

有了 WebGLRenderingContext 之後，可以呼叫 [readPixels] 取得指定區域的像素值，再把它們寫入 PNG，得到基準影像。

```ts
async function writePNG(gl: WebGLRenderingContext, path: string) {
    const width = gl.canvas.width;
    const height = gl.canvas.height;

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    await createPNGFromRawdata(path, width, height, pixels);
}
```

每次執行測試時，都可以用 [pixelmatch] 把基準影像與這次測試產生的影像比較，並把差異寫入檔案，方便查看。這是透過 Jest 提供的自訂斷言擴充完成的：

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

完整程式碼詳見：[toMatchWebGLSnapshot.ts]

#### 產生 SVG {#ssr-svg}

為了測試影像匯出功能，我們需要為 ImageExporter 提供 [jsdom] 與 [xmlserializer]，作為瀏覽器環境的替代。前者用來在 Node.js 環境建立 SVGElement，後者用來把它序列化成字串：

```ts{6,7}
import xmlserializer from 'xmlserializer';
import { JSDOM } from 'jsdom';

const exporter = new ImageExporter({
    canvas,
    document: new JSDOM().window._document,
    xmlserializer,
});
```

得到 SVGElement 字串之後，就可以把它寫入檔案。寫入之前，可以用 prettier 格式化，讓它更容易閱讀：

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

完整程式碼詳見：[toMatchSVGSnapshot.ts]

#### 如何模擬互動事件 {#how-to-mock-event}

使用 JSDOM 可以模擬像 `MouseEvent` 這樣的互動事件，建立後直接觸發對應的鉤子，從而避開必須透過 DOM API 監聽事件的限制：

```ts
const window = new JSDOM().window;

const pointerdownEvent = new window.MouseEvent('pointerdown', {
    clientX: 100,
    clientY: 100,
});
canvas.pluginContext.hooks.pointerDown.call(pointerdownEvent);
```

這也讓模擬拖放這類事件組合變得容易。下面的測試案例示範如何測試 [拖放外掛] 的決策閾值。我們模擬一組連續的 `pointerdown`、`pointermove` 與 `pointerup` 事件，但因為間隔很短、相鄰事件又很靠近，`dragstart` 事件不會被觸發：

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

#### CI 中的 SSR {#ssr-ci}

[如何在持續整合服務中使用 headless-gl？]

```yaml
- name: Install headless-gl dependencies
    run: |
        sudo apt-get update
        sudo apt-get install -y mesa-utils xvfb libgl1-mesa-dri libglapi-mesa libosmesa6

- name: Cov
    run: |
        xvfb-run -s "-ac -screen 0 1280x1024x16" pnpm cov
```

完整程式碼詳見：[GitHub workflows - 測試]

### 無頭瀏覽器 {#headless-browser}

伺服器端渲染雖然很好，無頭瀏覽器方案在測試中仍有無法取代的優勢。以 Playwright 為例：

-   最新的 Chrome 支援 WebGL 1/2，甚至 WebGPU。
-   直接提供 toHaveScreenshot 這類官方斷言，內建像素級比較，失敗時會在報告中顯示差異，詳見 [視覺比較]。
-   支援 [sharding]，可在 CI 上做多機平行。

#### 執行開發伺服器 {#run-webserver}

Playwright 瀏覽器需要存取部署在開發伺服器上的測試案例。我們選擇 Vite 作為測試伺服器：

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

#### 瀏覽測試案例 {#browse-testcase}

啟動伺服器後，存取測試案例對應的 URL：

```ts
test(name, async ({ page, context }) => {
    const url = `./infinitecanvas/?name=${name}`;
    await page.goto(url);
    await readyPromise;

    await expect(page.locator('canvas')).toHaveScreenshot(`${name}.png`);
});
```

這項結果與基準影像的比較，會視覺化呈現在產生的測試報告中：

![Playwright 圖像差異](/playwright-image-diff.png)

實務上我發現，本機產生的螢幕截圖常常與 CI 環境略有不同。例如下圖左側是我本機環境產生的螢幕截圖，右側是 CI 環境產生的螢幕截圖，有些矩形出現奇怪的斜線。
遇到這種情況，可以用 CI 環境取代本機產生的基準影像，以確保一致。你可以上傳 GitHub workflow 的 artifact，取得 CI 環境的螢幕截圖，再下載到本機作為基準影像。

![本機與 CI 環境的差異](/playwright-local-vs-ci.png)

#### WebGL2 與 WebGPU {#webgl2-webgpu}

端到端測試方案相對於 [headless-gl] 伺服器端渲染的最大優勢，是同時支援 WebGL2 與 WebGPU。這樣我們只需要撰寫一套測試案例，依照 URL 中的渲染器設定建立畫布，並分別產生 WebGL2 與 WebGPU 的基準影像。

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

#### CI 設定 {#e2e-ci}

如前所述，[sharding] 支援在 CI 上以多台機器平行執行，而且每台機器可以開啟多個執行緒。例如使用 4 台機器，每台平行跑 10 個 worker，最後再把報告合併成一份。

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

執行方式如下，詳見：[E2E 動作]

![Playwright 分片](/playwright-sharding.png)

#### AWS Lambda 函式 {#aws-lambda-function}

現在我們需要在 AWS 上建立一個 Lambda 函式，使用包含 `headless-gl` 的自訂 Layer 執行伺服器端渲染。

![AWS Lambda Layer 示意](/aws-lambda-layer.png)

我們的目標執行環境是 Node.js 20.x，所以先用 Amazon Linux 2023 映像在本機建置 Layer：

```bash
# Lambda runtime compatible base
FROM amazonlinux:2023

# Enable Node.js 20 and essential build tools
RUN yum update -y && \
    yum install -y \
      gcc \
      gcc-c++ \
      make \
      python3 \
      pkgconf-pkg-config \
      mesa-libGL-devel \
      mesa-libEGL-devel \
      mesa-libGLU-devel \
      mesa-libOSMesa-devel \
      libXi-devel \
      libXext-devel \
      libX11-devel \
      libxcb-devel \
      libXau-devel \
      libXdmcp-devel && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /build

# Create nodejs directory (Lambda Layer structure)
RUN mkdir -p nodejs

# Install Node.js (Amazon Linux 2023 default no Node)
RUN curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && \
    yum install -y nodejs

# Install headless-gl and dependencies
RUN npm install --prefix ./nodejs gl --build-from-source

# Copy mesa libraries (optional but helps ensure runtime success)
RUN mkdir -p lib64 && \
    cp /usr/lib64/libGL.so.* lib64/ && \
    cp /usr/lib64/libGLU.so.* lib64/ && \
    cp /usr/lib64/libOSMesa.so.* lib64/ && \
    cp /usr/lib64/libX11.so.* lib64/ && \
    cp /usr/lib64/libXau.so.* lib64/ && \
    cp /usr/lib64/libXi.so.* lib64/ && \
    cp /usr/lib64/libxcb.so.* lib64/ && \
    cp /usr/lib64/libXdmcp.so.* lib64/ && \
    cp /usr/lib64/libXext.so.* lib64/ || true

# Package final layer zip (AWS expects nodejs/ at root)
RUN zip -r9 /opt/headless-gl-layer.zip nodejs lib64

CMD ["bash"]
```

接著上傳到 S3，完成 layer 的建立：

```bash
aws lambda publish-layer-version \
  --layer-name headless-gl-layer \
  --description "Headless GL for Node.js on AL2 arm64" \
  --compatible-runtimes nodejs20.x \
  --compatible-architectures arm64 \
  --content S3Bucket=<your-bucket>,S3Key=headless-gl-layer.zip
```

現在可以在 AWS 主控台選取這個 Layer，把它加入你的函式。

## E2E 測試 {#e2e-test}

[Playwright Components（實驗性）] 支援對 React、Svelte、Vue 等 UI 框架做元件級測試。與使用 `@playwright/test` 撰寫測試案例相比，參數物件多了一個 `mount` 方法：

```ts{3}
import { test, expect } from '@playwright/experimental-ct-react';

test('should work', async ({ mount }) => {
  const component = await mount(<HelloWorld msg="greetings" />);
  await expect(component).toContainText('Greetings');
});
```

[Lit 測試] 推薦的測試框架並不包含 Playwright，但我們可以使用社群中的 [Playwright Web Component 測試]，來測試我們的 [Web Components]。

```ts
import { defineConfig } from '@playwright/test'; // [!code --]
import { defineConfig } from '@sand4rt/experimental-ct-web'; // [!code ++]

export default defineConfig({});
```

現在來為我們的 Web Component 元件撰寫測試。

### 測試 Web Component {#webcomponent-test}

以相機縮放工具列元件為例，我們可以測試 `zoom` 屬性是否正確顯示：

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

## 瀏覽器相容性測試 {#browser-compatibility-test}

BrowserStack 是一個雲端測試平台，提供一系列工具與服務，用來在不同瀏覽器、作業系統、裝置與真實環境中測試網頁與行動應用程式。BrowserStack 讓開發者與 QA（品質保證）團隊能在各種設定上測試應用程式，以確保相容性、效能與使用者體驗。

Babylon.js 使用 [browserstack-local] 進行相容性測試。

## 在 WebWorker 中渲染 {#rendering-in-webworker}

除了伺服器端，WebWorker 也被視為一種特殊的執行期環境。把渲染程式碼放在 WebWorker 中執行，可以避免阻塞主執行緒並提升效能。知名渲染引擎提供了這些使用案例：

-   [Three.js OffscreenCanvas]
-   [Babylon.js OffscreenCanvas]

在我們的 [WebWorker 範例] 中，主執行緒並不忙碌，因此看不出它的優勢。不過仍然可以體驗縮放、平移與旋轉相機、拾取圖形等畫布互動。

### 建立 OffscreenCanvas {#offscreen-canvas}

首先要確認作業環境支援 OffscreenCanvas，見 [Can I use OffscreenCanvas？]：

```ts
if ('OffscreenCanvas' in window && 'transferControlToOffscreen' in mainCanvas) {
    // Ok to use offscreen canvas
}
```

接著要讓畫布支援從 OffscreenCanvas 建立：

```ts
export interface CanvasConfig {
    canvas: HTMLCanvasElement; // [!code --]
    canvas: HTMLCanvasElement | OffscreenCanvas; // [!code ++]
}
```

主執行緒的程式碼如下：

1. 先透過 [transferControlToOffscreen] 把主畫布的控制權轉移給 OffscreenCanvas
2. 使用 Vite 提供的方法建立 WebWorker。它會監聽傳給它的訊息，例如設定滑鼠樣式。
3. 通常我們會把 [postMessage] 的第一個參數傳給 WebWorker，但因為 OffscreenCanvas 是 [Transferable]，這裡需要使用第二個參數。

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

WebWorker 的程式碼如下：

1. 在事件物件中取得主執行緒傳入的 OffscreenCanvas。2.
2. 用 OffscreenCanvas 建立畫布，並設定 devicePixelRatio。
3. 建立 [渲染迴圈]，正常建立圖形並加入畫布。

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

實務上，主執行緒與 WebWorker 之間的通訊不可避免地需要手動處理。例如：

1. 互動事件。[事件系統] 依賴 DOM API，但 WebWorker 中沒有 DOM API，所以需要監聽主執行緒畫布的互動事件，並通知 WebWorker。
2. 畫布尺寸變化。同上。3.
3. 設定主畫布的滑鼠樣式。

### WebWorker 中的事件 {#events-in-webworker}

以 `pointerdown` 事件為例，我們在主畫布上監聽它。由於原生 Event 不是 [Transferable]，需要把它序列化後傳給 WebWorker：

```ts
mainCanvas.addEventListener(
    'pointerdown',
    (e) => {
        worker.postMessage({
            type: 'event',
            name: 'pointerdown',
            event: clonePointerEvent(e), // Simple copy of common properties on event objects
        });
    },
    true,
);
```

當 WebWorker 收到這類訊息時，會直接觸發對應的鉤子：

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

處理畫布尺寸變化事件的方式與上面相同，因此省略。

### 設定游標樣式 {#set-cursor}

渲染期間，WebWorker 也需要把訊息傳給主執行緒，例如：

-   每一幀通知主執行緒渲染已完成，並傳遞統計資訊，例如實際渲染的圖形、被拒絕的圖形數量等
-   圖形被拾取時設定滑鼠樣式

```ts
setCursor: (cursor) => {
    self.postMessage({ type: 'cursor', cursor });
},
```

主執行緒收到訊息後，設定畫布的滑鼠樣式：

```ts
worker.onmessage = function (event) {
    if (event.data.type === 'cursor') {
        mainCanvas.style.cursor = event.data.cursor;
    }
};
```

無論如何，在 WebWorker 中渲染畫布都需要額外處理與主執行緒的通訊。互動事件、樣式與 UI 元件都必須設計對應的事件。我猜這就是大多數 Web 3D 渲染引擎只提供簡單範例或指引的原因。

## 延伸閱讀 {#extended-reading}

-   [如何在持續整合服務中使用 headless-gl？]
-   [Playwright Components（實驗性）]
-   [Canvas Lambda Layer]

[node-canvas]: https://github.com/Automattic/node-canvas
[headless-gl]: https://github.com/stackgl/headless-gl
[jsdom]: https://github.com/jsdom/jsdom
[Lit 測試]: https://lit.dev/docs/tools/testing/
[transformIgnorePatterns]: https://jestjs.io/docs/configuration#transformignorepatterns-arraystring
[recharts 中的 d3-color 問題]: https://github.com/recharts/recharts/commit/bcb199c0d60b79fa09704413ed9a440cc0a7b1c9
[victory-vendor]: https://www.npmjs.com/package/victory-vendor
[Three.js Puppeteer]: https://github.com/mrdoob/three.js/blob/dev/test/e2e/puppeteer.js
[將視覺化測試遷移至 Playwright]: https://github.com/BabylonJS/Babylon.js/pull/15149
[註冊裝置]: https://github.com/visgl/luma.gl/blob/master/modules/test-utils/src/register-devices.ts#L7
[pixelmatch]: https://github.com/mapbox/pixelmatch
[sharding]: https://playwright.dev/docs/test-sharding
[d3-selector]: https://github.com/d3/d3-selection/blob/main/src/creator.js#L6
[mocha + JSDOM]: https://github.com/observablehq/plot/blob/main/test/jsdom.js
[Can I use OffscreenCanvas？]: https://caniuse.com/#feat=offscreencanvas
[react-reconciler]: https://www.npmjs.com/package/react-reconciler
[Environment API]: https://github.com/vitejs/vite/discussions/16358
[Transferable]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
[postMessage]: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
[Three.js OffscreenCanvas]: https://threejs.org/examples/webgl_worker_offscreencanvas.html
[Babylon.js OffscreenCanvas]: https://doc.babylonjs.com/features/featuresDeepDive/scene/offscreenCanvas
[transferControlToOffscreen]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen
[渲染迴圈]: /zh-Hant/guide/lesson-001#design-the-canvas-api
[事件系統]: /zh-Hant/guide/lesson-006
[WebWorker 範例]: /example/webworker
[readPixels]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/readPixels
[toMatchWebGLSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchWebGLSnapshot.ts
[toMatchSVGSnapshot.ts]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/toMatchSVGSnapshot.ts
[xmlserializer]: https://www.npmjs.com/package/xmlserializer
[GitHub workflows - 測試]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/.github/workflows/test.yml
[如何在持續整合服務中使用 headless-gl？]: https://github.com/stackgl/headless-gl?tab=readme-ov-file#how-can-i-use-headless-gl-with-a-continuous-integration-service
[拖放外掛]: /zh-Hant/guide/lesson-006#dragndrop-plugin
[E2E 動作]: https://github.com/xiaoiver/infinite-canvas-tutorial/actions/runs/10282078732
[\_\_tests\_\_]: https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/__tests__
[視覺比較]: https://playwright.dev/docs/test-snapshots
[Playwright Web Component 測試]: https://github.com/sand4rt/playwright-ct-web
[Playwright Components（實驗性）]: https://playwright.dev/docs/test-components
[Web Components]: /zh-Hant/guide/lesson-007
[browserstack-local]: https://github.com/browserstack/browserstack-local-nodejs
[Canvas Lambda Layer]: https://github.com/ShivamJoker/Canvas-Lambda-Layer
