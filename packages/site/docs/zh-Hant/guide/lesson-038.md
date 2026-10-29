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

| `.ic` 概念 | 程式輸出 |
| --- | --- |
| `rect`／`g` + `display: flex` | `<div>` + flex 工具類（`flex items-center …`） |
| Flex 方向、對齊、尺寸、間距與內距 | Tailwind flex 工具類／CSS |
| 非 flex 容器內子節點的 `x`／`y` | 相對於該容器的絕對定位 |
| `cornerRadius`／`fills`／`strokes`／`dropShadow` | `rounded-* / bg-* / border / shadow-*` |
| 帶有影像填色的 `rect` | 帶有 `object-fit`／`object-position` 的 `<img src>` |
| 只有一層 CSS 漸層填色的 `rect` | CSS `background-image` |
| `ellipse` | CSS `border-radius: 50%` |
| 實心填色與描邊的葉節點 `path` | 帶有向量幾何的內嵌 SVG `<path>` |
| 實心描邊的葉節點 `line`／`polyline` | 帶有開放向量幾何的內嵌 SVG `<path>` |
| `rect`／`ellipse` + `clipMode: clip` | 裁切元素上的 CSS `overflow: hidden` |
| `rotation`／`scaleX`／`scaleY` | 以局部左上角為原點的 CSS `transform` |
| 節點層級的 `blendMode` | CSS `mix-blend-mode` |
| `visibility: hidden`／`visible` | 不移除版面空間的 CSS visibility |
| `text` + `content` | 文字節點；已知的 `$token` 內容 → 文字值 |
| 文字裝飾的線、樣式、顏色與粗細 | CSS `text-decoration` |
| `fontVariant`／`fontKerning` | CSS `font-variant`／`font-kerning` |
| `wordWrap`／`wordWrapWidth` | `white-space`、`overflow-wrap` 與 `max-width` |
| `maxLines`／`textOverflow` | CSS 行數截斷，或裁切後的行數 |
| `iconfont`（lucide） | `lucide-react` 的 `<Search />` |
| `iconfont`（其他字型家族） | `@iconify/react` 的 `<Icon icon="family:name" />` |
| `$color.bg` 變數 | `bg-[var(--color-bg)]`（css-var）／字面值（resolved） |
| `reusable` 根節點 | 一個 React 元件定義 |
| `ref` + `descendants` 覆寫 | 帶有 props 的元件實例 |
| `name` | 元件／prop／class 名稱 |

### 變數模式 {#design-to-code-variable-modes}

三種變數模式與 SVG 匯出的語意一致：

-   `resolved`（預設）：把 `$token` 解析成字面值（例如 `bg-[#FFFFFF]`）。
-   `css-var`：樣式輸出 `var(--token)`（例如 `bg-[var(--color-bg)]`）。HTML／CSS 匯出會包含一個 `:root { … }` 區塊；React 把定義的範圍限在每個匯出的元件，包含單獨渲染的 reusable 元件。巢狀實例共用父層範圍，因此分開匯出時，同一個 token 可以使用不同的值。文字內容的 token 會解析成目前的值，因為 CSS 自訂屬性無法取代文字節點。
-   `preserve-token`：保留 `$token`（導向內嵌 `style`，方便後處理）。

### 元件與實例 {#design-to-code-components}

使用 `componentStructure: 'preserve'`（預設，也是 Pencil 的賣點）時，每個 `reusable` 根節點都會變成一個元件，每個 `ref` 都會變成一個實例。跨實例出現、可以覆寫的屬性（`content`、`fills`、包含 `fontVariant` 與 `fontKerning` 的排版、文字裝飾、`opacity`、`visibility`、`cornerRadius`、明確的 `width`／`height`、`minWidth`／`maxWidth`／`minHeight`／`maxHeight`、`padding`、`margin`、flex 間距、`flexDirection`、`alignItems`、`justifyContent`、`flexWrap`、`alignSelf`、`flexGrow`、`flexShrink`、`flexBasis`、`strokeWidth`、`strokes`，以及投影欄位）會被提升成 props，並以範本值作為預設。數值型的 `lineHeight` 在 `.ic` 裡是像素高度，因此 React 輸出會加上 `px`，而不是把它當成無單位的倍數。布林值的 `fontKerning` 會變成 CSS 的 `normal` 或 `none`。間距陣列會變成 CSS 縮寫字串，文字裝飾欄位會合成一個 prop，陰影欄位會合成一個 `boxShadow` prop。厚度為 0 的裝飾會渲染成 `none`，與畫布一致：

沒有明確設定 `lineHeight` 時，文字匯出使用無單位的 `1.2` 行高，讓瀏覽器的 flex 間距接近畫布上的文字度量。明確的數值 `lineHeight` 仍然以像素匯出。明確的換行會以 `white-space: pre` 保留。當 `wordWrap` 啟用且 `wordWrapWidth` 為正數時，輸出使用 `pre-wrap`、`overflow-wrap: anywhere`，並以該寬度作為上限。正數的 `maxLines` 會為 `ellipsis`（預設）加上 CSS 行數截斷，或為 `clip` 加上裁切後的行高上限。編輯一個已經換行的 reusable 文字的換行寬度，會變成元件 prop。打開或關閉換行，或改變截斷設定，會展開該實例，讓匯出的版面跟著這次編輯。畫布目前量測文字時不會套用它的 `whiteSpace` 設定；自訂的 `textOverflow` 標記字串在標準 CSS 裡沒有對應。

對於 reusable 影像，如果只改變影像 URL，會把實例的 `fills` 覆寫繫結到元件的 `<img src>` prop。改變填色類型、fit、位置或填色不透明度，會展開該實例，讓產生的元素與樣式反映這次編輯。葉節點影像會把單層填色不透明度與節點不透明度合併到 `<img>` 上。橢圓上的單層影像填色會匯出成圓角的 `<img>`。帶有子節點的影像填色矩形與橢圓，會使用定位包裝元素，並把裝飾性的 `<img>` 放在那些子節點後面；包裝元素帶有節點不透明度，`<img>` 則帶有填色不透明度、fit 與位置。

帶有一層已啟用的 CSS 線性、放射或錐狀漸層填色的矩形，會把該漸層匯出成 `background-image`。在實例上只編輯漸層值，會變成元件 prop。帶有多層實心、支援的漸層、影像或圖案填色的矩形與橢圓，會依繪製順序匯出堆疊背景。單一圖案也會匯出成 CSS 背景。畫布的 `conic-gradient(circle at …)` 語法會轉換成 CSS 的 `conic-gradient(at …)`。影像圖層支援 `fill`、`contain`、`cover`、`none`、`scale-down` 與位置，同時讓子內容留在繪製之上。圖案保留自然的磁磚尺寸與重複設定。對於需要獨立不透明度、影像 `scale-down`，或支援的 2D 圖案變換的塗料，產生器會在子節點後面發出裁切過的裝飾圖層。CSS 支援的圖層混合模式仍局限在填色堆疊內。圖案變換在具有明確尺寸的矩形與橢圓上支援 `matrix`、`translate`、`scale`、`rotate`、`skewX` 與 `skewY`；畫布也會解碼以 URL 為基礎的圖案影像，並套用這些變換。在 reusable 實例上編輯堆疊或圖案，會展開該實例。其他漸層格式、不支援的圖案變換語法，以及沒有 CSS 對應的混合模式（例如 `linearBurn` 與 `linearDodge`）仍然需要另外處理。

不透明度低於 1 的單層實心填色，會透過 CSS `color-mix` 匯出，保留填色 alpha，而不會把子元素一併變暗。節點不透明度仍然是分開的 CSS `opacity`。在 reusable 實例上編輯半透明填色，會展開該實例，讓產生的塗料保留它的不透明度。

節點旋轉（以弧度儲存）與 `scaleX`／`scaleY` 會匯出成原點為 `0 0` 的 CSS `rotate(...) scale(...)` 變換，與畫布的局部變換順序一致。編輯實例變換會展開該實例，讓改變後的幾何進入匯出。

帶有 `clipMode: clip` 的矩形與橢圓，現在會在產生的 HTML 與 React 程式碼裡裁切子節點。圓角矩形保留圓角半徑，橢圓使用 `border-radius: 50%`。改變 reusable 實例的裁切模式會展開該實例，以保留裁切狀態。`erase` 與 `soft` 遮罩沒有直接對應的 CSS overflow，因此不會匯出成裁切。

對於非 flex 容器，子節點使用它們在畫布上的局部 `x`／`y` 作為 CSS 的 `left`／`top`。Flex 子節點仍留在一般的 flex 流程裡。Yoga 把它們的 `flexShrink` 預設為 `0`，因此除非節點指定了別的值，匯出會設定 `flex-shrink: 0`。非 flex 容器裡被保留的元件實例會得到一個定位包裝元素；在實例內移動子節點會展開該實例，以保留這次編輯。當多個頂層節點都有明確尺寸時，匯出也會加上一個相對定位的外框，並保留它們的間距，包括旋轉與翻轉後的範圍。沒有可量測尺寸的根節點則維持一般的文件流程。

節點層級的 `visibility` 會變成 CSS `visibility`，因此隱藏的節點仍保留版面空間。預設的 `inherited` 狀態使用 CSS 繼承。改變 reusable 實例的可見性會變成元件 prop，包含對後代的編輯。

帶有有效 `d` 資料的 Path 會匯出成內嵌 SVG，而不是矩形佔位。當 Path 有子節點時，它的 SVG 會放在定位包裝元素裡、位於子節點後面，同時保留向量輪廓與每個子節點的局部座標。由實心顏色、線性或放射漸層，以及影像組成的填色圖層，會依畫布順序匯出成分開的 SVG 路徑，並保留每一層的不透明度。CSS 支援的混合模式套用在隔離的 SVG 群組內，因此只與較低的填色圖層混合。這些塗料類型的作用中描邊會保留塗料、不透明度、線段、三角形或菱形端點標記、填色規則、寬度、cap、join、miter limit 與虛線設定。帶有多條描邊的 Path、直線與折線，會以共用幾何依畫布順序匯出每一條描邊，並使用 CSS 支援的圖層混合。封閉路徑也會藉由裁切或遮罩每一層，保留內側或外側描邊對齊；開放路徑維持置中對齊。漸層與影像塗料跟隨路徑的 viewBox。Path 的影像填色支援 `fill`、`contain`、`cover`、`none` 與 `scale-down`，包含中間的百分比位置。常見的 `fill`／`contain`／`cover` 對齊使用 SVG pattern；其他 fit 與位置使用裁切過的 SVG `foreignObject`，搭配 CSS `object-fit`／`object-position`。影像描邊在 0%、50% 或 100% 位置上，對 `fill`、`contain` 或 `cover` 使用 SVG pattern。單層影像描邊若使用其他 fit 或位置，會使用定位的 HTML 影像與 SVG 幾何遮罩，並在 Chromium 與 WebKit 中保留 cap、join、端點標記，以及內側或外側對齊。帶有這些 fit 或位置的分層影像描邊，也會在 SVG 描邊圖層旁保留畫布繪製順序、支援的 CSS 混合模式、不透明度與端點標記。匯出的程式碼請使用可長期使用的影像 URL 或 data URL。投影跟隨 SVG 圖稿，不會把陰影打到 Path 的子節點上。在 reusable 實例上覆寫 Path 的塗料、幾何、標記、描邊對齊或陰影，會展開該實例，讓 SVG 反映這次編輯。沒有 CSS 對應的混合模式（例如 `linearBurn` 與 `linearDodge`）、錐狀與 mesh 漸層，以及其他 Path 濾鏡，需要另外的 SVG 處理。

葉節點的直線與折線使用同一條 SVG 管線。它們的局部端點或點清單會變成沒有填色的開放路徑。SVG viewBox 跟隨幾何的局部原點，並把寬度或高度為零的軸置中，因此偏移的路徑，以及很細的水平或垂直描邊，在產生的程式碼裡仍然看得到。它們的描邊可以使用單層作用中的實心、線性漸層、放射漸層或影像塗料。線段、三角形與菱形箭頭使用帶有描邊塗料的局部 SVG marker。對 reusable 直線或折線實例所做的幾何、塗料或標記編輯，也會展開該實例。其他直線效果仍然需要另外處理。

節點層級的 `blendMode` 會變成 CSS `mix-blend-mode`，當實例改變它時也包含一個元件 prop。`light` 對應到 CSS `lighten`；沒有 CSS 對應的模式跟隨 SVG 匯出，渲染成 `normal`。填色圖層自己的 `blendMode` 會與該節點的其他填色混合，不會被當成節點層級的 `mix-blend-mode`。

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

下面的範例把一個分析儀表板、一個 SaaS 定價頁，以及一個行動結帳畫面載入 **IC 編輯器畫布**。三個場景都使用巢狀 flex 版面與語意化顏色變數；結帳畫面使用 390 × 844 的窄畫板。在畫布上選取並編輯節點，然後重新整理、複製或下載由畫布目前文件透過 `API.exportCode` 產生的程式碼。選了 HTML／CSS 時，使用 **HTML preview** 在沙盒框架裡以畫板尺寸檢視產生的頁面。切換設計可以載入另一個可編輯的場景。

範例把一個以節點 ID 為鍵的 `semanticElements` 對應表傳給 `API.exportCode`。它會把選取的畫布矩形與文字，在兩種匯出裡都變成 HTML 地標、標題，以及 `<button type="button">` 控制項。這張對應表屬於這個示範的匯出設定；請在你的應用程式裡接上按鈕動作與導覽。

定價頁使用一個 `reusable` 的方案卡片範本，以及三個 `ref` 實例。編輯器會展開實例以便渲染與編輯；這個示範會把文字、顏色、排版與文字裝飾、不透明度、明確尺寸與尺寸限制、間距、flex 對齊與項目尺寸、實心邊框，以及投影的編輯，對回實例覆寫，供 React 與 `.ic` 下載使用。Growth 卡片示範了強調色邊框。數值型的 `flexBasis` 與尺寸限制會在 HTML／CSS 與 React 樣式裡變成像素值。如果卡片的結構或某個不支援的屬性改變了，匯出會使用展開後的節點，讓結果仍然與畫布一致。

這三份 React 匯出也在使用 React 19 與 Tailwind CSS 4 的瀏覽器測試中渲染。測試會把關鍵文字位置與 HTML 預覽核對，讓這些範例在產生器改變之後仍然可以執行。

<DesignToCodeInterfaces />

下載 `.ic` 檔之後，可以在 [線上 App](https://app.infinitecanvas.cc/) 透過 **Import from… > .ic** 繼續編輯設計。下載 HTML 檔並直接在瀏覽器開啟。若是 React，選擇 **Download React project**，即可從目前畫布取得 Vite、React 19 與 Tailwind CSS 4 的起步 ZIP。解壓縮後執行 `pnpm install` 與 `pnpm dev`；匯出的元件位於 `src/App.tsx`。當設計使用 Inter 字型時，起步專案會在本機打包該字型。目前畫布上暫時的 `blob:` 影像會複製到 `public/assets`，並以本機路徑參考；data URL 保持內嵌，遠端 URL 維持遠端。它的 `src/responsive.css` 為這三個範例加上窄螢幕版面，同時保留 `src/App.tsx` 裡畫板尺寸的元件。你也可以只下載 `.tsx` 檔，用在既有專案。產生器目前輸出的是呈現用標記；匯出之後，請把導覽、結帳動作、付款與即時資料接到你的應用程式邏輯。

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
