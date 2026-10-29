---
outline: deep
description: '使用 Lit 與 Shoelace 建立與框架無關的 Web UI 元件。建立可重複使用的畫布元件與縮放工具列，並妥善處理生命週期與非同步工作。'
head:
    - ['meta', { property: 'og:title', content: '第 7 課 - Web UI' }]
---
# 第 7 課 - Web UI {#lesson-7-web-ui}

在本課中，你將學到以下內容：

-   使用 Lit 與 Shoelace 開發 Web UI
-   實作畫布元件
-   實作縮放工具列元件

<div style="width: 100%; height: 200px;">
  <ic-canvas-lesson7 />
</div>

## 使用 Lit 與 Shoelace 的 Web UI {#web-ui-with-lit-and-shoelace}

選擇元件庫時，我不希望它綁定特定框架的實作，見 [Web Components 不是框架元件——這樣也沒關係]。Web components 是個好選擇，[Lit] 提供反應式狀態、作用域樣式與宣告式範本系統，讓開發過程更輕鬆。[Shoelace] 是基於 [Lit] 的 UI 函式庫，[Web Awesome] 是它花俏的新名字。使用它們，我們可以同時支援 React、Vue 與 Angular，讓畫布元件與框架無關。值得一提的是，Photoshop Web 使用的 [spectrum-web-components] 元件庫也基於 Lit，見：[Photoshop 現在登上網頁了！]

> Photoshop 是 Adobe 更廣泛的 Creative Cloud 生態系的一部分。採用以 Lit 為基礎的標準化 Web Components 策略，能讓各應用程式的 UI 保持一致。

由於這份教學的靜態網站是用 [VitePress] 撰寫的，範例頁面使用了 [Vue 使用說明]，但元件中不會使用 Vue 語法。

接下來，我們會把已經具備的簡單功能包裝成 UI 元件。

## 畫布元件 {#canvas-component}

畫布元件使用 [Lit] 宣告。為了避免可能的命名衝突，我們用 `ic` 作為元件前綴：

```ts
import { LitElement } from 'lit';

@customElement('ic-canvas')
export class InfiniteCanvas extends LitElement {}
```

我們用裝飾器定義 `renderer` 屬性，因此可以這樣使用：`<ic-canvas renderer="webgl" />`。

```ts
import { property } from 'lit/decorators.js';

export class InfiniteCanvas extends LitElement {
    @property()
    renderer = 'webgl';
}
```

我們希望畫布跟隨頁面的寬度與高度，Shoelace 提供了開箱即用的 [Resize Observer]，當元素的寬度或高度改變時會發出自訂事件 `sl-resize`。我們在 [Lit] 提供的 `render` 生命週期中宣告 HTML，並可以透過 [query] 快速查詢實際的 HTMLCanvasElement：

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

在 [connectedCallback] 生命週期中監聽尺寸變化，並在 [disconnectedCallback] 生命週期中取消監聽：

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

### 畫布初始化的生命週期 {#lifecycle-for-canvas-initialization}

何時建立畫布這個問題困擾我好一陣子。在 [connectedCallback] 生命週期中嘗試取得 `<canvas>` 會得到 `undefined`，因為 CustomElement 尚未加入文件，自然也無法透過 DOM API 查詢它。最後我發現 [firstUpdated] 是個好時機：建立畫布後觸發自訂事件 `ic-ready`，並把畫布實例放進事件物件，同時在每一幀觸發自訂事件 `ic-frame`：

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

有沒有比這個權宜做法更好的解法？

### 使用非同步工作 {#async-task}

對於先執行非同步工作再渲染的這類情境，React 提供了 [\<Suspense\>]：

```tsx
<Suspense fallback={<Loading />}>
    <SomeComponent />
</Suspense>
```

Lit 也提供了類似的 [Async Tasks]，因此我們可以在非同步工作完成前顯示載入狀態，並在出錯時顯示錯誤狀態。用 `Task` 建立非同步工作時，需要指定參數，並把建立好的 `<canvas>` 當作回傳值，這樣才能在 render 函式的 `complete` 鉤子中取出並渲染。

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

例如在不支援 WebGPU 的 Safari 中，會顯示以下錯誤訊息：

<sl-alert variant="danger" open>
  <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
  <strong>初始化畫布失敗</strong><br />
  瀏覽器不支援 WebGPU。
</sl-alert>

畫布元件就這樣寫好了。Web components 與框架無關的特性，讓我們能以一致的方式使用它們。以 Vue 與 React 為例：

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

畫布載入時，監聽 `ic-ready` 自訂事件以取得畫布實例：

```ts
const $canvas = document.querySelector('ic-canvas');
$canvas.addEventListener('ic-ready', (e) => {
    const canvas = e.detail;
    // 创建场景图
    canvas.appendChild(circle);
});
```

這裡我們來實作相機縮放元件。

## 縮放元件 {#zoom-component}

下圖是 Miro 的縮放元件：

![Miro 縮放工具列](/miro-toolbar.png)

先建立一個 `ic-zoom-toolbar`：

```ts
@customElement('ic-zoom-toolbar')
export class ZoomToolbar extends LitElement {}
```

把它加到畫布元件中：

```html
<sl-resize-observer>
    <canvas></canvas>
    <ic-zoom-toolbar zoom="${this.zoom}"></ic-zoom-toolbar> // [!code ++]
</sl-resize-observer>
```

這個元件的內部結構如下，可以看到 Lit 使用的範本語法與 Vue 非常接近：

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

為了把畫布實例從畫布元件傳給其子元件，我們使用 [Lit Context]，在實例化之後存入 context：

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

接著可以在子元件中透過 context 取用。由於畫布的建立是非同步的，需要 `subscribe`，才能即時追蹤 context：

```ts
export class ZoomToolbar extends LitElement {
    @consume({ context: canvasContext, subscribe: true })
    canvas: Canvas;
}
```

為相機加入一個回呼函式，每次相機或投影矩陣改變時觸發：

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

回呼觸發時，會修改反應式變數 `zoom`。

```ts
this.#canvas.camera.onchange = () => {
    this.zoom = Math.round(this.#canvas.camera.zoom * 100);
};
```

## 主題 {#theme}

主題需要套用到 UI 元件與畫布。讓我們先從前者開始。

### UI 元件 {#theme-in-ui}

Shoelace 提供 [Themes] 功能，可以輕鬆切換。首先匯入兩個主題的樣式表：

```ts
import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/themes/dark.css';
```

切換到深色主題時，只要在根元素上加上識別用的 class：

```ts
this.classList.toggle('sl-theme-dark', this.theme === 'dark');
```

最後，撰寫元件樣式時使用 CSS 變數而不是固定值，這樣切換主題時就能自動套用：

```ts
:host {
    background: var(--sl-panel-background-color);
}
```

在後續的 [第 18 課 - 使用 ECS 重構] 中，我們把 Web Components 的實作從 Shoelace 換成 Spectrum，後者也提供淺色／深色主題切換：

![第 18 課之後的深色主題](/spectrum-theme-dark.png)

### 畫布背景與網格 {#theme-in-canvas}

畫布的背景與 [網格] 也需要與主題顏色關聯。參考 [DGM.js 的主題色彩]，我們支援在建立畫布時傳入淺色與深色主題的顏色值：

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

支援在執行階段切換：

```ts
canvas.theme = Theme.DARK;
```

之後就不再深入 UI 實作的細節。

## 國際化 {#i18n}

Lit 提供 [Localization] 方案，搭配適當的工具可以自動化。

### 建立在地化範本 {#build-localized-template}

首先，需要用 `msg` 方法包住需要國際化的字串。以主選單為例：

```ts
import { msg, str } from '@lit/localize';

<sp-tooltip slot="tooltip" self-managed placement="bottom">
    ${msg(str`Main menu`)}
</sp-tooltip>;
```

然後執行以下命令，從原始碼中擷取使用到的語言字串：

```bash
lit-localize extract
```

此時你會得到一系列 `xlf` 檔案。把這些 `xlf` 檔案送給翻譯服務（當然也可以手動翻譯），就會收到類似下面的結果：

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

然後執行以下命令，把翻譯後的字串編譯成元件，並放到原始碼資料夾中：

```bash
lit-localize build
```

### 切換語系 {#switch-locale}

這個網站使用 VitePress 建置。你可以在右上角找到語言切換元件。

```ts
import { localized } from '@lit/localize';

@customElement('ic-spectrum-top-navbar')
@localized()
export class TopNavbar extends LitElement {}
```

可以在執行階段按需載入：

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

為了示範，我們選擇使用 [靜態匯入]。當然，這種做法會載入所有語言檔案，影響首次內容呈現的時間。

## 使用 slot 組合 {#composite-with-slot}

在後續的 [第 18 課 - 使用 ECS 重構] 中，我們在畫布左側實作了工具列。如果想為工具列新增一個工具，可以利用 Web Components 的 `<slot>` 元素輕鬆做到。

在許多可擴充的外掛（例如 [橡皮擦外掛]）中，我們實作了類似的用法：

```html
<ic-spectrum-canvas>
    <ic-spectrum-penbar-eraser slot="penbar-item"><ic-spectrum-penbar-eraser />
</ic-spectrum-canvas>
```

在 Lit 元件中使用 `<slot>` 預留可擴充的位置：

```ts
export class Penbar extends LitElement {
    render() {
        return html`<sp-action-group class="penbar">
            <slot name="penbar-item"></slot>
        </sp-action-group>`;
    }
}
```

值得注意的是，當 `<slot>` 要穿過元件樹傳遞時，父元件必須使用具名 slot。

```html
<!-- ic-spectrum-canvas -->
<ic-spectrum-penbar>
    <slot name="penbar-item" slot="penbar-item"></slot>
</ic-spectrum-penbar>
```

## 延伸閱讀 {#extended-reading}

-   [HN 上關於 Lit 的討論]
-   [在 Figma 中變更主題]
-   [使用範本與 slot]

[Shoelace]: https://shoelace.style/
[VitePress]: https://vitepress.dev/
[Vue 使用說明]: https://shoelace.style/frameworks/vue
[Resize Observer]: https://shoelace.style/components/resize-observer
[Lit]: https://lit.dev/
[connectedCallback]: https://lit.dev/docs/components/lifecycle/#connectedcallback
[disconnectedCallback]: https://lit.dev/docs/components/lifecycle/#disconnectedCallback
[query]: https://lit.dev/docs/api/decorators/#query
[firstUpdated]: https://lit.dev/docs/components/lifecycle/#firstupdated
[Lit Context]: https://lit.dev/docs/data/context/
[Async Tasks]: https://lit.dev/docs/data/task/#overview
[\<Suspense\>]: https://react.dev/reference/react/Suspense
[Web Components 不是框架元件——這樣也沒關係]: https://lea.verou.me/blog/2024/wcs-vs-frameworks/
[Photoshop 現在登上網頁了！]: https://medium.com/@addyosmani/photoshop-is-now-on-the-web-38d70954365a
[spectrum-web-components]: https://opensource.adobe.com/spectrum-web-components/
[Web Awesome]: https://www.kickstarter.com/projects/fontawesome/web-awesome
[Themes]: https://shoelace.style/getting-started/themes
[網格]: /zh-Hant/guide/lesson-005
[DGM.js 的主題色彩]: https://dgmjs.dev/api-core/variables/themecolors
[HN 上關於 Lit 的討論]: https://news.ycombinator.com/item?id=45112720
[第 18 課 - 使用 ECS 重構]: /zh-Hant/guide/lesson-018
[在 Figma 中變更主題]: https://help.figma.com/hc/en-us/articles/5576781786647-Change-themes-in-Figma
[Localization]: https://lit.dev/docs/localization/overview/
[靜態匯入]: https://lit.dev/docs/localization/runtime-mode/#static-imports
[使用範本與 slot]: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots
[橡皮擦外掛]: /reference/eraser
