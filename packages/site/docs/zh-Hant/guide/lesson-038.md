---
outline: deep
description: 'Pencil 中的設計 token、變數、主題、元件化產生，以及圖示字型整合。匯出 SVG、Iconify，以及從設計到程式碼的路徑。'
---

<script setup>
import IconLucide from '../../components/IconLucide.vue'
import IconButton from '../../components/IconButton.vue'
import ComponentsInstances from '../../components/ComponentsInstances.vue'
import DesignToCodeInterfaces from '../../components/DesignToCodeInterfaces.vue'
</script>

# 第 38 課 - 從設計到程式碼 {#lesson-38-from-design-to-code}

## 變數與主題 {#variables-and-themes}

Pencil 支援完整的設計 token 系統，並能依多個主題給出條件值。見 [Variables and Themes]。變數減少硬編碼：模型不必輸出具體的顏色值（少一些 `#RRGGBB` 錯誤），也不必背下你的設計系統 token 表。它只需要語意化的變數名稱，由渲染器解析出實際值。

```ts
api.setAppState({
    variables: {
        'color.background': { type: 'color', value: '#FFFFFF' },
        'text.title': { type: 'number', value: 72 },
    },
});
api.updateNodes([
    {
        id: 'r1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 1,
        fill: '$color.background',
        stroke: '$color.background',
    },
]);
```

當模型為深色模式設計時，不必準備兩套完整色盤，只需要 `$color.bg` 這類參考，再由節點的 `theme` 決定解析後的值。

```json
"variables": {
  "color.bg": {
    "type": "color",
    "value": [
      { "value": "#FFFFFF", "theme": { "mode": "light" } },
      { "value": "#000000", "theme": { "mode": "dark" } }
    ]
  }
}
```

模型也不必計算像素值，或自己接上響應式中斷點。它以宣告方式寫下意圖，由版面引擎算出幾何。見 [第 33 課 - 版面引擎]。

### 變數類型 {#variable-types}

Figma 支援四種變數。見 [Guide to variables in Figma]

-   顏色（`#000000`）
-   數值
-   字串，例如 `fontFamily` 或文字內容
-   布林值

![來源: https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes](https://help.figma.com/hc/article_attachments/30211233510039)

![來源: https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections](https://help.figma.com/hc/article_attachments/26964398869143)

### 屬性面板與變數選擇器 {#property-panel-and-variable-picker}

選取節點之後，Spectrum 屬性面板可以把 `AppState.variables` 裡的設計變數繫結到 **填色／描邊顏色／描邊寬度／字級**：從下拉選單挑一個名稱，就會寫入 `$token`。繫結之後會出現紫色徽章，也可以一次 **解除繫結**（把目前解析出的字面值寫回去，並記錄歷史）。顏色選擇器與描邊寬度滑桿永遠顯示 **解析後** 的值，因此原始的 `$...` 不會被當成無效的 CSS 顏色。

### 匯出 SVG {#export-svg}

有幾種匯出策略；預設是解析後的字面值：

```ts
export type DesignVariablesSvgExportMode =
    /** Resolve $ → literal */
    | 'resolved'
    /** Keep `$token` strings (attributes may be non-standard; good for post-processing) */
    | 'preserve-token'
    /** `:root{--x:...}` + `fill="var(--x)"` */
    | 'css-var';
```

也可以使用 CSS 變數模式：全域變數宣告在 `:root` 底下，方便在 devtools 裡調整。見 [Using CSS custom properties (variables)]

```html
<svg>
    <defs>
        <style>
            :root {
                --color-background: #2563eb;
                --color-stroke: red;
                --text-title: 72px;
            }
        </style>
    </defs>
    <rect
        fill="var(--color-background)"
        stroke="var(--color-stroke)"
        stroke-width="2"
        width="100"
        height="100"
        id="node-r1"
    />
</svg>
```

## 圖示 {#icon}

產生 UI 時，圖示很重要。[Lucide] 已經廣泛用於 React 程式碼產生，Pencil 也支援類似的內建圖形：

```ts
export interface IconFont extends Entity, Size, CanHaveEffects {
    type: 'icon_font';
    /** Name of the icon in the icon font */
    iconFontName?: StringOrVariable;
    /** Icon font to use. Valid fonts are 'lucide', 'feather', 'Material Symbols Outlined', 'Material Symbols Rounded', 'Material Symbols Sharp', 'phosphor' */
    iconFontFamily?: StringOrVariable;
    /** Variable font weight, only valid for icon fonts with variable weight. Values from 100 to 700. */
    weight?: NumberOrVariable;
    fill?: Fills;
}
```

在 OpenPencil 裡，`iconLookup` 是一個可注入的函式，這表示：

-   **彈性**：任何圖示來源（Iconify、Lucide、自訂）
-   **模型負擔**：模型只輸出 `iconFontName: "SearchIcon"`；執行期再解析出路徑

```ts
private drawIconFont(canvas, node, x, y, w, h, opacity) {
  const iconName = iNode.iconFontName ?? iNode.name ?? '';
  const iconMatch = this.iconLookup?.(iconName) ?? null;
  const iconD = iconMatch?.d ?? FALLBACK_ICON_D;  // SVG path data
  const iconStyle = iconMatch?.style ?? 'stroke';   // stroke or fill

  // Resolve SVG path → Skia path → scale → draw
}
```

我們的定義：

```ts
export interface IconFontAttributes {
  /** Name of the icon in the font family */
  iconFontName?: StringOrVariable;
  /**
   * Font family, e.g. 'lucide', 'feather', 'Material Symbols Outlined', 'phosphor', etc.
   */
  iconFontFamily?: StringOrVariable;
}

export interface IconFontSerializedNode
  extends BaseSerializeNode<'iconfont'>,
  Partial<IconFontAttributes>;
```

### 在執行期註冊圖示 {#register-icon-at-runtime}

我們使用 [IconifyJSON] 的圖示外形，在執行期以包含 SVG 的 JSON 載入 Lucide、Material 與其他圖示集：

```ts
import { registerIconifyIconSet } from '@infinite-canvas-tutorial/ecs';

const m = await import('@iconify/json/json/lucide.json');
registerIconifyIconSet('lucide', m);
```

圖示本體接受單引號或雙引號的 SVG 屬性。路徑、矩形、圓、橢圓與直線可以使用自閉合標籤或明確的結束標籤；巢狀 `<g>` 的 fill 與 stroke 屬性會由其中的圖形繼承。

圖示 JSON 對應到場景圖的方式與先前相同：一個 Search 圖示會變成帶有 `Path` 與 `Circle` 子節點的 `Group`，很像把 SVG 轉成我們的圖形。

```json
"search": {
    "body": "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m21 21l-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></g>"
}
```

我們也會把寬度、高度與 `strokeWidth` 對應到轉換後的圖上：

```ts
function buildIconFontScalablePrimitives(
    iconFontName: string,
    iconFontFamily: string,
    targetWidth: number,
    targetHeight: number,
): ScaledIconPrimitive[] {}
```

<IconLucide />

### 在圖層面板中顯示 {#display-in-the-layer-panel}

Iconify 提供用來顯示的 Web Component。見 [Iconify Icon web component]。我們用它們當圖層清單裡的縮圖：

```ts
import 'iconify-icon';

if (this.node.type === 'iconfont') {
    const iconName = this.#normalizeIconifyName(
        this.node as IconFontSerializedNode,
    );
    thumbnail = iconName
        ? html`<iconify-icon icon=${iconName}></iconify-icon>`
        : html`<sp-icon-group></sp-icon-group>`;
}
```

### 匯出 SVG {#export-svg-2}

### 搭配版面渲染 {#render-component-with-layout}

搭配 [第 33 課 - 版面引擎]，可以做出包含圖示的按鈕：

```ts
const button1 = {
    id: 'icon-button',
    type: 'rect',
    fill: 'grey',
    display: 'flex',
    width: 200,
    height: 100,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    cornerRadius: 10,
    gap: 10,
} as const;

const searchIcon = {
    id: 'icon-button-search',
    parentId: 'icon-button',
    type: 'iconfont',
    iconFontName: 'search',
    iconFontFamily: 'lucide',
};

const text = {
    id: 'icon-button-text',
    parentId: 'icon-button',
    type: 'text',
    content: 'Button',
};
```

<IconButton />

我們希望 `Button` 有多個 **變體**，精神與 [Shadcn UI] 相同，這樣就不必一再寫出相同的結構：

```tsx
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
```

## 元件與插槽 {#components-and-slots}

在 `.pen` 檔裡，`ref` + `descendants` 這套系統實際上是面向 AI 的元件繼承模型：模型不必理解底層堆疊（圓角矩形 + 文字 + 內距）。它可以指向設計系統裡既有的 `round-button`，再覆寫標籤。這與程式裡「先繼承，再覆寫」的想法相同。見 [Components and Instances]。

```json
{
    "id": "round-button",
    "type": "g",
    "reusable": true,
    "cornerRadius": 9999,
    "children": [
        {
            "id": "label",
            "type": "text",
            "content": "Submit",
            "fill": "#000000"
            ...
        }
    ]
}

{
    "id": "save-round-button",
    "type": "ref",
    "ref": "round-button",
    "descendants": { "label": { "content": "Save" } }
}
```

<ComponentsInstances />

## 設計 ↔ 程式碼 {#design-to-code}

[Design ↔ Code]

[Design ↔ Code] 的關鍵洞察是：設計轉程式碼 **不是** 讓 AI 從像素猜程式碼。因為 `.ic` 格式已經編碼了對程式友善的基本單元，包括 flex 版面、設計變數、`reusable`／`ref` 元件、語意化名稱與圖示字型，場景圖 **就是** 為程式準備的 IR。所以核心是一個 **確定性的轉譯器**，AI 只在命名與整理結構這一層幫忙。

### 管線 {#design-to-code-pipeline}

我們比照 SVG 匯出管線，但中間插入一個與框架無關的 **Code IR**，這樣要新增目標框架，就只是再加一個 emitter：

```text
.ic SceneGraph
  → expandRefSerializedNodes   // reuse existing ref/reusable handling
  → CodeIR                     // element tree + structured style + token refs + component defs
  → Emitter                    // react-tailwind | html-css | ...
```

Code IR 節點保留：**角色**（container／text／icon／image／shape）、**事先解析的 `$token` 參考**、結構化的 **flex 樣式**，以及 `reusable`／`ref` 的 **元件關係**。

### 進入點 {#design-to-code-entry}

`API.exportCode` 對應 `renderToSVG`。不傳引數時會轉譯整個場景；傳入節點則轉譯選取範圍。

```ts
const code = api.exportCode(undefined, {
    framework: 'react-tailwind', // or 'html-css'
    variablesMode: 'css-var', // 'resolved' | 'preserve-token' | 'css-var'
    componentStructure: 'preserve', // 'preserve' | 'flatten'
});
```

也可以直接呼叫這個純函式：

```ts
import { serializedNodesToCode } from '@infinite-canvas-tutorial/ecs';

const code = serializedNodesToCode(nodes, {
    framework: 'react-tailwind',
    variables,
});
```

### 概念對應 {#design-to-code-mapping}

畫布節點會依用途轉換為版面、文字、圖片或 SVG；`reusable` / `ref` 對應 React 元件與實例，變數則依所選模式輸出。[查看完整對應表](/zh-Hant/guide/design-to-code-reference#concept-mapping)。

### 變數模式 {#design-to-code-variable-modes}

三種變數模式與 SVG 匯出的語意一致：

-   `resolved`（預設）：把 `$token` 解析成字面值（例如 `bg-[#FFFFFF]`）。
-   `css-var`：樣式輸出 `var(--token)`（例如 `bg-[var(--color-bg)]`）。HTML／CSS 匯出會包含一個 `:root { … }` 區塊；React 把定義的範圍限在每個匯出的元件，包含單獨渲染的 reusable 元件。巢狀實例共用父層範圍，因此分開匯出時，同一個 token 可以使用不同的值。文字內容的 token 會解析成目前的值，因為 CSS 自訂屬性無法取代文字節點。
-   `preserve-token`：保留 `$token`（導向內嵌 `style`，方便後處理）。

### 元件與實例 {#design-to-code-components}

預設的 `componentStructure: 'preserve'` 會把 `reusable` 匯出為 React 元件，把 `ref` 匯出為實例。支援的文字、樣式與版面覆寫會成為 props；無法表達的修改會展開實例以保留畫布外觀。

文字、圖片、塗料、Path、裁剪與混合規則請見 [匯出細節參考](/zh-Hant/guide/design-to-code-reference)。

```tsx
interface RoundButtonProps {
    label?: string;
}

export function RoundButton({ label = 'Submit' }: RoundButtonProps) {
    return (
        <div className="flex items-center justify-center w-[120px] h-[40px] rounded-[9999px]">
            <span>{label}</span>
        </div>
    );
}

export function Design() {
    return <RoundButton label="Save" />;
}
```

`componentStructure: 'flatten'` 是後備方案：它透過 `expandRefSerializedNodes` 把每個實例展開成具體的 DOM，沒有元件定義。HTML／CSS emitter 一律展開，因為 HTML 沒有元件的概念。

### 實用介面範例 {#practical-interface-examples}

在 IC 編輯器畫布中試用數據面板、定價頁與行動結帳頁：編輯節點後，可從目前畫布產生、複製或下載程式碼。選擇 HTML/CSS 後，可用 **HTML preview** 查看結果。定價頁使用可重用的方案卡片。

<DesignToCodeInterfaces />

下載 `.ic` 可在[線上 App](https://app.infinitecanvas.cc/)繼續編輯，HTML 可直接在瀏覽器開啟。下載 React 專案後解壓並執行 `pnpm install` 和 `pnpm dev`。產生的是展示層；導航、支付與即時資料需自行接入。詳情請見 [匯出細節參考](/zh-Hant/guide/design-to-code-reference#practical-interface-examples)。

### 命令列 {#cli}

儲存庫也包含一個給 `.ic` 檔使用的離線 CLI（Node.js 20+）。在編輯器以 **Export as… > .ic** 匯出設計，並存成 `design.ic`。從儲存庫根目錄依序建置它的工作區相依，然後執行：

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @infinite-canvas-tutorial/device-api build:cjs
corepack pnpm --filter @infinite-canvas-tutorial/ecs build:cjs
corepack pnpm --filter @infinite-canvas-tutorial/cli build
node packages/cli/dist/cli.js validate design.ic
node packages/cli/dist/cli.js inspect design.ic --json
node packages/cli/dist/cli.js codegen design.ic --framework react-tailwind --variables-mode css-var --component-name Design --output Design.tsx
node packages/cli/dist/cli.js codegen design.ic --framework html-css --output design.html
```

`inspect --json` 會回報節點與根節點數量、reusable 節點、變數，以及資產 URL 數量。省略 `--output` 會把產生的程式碼印到 stdout；無效的文件或選項會以非零結束狀態回傳錯誤訊息。CLI 輸出的 React 元件或 HTML／CSS 片段，與編輯器的程式碼產生器相同。它使用文件的變數與主題，不會存取線上專案，並且會拒絕無法在瀏覽器之外存活的暫時 `blob:` 影像。匯出的文件請使用 data URL 或可長期使用的影像 URL。

### 反向：程式碼 → 設計 {#design-to-code-reverse}

反向（把 JSX／HTML AST 解析回 `.ic` 節點）更難，也更含糊，因此留到第二階段。建議的第一個里程碑，是先讓這個轉譯器所輸出的程式碼做到 **冪等的來回**（設計 → 程式碼 → 設計，而且沒有資訊損失），再擴充到任意手寫程式碼。

## 延伸閱讀 {#extended-reading}

[Variables and Themes]: https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
[Guide to variables in Figma]: https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma
[Using CSS custom properties (variables)]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
[Design ↔ Code]: https://docs.pencil.dev/design-and-code/design-to-code
[第 33 課 - 版面引擎]: /zh-Hant/guide/lesson-033
[IconifyJSON]: https://iconify.design/docs/types/iconify-json.html
[Iconify Icon web component]: https://iconify.design/docs/iconify-icon/
[Lucide]: https://lucide.dev/icons
[Shadcn UI]: https://ui.shadcn.com/docs/components/radix/button
[Components and Instances]: https://docs.pencil.dev/for-developers/the-pen-format#components-and-instances
