---
outline: deep
description: '實作內容選單與剪貼簿功能。用往前移與往後移調整 z-index。寫入並讀取剪貼簿內容，支援貼上序列化圖形、非向量圖片、SVG 與純文字。從檔案系統與網頁拖放匯入圖片檔案。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第 24 課 - 內容選單與剪貼簿',
          },
      ]
---

<script setup>
import ZIndex from '../../components/ZIndex.vue';
import DragNDropImage from '../../components/DragNDropImage.vue';
</script>

# 第 24 課 - 內容選單與剪貼簿 {#lesson-24-context-menu-and-clipboard}

在這一課，我們會介紹以下內容：

-   如何實作內容選單
-   用往前移與往後移調整 z-index
-   寫入並讀取剪貼簿內容，支援貼上序列化圖形、非向量圖片、SVG 與純文字
-   從檔案系統與網頁拖放匯入圖片檔案

<img src="/context-menu.png" alt="內容選單" style="max-width: 300px;"/>

## 實作內容選單 {#context-menu}

內容選單通常由右鍵或長按互動觸發。瀏覽器預設會實作預設的選單內容，例如在 `<canvas>` 上觸發時會顯示「另存新檔」等選項。
因此第一步是監聽 [contextmenu] 事件並阻止瀏覽器的預設行為，參考：[radix - 內容選單]。

```ts
private handleContextMenu = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // ...show Overlay
};

this.api.element.addEventListener('contextmenu', this.handleContextMenu);
```

接下來需要在指定位置顯示選單 UI 元件。在[第 18 課 - 用 Spectrum 實作 UI]中，我們使用 Overlay 的命令式 API，並結合[使用虛擬觸發器]：

```ts
import { html, render } from '@spectrum-web-components/base';
import { VirtualTrigger, openOverlay } from '@spectrum-web-components/overlay';

private handleContextMenu = async (event: MouseEvent) => {
    // ...prevent browser default behavior

    // Trigger at current position
    const trigger = event.target as LitElement;
    const virtualTrigger = new VirtualTrigger(event.clientX, event.clientY);

    // Render Lit template
    const fragment = document.createDocumentFragment();
    render(this.contextMenuTemplate(), fragment);

    // Show Overlay
    const popover = fragment.querySelector('sp-popover') as HTMLElement;
    const overlay = await openOverlay(popover, {
        trigger: virtualTrigger,
        placement: 'right-start',
        offset: 0,
        notImmediatelyClosable: true,
        type: 'auto',
    });
    trigger.insertAdjacentElement('afterend', overlay);
    this.renderRoot.appendChild(overlay);
}
```

在下面的範例中，對選取的圖形叫出內容選單之後，可以調整 `z-index`。也可以使用鍵盤快速鍵。在 Figma 中是 <kbd>[</kbd> 與 <kbd>]</kbd>。這裡我參考了 Photoshop Web，使用 <kbd>⌘[</kbd> 與 <kbd>⌘]</kbd>。

<ZIndex />

## 寫入剪貼簿 {#clipboard-write-text}

我們的目標是把序列化後的圖形清單寫入剪貼簿。使用者可以用兩種方式觸發這個行為：透過 [copy] 事件（例如 <kbd>Ctrl+C</kbd>）；透過內容選單。先看第一種，監聽 [copy] 事件。這裡的 [passive] 選項可以告訴瀏覽器，我們可能在事件處理常式中呼叫 `preventDefault`：

```ts
document.addEventListener('copy', this.handleCopy, { passive: false });
```

此時需要透過 `activeElement` 確認畫布處於目前的作用中狀態，然後停用瀏覽器的預設行為並阻止事件冒泡：

```ts
private handleCopy = (event: ClipboardEvent) => {
    const { layersSelected } = this.appState;
    if (
        document.activeElement !== this.api.element ||
        layersSelected.length === 0
    ) {
        return;
    }

    this.executeCopy(event); // Pass ClipboardEvent

    event.preventDefault();
    event.stopPropagation();
};
```

透過內容選單觸發的情境沒有 [ClipboardEvent]。參考 [excalidraw 剪貼簿] 與 [actionClipboard] 的實作，從最新到最舊嘗試瀏覽器 API：

```ts
export async function copyTextToClipboard(
    text: string,
    clipboardEvent?: ClipboardEvent,
) {
    // 1.
    await navigator.clipboard.writeText(text);
    // 2.
    if (clipboardEvent) {
        clipboardEvent.clipboardData?.setData(MIME_TYPES.text, text);
    }
    // 3.
    document.execCommand('copy');
}
```

## 從剪貼簿讀取 {#clipboard-read}

從剪貼簿讀取的實作，決定了我們支援哪些常見檔案類型。從 MIME 類型來看，這包括圖片與文字。文字可以包含序列化的圖形、SVG、URL，甚至 mermaid 語法等等。我們從最簡單的情況開始：接受上一節的序列化圖形清單文字。

```ts
document.addEventListener('paste', this.handlePaste, { passive: false });
```

和寫入剪貼簿一樣，先嘗試 [read] 方法。它只在 HTTPS 下可用，理論上支援所有類型的資料，不限於純文字。幾乎所有現代瀏覽器都支援這個方法，但對資料類型有限制，通常包括文字、HTML 與圖片。如果這個方法不可用或拒絕請求，就退回 [readText]。

```ts
export const readSystemClipboard = async () => {
    const types: { [key in AllowedPasteMimeTypes]?: string | File } = {};
    try {
        // Prefer read() so HTML and images remain available.
        if (navigator.clipboard?.read) {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    try {
                        if (
                            type === MIME_TYPES.text ||
                            type === MIME_TYPES.html
                        ) {
                            types[type] = await (
                                await item.getType(type)
                            ).text();
                        }
                        // Supported image types are converted to File objects.
                    } catch {
                        // Another clipboard item may still be readable.
                    }
                }
            }
            return types;
        }
    } catch (error) {
        // read() may fail even when readText() is permitted.
        if (!navigator.clipboard?.readText) throw error;
    }
    const text = await navigator.clipboard?.readText?.();
    return text ? { [MIME_TYPES.text]: text } : types;
};
```

也可以用這個方法判斷此刻剪貼簿是否為空，若為空就停用「貼上」選單項目。最後要注意的是，讀取剪貼簿的方法需要文件處於聚焦狀態。如果觸發時焦點在瀏覽器網址列或開發者工具上，就會回報下面的錯誤。因此可以在讀取前用 `document.hasFocus()` 判斷是否能成功：

> [!CAUTION]
> Uncaught (in promise) NotAllowedError: Failed to execute 'read' on 'Clipboard': Document is not focused

### 反序列化圖形 {#deserialize}

反序列化之後，只需要重新產生 `id`：

```ts
if (data.elements) {
    const nodes = data.elements.map((node) => {
        node.id = uuidv4();
        return node;
    });

    this.api.runAtNextTick(() => {
        this.api.updateNodes(nodes);
        this.api.record();
    });
}
```

不過這樣複製出來的圖形會重疊。可以採用下面兩種策略：

1. 跟著滑鼠位置建立，這需要記錄滑鼠最近一次移動的位置
2. 在原始圖形位置上加一個偏移

第二種更簡單：

```ts
const nodes = data.elements.map((node) => {
    node.id = uuidv4();
    node.x += 10; // [!code ++]
    node.y += 10; // [!code ++]
    return node;
});
```

第一種則需要記錄內容選單觸發時的位置，或最近一次的滑鼠移動：

```ts
private handleContextMenu = async (event: MouseEvent) => {
    this.lastContextMenuPosition = { x: event.clientX, y: event.clientY }; // [!code ++]
}
private handlePointerMove = (event: PointerEvent) => {
    this.lastPointerMovePosition = { x: event.clientX, y: event.clientY }; // [!code ++]
};
```

我們在[第 6 課 - 座標]已經介紹過，把 Client 座標轉換到 Canvas 座標系統：

```ts
if (position) {
    const { x, y } = api.viewport2Canvas(api.client2Viewport(position)); // [!code ++]
    node.x = x; // [!code ++]
    node.y = y; // [!code ++]
} else {
    node.x += 10;
    node.y += 10;
}
```

### 非向量圖片 {#non-vector-image}

先看複製非向量圖片。如同先前在[第 10 課 - 渲染圖片]見過的，使用 `@loaders.gl` 可以從剪貼簿載入圖片檔案，然後取得原始寬高與 `dataURL`，再經過一連串調整得到最終寬高，最後建立一個矩形，並把它的 `fill` 設成 `dataURL`：

```ts
import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';

async function createImage(api: ExtendedAPI, appState: AppState, file: File) {
    const [image, dataURL] = await Promise.all([
        load(file, ImageLoader),
        getDataURL(file),
    ]);

    // 省略计算宽高

    updateAndSelectNodes(api, appState, [
        {
            id: uuidv4(),
            type: 'rect',
            x: position?.x ?? 0,
            y: position?.y ?? 0,
            width,
            height,
            fill: dataURL,
            lockAspectRatio: true,
        },
    ]);
}
```

為什麼不能直接使用原始圖片的寬高？建立出來的矩形，其寬高位於世界座標系統，應該受到畫布尺寸、目前相機縮放層級與原始圖片尺寸的影響。Excalidraw 使用一種啟發式演算法：

```ts
// Heuristic to calculate the size of the image.
// @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L10059
const minHeight = Math.max(canvas.height - 120, 160);
// max 65% of canvas height, clamped to <300px, vh - 120px>
const maxHeight = Math.min(
    minHeight,
    Math.floor(canvas.height * 0.5) / canvas.zoom,
);
const height = Math.min(image.height, maxHeight);
const width = height * (image.width / image.height);
```

### SVG {#svg}

貼上圖片時，Excalidraw 不會對 SVG 類型的圖片做特別處理，因此失去繼續編輯其內部元素的可能。

Figma 可以把 SVG 元素轉換成畫布圖形，並讓元素可編輯，見[把 SVG 轉換成畫框]。我們在[第 10 課 - 從 SVGElement 到 SerializedNode]介紹過，但在那之前需要用 `DOMParser` 把字串轉成 SVGElement：

```ts
import {
    DOMAdapter,
    svgElementsToSerializedNodes,
} from '@infinite-canvas-tutorial/ecs';

if (data.text) {
    const string = data.text.trim();
    if (string.startsWith('<svg') && string.endsWith('</svg>')) {
        const doc = DOMAdapter.get()
            .getDOMParser()
            .parseFromString(string, 'image/svg+xml');
        const $svg = doc.documentElement;
        const nodes = svgElementsToSerializedNodes(
            Array.from($svg.children) as SVGElement[],
        );

        this.updateAndSelectNodes(nodes);
        return;
    }
}
```

當然也可以使用 `innerHTML` 的做法，但不建議用在複雜的 SVG（可能會失去命名空間）：

```ts
const container = document.createElement('div');
container.innerHTML = svgString.trim();
const svgElement = container.firstChild;
```

最後一種情況也是最簡單的：如果這時剪貼簿裡的內容是純文字，就建立對應的 `text`。值得一提的是，Excalidraw 會使用目前使用者設定的字型、顏色等屬性：

```ts
function createText(
    api: ExtendedAPI,
    appState: AppState,
    text: string,
    position?: { x: number; y: number },
) {
    updateAndSelectNodes(api, appState, [
        {
            id: uuidv4(),
            type: 'text',
            anchorX: position?.x ?? 0,
            anchorY: position?.y ?? 0,
            content: text,
            fontSize: 16,
            fontFamily: 'system-ui',
            fill: 'black',
        },
    ]);
}
```

## 拖放以匯入圖片 {#drag-n-drop}

許多檔案上傳元件支援從檔案總管或其他位置，把檔案拖放到指定區域以完成上傳，例如 [react-dropzone]。Excalidraw 也支援 [handleAppOnDrop]，因此很容易把圖片、匯出成品，甚至影片拖放進畫布以完成匯入：

```tsx
<div onDrop={this.handleAppOnDrop} />
```

為了讓 `drop` 事件能在 `<canvas>` 上正常觸發，還需要監聽 `dragover` 並停用瀏覽器的預設行為，見：[HTML5/Canvas 的 onDrop 事件為什麼沒有觸發？]與[阻止瀏覽器的預設拖曳行為]。

```ts
this.api.element.addEventListener('dragover', this.handleDragOver);
this.api.element.addEventListener('drop', this.handleDrop);
```

然後可以試著從 [files] 讀取自檔案系統拖進來的檔案：

```ts
private handleDrop = async (event: DragEvent) => {
    for (const file of Array.from(event.dataTransfer.files)) {}
}
```

也可以支援從網頁拖進來的文字與圖片。文字可以直接從 `dataTransfer` 讀取。對於圖片，參考[拖曳圖片]，建議把圖片 URL 寫入 `dataTransfer`。在下面的範例中，我們在圖片的 `dragstart` 裡這樣做：

```ts
const text = event.dataTransfer.getData('text/plain');
if (text) {
    createText(this.api, this.appState, text, canvasPosition);
}

img.addEventListener('dragstart', (ev) => {
    const dt = ev.dataTransfer;
    dt?.setData('text/uri-list', img.src);
    dt?.setData('text/plain', img.src);
});
```

在下面的範例中，你可以把右側的圖片，或本頁中的文字，直接拖放進畫布。

<DragNDropImage />

## 從檔案系統上傳 {#upload-from-filesystem}

當然，也有最傳統的從檔案系統上傳的方式：前端最熟悉的 `<input type="file">`。這裡我們借鑑 Excalidraw 的 [filesystem] 實作，並使用 [browser-fs-access] 嘗試更偏命令式的 [File System API]；若瀏覽器不支援，會自動降級。

```ts
if (pen === Pen.IMAGE) {
    try {
        const file = await fileOpen({
            extensions: ['jpg', 'png', 'svg'],
            description: 'Image to upload',
        });
        if (file) {
            createImage(this.api, this.appState, file);
            this.api.setAppState({ penbarSelected: Pen.SELECT });
            this.api.record();
        }
    } catch (e) {
        // User cancels upload and returns to selection mode
        this.api.setAppState({ penbarSelected: Pen.SELECT });
    }
}
```

點擊左側工具列的「圖片」按鈕，就可以體驗這個功能。

## 匯出選取的圖形 {#export-selected-shapes}

在[第 10 課 - 將畫布內容匯出為圖片]之外，更常用的匯出功能是針對選取的圖形。我們繼續使用 [File System API]，把選取的圖形匯出成 SVG 與 PNG 格式的圖片，並儲存到本機。

### 匯出為 SVG {#export-selected-shapes-to-svg}

和匯出整張畫布不同，需要計算選取圖形的包圍盒。透過 `viewBox` 把 SVG 的視埠調整到合適的尺寸，確保所有選取的圖形本來就包含在視埠內。

```ts
import { serializeNodesToSVGElements } from '@infinite-canvas-tutorial/ecs';
import { fileSave } from './filesystem';

// 1. Calculate bounds of SVG
const bounds = api.getBounds(nodes);
const width = bounds.maxX - bounds.minX;
const height = bounds.maxY - bounds.minY;
const $svg = createSVGElement('svg');
$svg.setAttribute('width', `${width}`);
$svg.setAttribute('height', `${height}`);
$svg.setAttribute(
    'viewBox',
    `${bounds.minX - padding} ${bounds.minY - padding} ${width + padding * 2} ${
        height + padding * 2 // add padding with viewBox
    }`,
);

// 2. SerializedNodes -> SVGElement[]
serializeNodesToSVGElements(nodes).forEach((element) => {
    $svg.appendChild(element);
});

// 3. Create blob and save to filesystem
fileSave(
    new Blob([toSVG($svg)], {
        type: MIME_TYPES.svg,
    }),
);
```

### 匯出為 PNG {#export-selected-shapes-to-png}

要匯出非向量圖形，仍然使用 `HTMLCanvasElement.toDataURL()`，但繪製必須在一個暫存的 `<canvas>` 元素上完成。

### 嵌入場景中繼資料 {#embed-scene-metadata}

除了圖形資訊，也可以把場景中繼資料嵌入匯出結果。下圖來自 Excalidraw。

![在 excalidraw 中匯出圖片](/export-image-in-excalidraw.png)

```ts
// https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/index.ts#L176-L178
encodePngMetadata({
    blob,
    metadata: serializeAsJSON(elements, appState, files, 'local'),
});
```

## 延伸閱讀 {#extended-reading}

-   [與剪貼簿互動]
-   [阻止瀏覽器的預設拖曳行為]

[contextmenu]: https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
[radix - 內容選單]: https://www.radix-ui.com/primitives/docs/components/context-menu
[第 18 課 - 用 Spectrum 實作 UI]: /zh-Hant/guide/lesson-018
[使用虛擬觸發器]: https://opensource.adobe.com/spectrum-web-components/components/imperative-api/#using-a-virtual-trigger
[copy]: https://developer.mozilla.org/en-US/docs/Web/API/Element/copy_event
[與剪貼簿互動]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
[excalidraw 剪貼簿]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/clipboard.ts
[actionClipboard]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/actions/actionClipboard.tsx#L62
[ClipboardEvent]: https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent
[passive]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive
[read]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/read
[readText]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText
[把 SVG 轉換成畫框]: https://forum.figma.com/ask-the-community-7/convert-svg-to-frames-18578
[第 6 課 - 座標]: /zh-Hant/guide/lesson-006#coordinates
[第 10 課 - 渲染圖片]: /zh-Hant/guide/lesson-010#render-image
[第 10 課 - 從 SVGElement 到 SerializedNode]: /zh-Hant/guide/lesson-010#svgelement-to-serialized-node
[react-dropzone]: https://github.com/react-dropzone/react-dropzone
[handleAppOnDrop]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L1560C9-L1560C38
[HTML5/Canvas 的 onDrop 事件為什麼沒有觸發？]: https://stackoverflow.com/questions/7699987/html5-canvas-ondrop-event-isnt-firing
[files]: https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files
[拖曳圖片]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#dragging_images
[阻止瀏覽器的預設拖曳行為]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop#prevent_the_browsers_default_drag_behavior
[filesystem]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/filesystem.ts
[browser-fs-access]: https://www.npmjs.com/package/browser-fs-access
[File System API]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
[第 10 課 - 將畫布內容匯出為圖片]: /zh-Hant/guide/lesson-010#export-canvas-to-image
