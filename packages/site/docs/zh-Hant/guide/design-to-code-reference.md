---
title: Design to Code 匯出細節參考
outline: deep
---

# Design to Code 匯出細節參考

返回[第 38 課](/zh-Hant/guide/lesson-038#design-to-code)查看 API 與互動示範。

## 概念對應 {#concept-mapping}

| `.ic` 概念                                       | 程式輸出                                              |
| ------------------------------------------------ | ----------------------------------------------------- |
| `rect`／`g` + `display: flex`                    | `<div>` + flex 工具類（`flex items-center …`）        |
| Flex 方向、對齊、尺寸、間距與內距                | Tailwind flex 工具類／CSS                             |
| 非 flex 容器內子節點的 `x`／`y`                  | 相對於該容器的絕對定位                                |
| `cornerRadius`／`fills`／`strokes`／`dropShadow` | `rounded-* / bg-* / border / shadow-*`                |
| 帶有影像填色的 `rect`                            | 帶有 `object-fit`／`object-position` 的 `<img src>`   |
| 只有一層 CSS 漸層填色的 `rect`                   | CSS `background-image`                                |
| `ellipse`                                        | CSS `border-radius: 50%`                              |
| 實心填色與描邊的葉節點 `path`                    | 帶有向量幾何的內嵌 SVG `<path>`                       |
| 實心描邊的葉節點 `line`／`polyline`              | 帶有開放向量幾何的內嵌 SVG `<path>`                   |
| `rect`／`ellipse` + `clipMode: clip`             | 裁切元素上的 CSS `overflow: hidden`                   |
| `rotation`／`scaleX`／`scaleY`                   | 以局部左上角為原點的 CSS `transform`                  |
| 節點層級的 `blendMode`                           | CSS `mix-blend-mode`                                  |
| `visibility: hidden`／`visible`                  | 不移除版面空間的 CSS visibility                       |
| `text` + `content`                               | 文字節點；已知的 `$token` 內容 → 文字值               |
| 文字裝飾的線、樣式、顏色與粗細                   | CSS `text-decoration`                                 |
| `fontVariant`／`fontKerning`                     | CSS `font-variant`／`font-kerning`                    |
| `wordWrap`／`wordWrapWidth`                      | `white-space`、`overflow-wrap` 與 `max-width`         |
| `maxLines`／`textOverflow`                       | CSS 行數截斷，或裁切後的行數                          |
| `iconfont`（lucide）                             | `lucide-react` 的 `<Search />`                        |
| `iconfont`（其他字型家族）                       | `@iconify/react` 的 `<Icon icon="family:name" />`     |
| `$color.bg` 變數                                 | `bg-[var(--color-bg)]`（css-var）／字面值（resolved） |
| `reusable` 根節點                                | 一個 React 元件定義                                   |
| `ref` + `descendants` 覆寫                       | 帶有 props 的元件實例                                 |
| `name`                                           | 元件／prop／class 名稱                                |

## 元件與輸出規則

使用 `componentStructure: 'preserve'`（預設，也是 Pencil 的賣點）時，每個 `reusable` 根節點都會變成一個元件，每個 `ref` 都會變成一個實例。跨實例出現、可以覆寫的屬性（`content`、`fills`、包含 `fontVariant` 與 `fontKerning` 的排版、文字裝飾、`opacity`、`visibility`、`cornerRadius`、明確的 `width`／`height`、`minWidth`／`maxWidth`／`minHeight`／`maxHeight`、`padding`、`margin`、flex 間距、`flexDirection`、`alignItems`、`justifyContent`、`flexWrap`、`alignSelf`、`flexGrow`、`flexShrink`、`flexBasis`、`strokeWidth`、`strokes`，以及投影欄位）會被提升成 props，並以範本值作為預設。

數值型的 `lineHeight` 在 `.ic` 裡是像素高度，因此 React 輸出會加上 `px`，而不是把它當成無單位的倍數。布林值的 `fontKerning` 會變成 CSS 的 `normal` 或 `none`。

間距陣列會變成 CSS 縮寫字串，文字裝飾欄位會合成一個 prop，陰影欄位會合成一個 `boxShadow` prop。厚度為 0 的裝飾會渲染成 `none`，與畫布一致。

### 文字

沒有明確設定 `lineHeight` 時，文字匯出使用無單位的 `1.2` 行高，讓瀏覽器的 flex 間距接近畫布上的文字度量。明確的數值 `lineHeight` 仍然以像素匯出。明確的換行會以 `white-space: pre` 保留。當 `wordWrap` 啟用且 `wordWrapWidth` 為正數時，輸出使用 `pre-wrap`、`overflow-wrap: anywhere`，並以該寬度作為上限。正數的 `maxLines` 會為 `ellipsis`（預設）加上 CSS 行數截斷，或為 `clip` 加上裁切後的行高上限。編輯一個已經換行的 reusable 文字的換行寬度，會變成元件 prop。打開或關閉換行，或改變截斷設定，會展開該實例，讓匯出的版面跟著這次編輯。畫布目前量測文字時不會套用它的 `whiteSpace` 設定；自訂的 `textOverflow` 標記字串在標準 CSS 裡沒有對應。

### 圖片與填色

對於 reusable 影像，如果只改變影像 URL，會把實例的 `fills` 覆寫繫結到元件的 `<img src>` prop。改變填色類型、fit、位置或填色不透明度，會展開該實例，讓產生的元素與樣式反映這次編輯。葉節點影像會把單層填色不透明度與節點不透明度合併到 `<img>` 上。橢圓上的單層影像填色會匯出成圓角的 `<img>`。帶有子節點的影像填色矩形與橢圓，會使用定位包裝元素，並把裝飾性的 `<img>` 放在那些子節點後面；包裝元素帶有節點不透明度，`<img>` 則帶有填色不透明度、fit 與位置。

帶有一層已啟用的 CSS 線性、放射或錐狀漸層填色的矩形，會把該漸層匯出成 `background-image`。在實例上只編輯漸層值，會變成元件 prop。帶有多層實心、支援的漸層、影像或圖案填色的矩形與橢圓，會依繪製順序匯出堆疊背景。單一圖案也會匯出成 CSS 背景。畫布的 `conic-gradient(circle at …)` 語法會轉換成 CSS 的 `conic-gradient(at …)`。影像圖層支援 `fill`、`contain`、`cover`、`none`、`scale-down` 與位置，同時讓子內容留在繪製之上。圖案保留自然的磁磚尺寸與重複設定。對於需要獨立不透明度、影像 `scale-down`，或支援的 2D 圖案變換的塗料，產生器會在子節點後面發出裁切過的裝飾圖層。CSS 支援的圖層混合模式仍局限在填色堆疊內。圖案變換在具有明確尺寸的矩形與橢圓上支援 `matrix`、`translate`、`scale`、`rotate`、`skewX` 與 `skewY`；畫布也會解碼以 URL 為基礎的圖案影像，並套用這些變換。在 reusable 實例上編輯堆疊或圖案，會展開該實例。其他漸層格式、不支援的圖案變換語法，以及沒有 CSS 對應的混合模式（例如 `linearBurn` 與 `linearDodge`）仍然需要另外處理。

不透明度低於 1 的單層實心填色，會透過 CSS `color-mix` 匯出，保留填色 alpha，而不會把子元素一併變暗。節點不透明度仍然是分開的 CSS `opacity`。在 reusable 實例上編輯半透明填色，會展開該實例，讓產生的塗料保留它的不透明度。

### 變換與版面

節點旋轉（以弧度儲存）與 `scaleX`／`scaleY` 會匯出成原點為 `0 0` 的 CSS `rotate(...) scale(...)` 變換，與畫布的局部變換順序一致。編輯實例變換會展開該實例，讓改變後的幾何進入匯出。

帶有 `clipMode: clip` 的矩形與橢圓，現在會在產生的 HTML 與 React 程式碼裡裁切子節點。圓角矩形保留圓角半徑，橢圓使用 `border-radius: 50%`。改變 reusable 實例的裁切模式會展開該實例，以保留裁切狀態。`erase` 與 `soft` 遮罩沒有直接對應的 CSS overflow，因此不會匯出成裁切。

對於非 flex 容器，子節點使用它們在畫布上的局部 `x`／`y` 作為 CSS 的 `left`／`top`。Flex 子節點仍留在一般的 flex 流程裡。Yoga 把它們的 `flexShrink` 預設為 `0`，因此除非節點指定了別的值，匯出會設定 `flex-shrink: 0`。非 flex 容器裡被保留的元件實例會得到一個定位包裝元素；在實例內移動子節點會展開該實例，以保留這次編輯。當多個頂層節點都有明確尺寸時，匯出也會加上一個相對定位的外框，並保留它們的間距，包括旋轉與翻轉後的範圍。沒有可量測尺寸的根節點則維持一般的文件流程。

節點層級的 `visibility` 會變成 CSS `visibility`，因此隱藏的節點仍保留版面空間。預設的 `inherited` 狀態使用 CSS 繼承。改變 reusable 實例的可見性會變成元件 prop，包含對後代的編輯。

### 向量圖形

帶有有效 `d` 資料的 Path 會匯出成內嵌 SVG，而不是矩形佔位。當 Path 有子節點時，它的 SVG 會放在定位包裝元素裡、位於子節點後面，同時保留向量輪廓與每個子節點的局部座標。

由實心顏色、線性或放射漸層，以及影像組成的填色圖層，會依畫布順序匯出成分開的 SVG 路徑，並保留每一層的不透明度。CSS 支援的混合模式套用在隔離的 SVG 群組內，因此只與較低的填色圖層混合。

這些塗料類型的作用中描邊會保留塗料、不透明度、線段、三角形或菱形端點標記、填色規則、寬度、cap、join、miter limit 與虛線設定。帶有多條描邊的 Path、直線與折線，會以共用幾何依畫布順序匯出每一條描邊，並使用 CSS 支援的圖層混合。

封閉路徑也會藉由裁切或遮罩每一層，保留內側或外側描邊對齊；開放路徑維持置中對齊。漸層與影像塗料跟隨路徑的 viewBox。

Path 的影像填色支援 `fill`、`contain`、`cover`、`none` 與 `scale-down`，包含中間的百分比位置。常見的 `fill`／`contain`／`cover` 對齊使用 SVG pattern；其他 fit 與位置使用裁切過的 SVG `foreignObject`，搭配 CSS `object-fit`／`object-position`。

影像描邊在 0%、50% 或 100% 位置上，對 `fill`、`contain` 或 `cover` 使用 SVG pattern。單層影像描邊若使用其他 fit 或位置，會使用定位的 HTML 影像與 SVG 幾何遮罩，並在 Chromium 與 WebKit 中保留 cap、join、端點標記，以及內側或外側對齊。

帶有這些 fit 或位置的分層影像描邊，也會在 SVG 描邊圖層旁保留畫布繪製順序、支援的 CSS 混合模式、不透明度與端點標記。匯出的程式碼請使用可長期使用的影像 URL 或 data URL。

投影跟隨 SVG 圖稿，不會把陰影打到 Path 的子節點上。在 reusable 實例上覆寫 Path 的塗料、幾何、標記、描邊對齊或陰影，會展開該實例，讓 SVG 反映這次編輯。

沒有 CSS 對應的混合模式（例如 `linearBurn` 與 `linearDodge`）、錐狀與 mesh 漸層，以及其他 Path 濾鏡，需要另外的 SVG 處理。

葉節點的直線與折線使用同一條 SVG 管線。它們的局部端點或點清單會變成沒有填色的開放路徑。SVG viewBox 跟隨幾何的局部原點，並把寬度或高度為零的軸置中，因此偏移的路徑，以及很細的水平或垂直描邊，在產生的程式碼裡仍然看得到。它們的描邊可以使用單層作用中的實心、線性漸層、放射漸層或影像塗料。線段、三角形與菱形箭頭使用帶有描邊塗料的局部 SVG marker。對 reusable 直線或折線實例所做的幾何、塗料或標記編輯，也會展開該實例。其他直線效果仍然需要另外處理。

節點層級的 `blendMode` 會變成 CSS `mix-blend-mode`，當實例改變它時也包含一個元件 prop。`light` 對應到 CSS `lighten`；沒有 CSS 對應的模式跟隨 SVG 匯出，渲染成 `normal`。填色圖層自己的 `blendMode` 會與該節點的其他填色混合，不會被當成節點層級的 `mix-blend-mode`。

## 實用介面範例 {#practical-interface-examples}

第 38 課的範例把一個分析儀表板、一個 SaaS 定價頁，以及一個行動結帳畫面載入 **IC 編輯器畫布**。三個場景都使用巢狀 flex 版面與語意化顏色變數；結帳畫面使用 390 × 844 的窄畫板。在畫布上選取並編輯節點，然後重新整理、複製或下載由畫布目前文件透過 `API.exportCode` 產生的程式碼。選了 HTML／CSS 時，使用 **HTML preview** 在沙盒框架裡以畫板尺寸檢視產生的頁面。切換設計可以載入另一個可編輯的場景。

範例把一個以節點 ID 為鍵的 `semanticElements` 對應表傳給 `API.exportCode`。它會把選取的畫布矩形與文字，在兩種匯出裡都變成 HTML 地標、標題，以及 `<button type="button">` 控制項。這張對應表屬於這個示範的匯出設定；請在你的應用程式裡接上按鈕動作與導覽。

定價頁使用一個 `reusable` 的方案卡片範本，以及三個 `ref` 實例。編輯器會展開實例以便渲染與編輯；這個示範會把文字、顏色、排版與文字裝飾、不透明度、明確尺寸與尺寸限制、間距、flex 對齊與項目尺寸、實心邊框，以及投影的編輯，對回實例覆寫，供 React 與 `.ic` 下載使用。Growth 卡片示範了強調色邊框。數值型的 `flexBasis` 與尺寸限制會在 HTML／CSS 與 React 樣式裡變成像素值。如果卡片的結構或某個不支援的屬性改變了，匯出會使用展開後的節點，讓結果仍然與畫布一致。

這三份 React 匯出也在使用 React 19 與 Tailwind CSS 4 的瀏覽器測試中渲染。測試會把關鍵文字位置與 HTML 預覽核對，讓這些範例在產生器改變之後仍然可以執行。

下載 `.ic` 檔之後，可以在 [線上 App](https://app.infinitecanvas.cc/) 透過 **Import from… > .ic** 繼續編輯設計。下載 HTML 檔並直接在瀏覽器開啟。若是 React，選擇 **Download React project**，即可從目前畫布取得 Vite、React 19 與 Tailwind CSS 4 的起步 ZIP。解壓縮後執行 `pnpm install` 與 `pnpm dev`；匯出的元件位於 `src/App.tsx`。當設計使用 Inter 字型時，起步專案會在本機打包該字型。目前畫布上暫時的 `blob:` 影像會複製到 `public/assets`，並以本機路徑參考；data URL 保持內嵌，遠端 URL 維持遠端。它的 `src/responsive.css` 為這三個範例加上窄螢幕版面，同時保留 `src/App.tsx` 裡畫板尺寸的元件。你也可以只下載 `.tsx` 檔，用在既有專案。產生器目前輸出的是呈現用標記；匯出之後，請把導覽、結帳動作、付款與即時資料接到你的應用程式邏輯。
