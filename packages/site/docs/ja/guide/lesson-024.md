---
outline: deep
description: 'コンテキストメニューとクリップボード機能を実装します。前面へ移動と背面へ移動で z-index を調整します。クリップボードの内容を書き込み、読み取ります。直列化したグラフィック、非ベクター画像、SVG、プレーンテキストの貼り付けに対応します。ファイルシステムとページから画像ファイルをドラッグ＆ドロップで読み込みます。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第24課 - コンテキストメニューとクリップボード',
          },
      ]
---

<script setup>
import ZIndex from '../../components/ZIndex.vue';
import DragNDropImage from '../../components/DragNDropImage.vue';
</script>

# 第 24 課 - コンテキストメニューとクリップボード {#lesson-24-context-menu-and-clipboard}

この課では、次の内容を紹介します。

-   コンテキストメニューの実装方法
-   前面へ移動と背面へ移動で z-index を調整する方法
-   クリップボードの内容を書き込み、読み取り、直列化したグラフィック、非ベクター画像、SVG、プレーンテキストの貼り付けに対応する方法
-   ファイルシステムとページから画像ファイルをドラッグ＆ドロップで読み込む方法

<img src="/context-menu.png" alt="コンテキストメニュー" style="max-width: 300px;"/>

## コンテキストメニューの実装 {#context-menu}

コンテキストメニューは、通常、右クリックまたは長押しで開きます。ブラウザは既定のメニュー内容を用意しており、たとえば `<canvas>` 上で開くと "Save as" などの項目が表示されます。
したがって最初の手順は、[contextmenu] イベントを受け取り、ブラウザの既定の動作を止めることです。参考: [radix - Context Menu]。

```ts
private handleContextMenu = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // ...show Overlay
};

this.api.element.addEventListener('contextmenu', this.handleContextMenu);
```

次に、指定した位置へメニュー UI コンポーネントを表示します。[第 18 課 - Spectrum で UI を実装する] では、Overlay の命令型 API を [Using a virtual trigger] と組み合わせて使います。

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

下の例では、選択した図形の上でコンテキストメニューを開いたあと、`z-index` を調整できます。キーボードショートカットも使えます。Figma では <kbd>[</kbd> と <kbd>]</kbd> です。ここでは Photoshop Web を参考に、<kbd>⌘[</kbd> と <kbd>⌘]</kbd> を使いました。

<ZIndex />

## クリップボードへの書き込み {#clipboard-write-text}

目標は、直列化した図形の一覧をクリップボードへ書き込むことです。ユーザーはこの動作を二つの方法で起こせます。[copy] イベント（たとえば <kbd>Ctrl+C</kbd>）から起こす方法と、コンテキストメニューから起こす方法です。まず一つ目の、[copy] イベントの受け取りを見ます。ここでの [passive] オプションは、イベントハンドラで `preventDefault` を呼ぶ可能性があることをブラウザに伝えます。

```ts
document.addEventListener('copy', this.handleCopy, { passive: false });
```

この時点で `activeElement` によりキャンバスが現在アクティブであることを確認し、そのあとブラウザの既定の動作を無効にして、イベントのバブリングを止めます。

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

コンテキストメニューから起こす場面には [ClipboardEvent] がありません。[excalidraw clipboard] と [actionClipboard] の実装を参考に、ブラウザ API を新しいものから古いものへ順に試します。

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

## クリップボードからの読み取り {#clipboard-read}

クリップボードを読む実装が、どの一般的なファイル種別をサポートするかを決めます。MIME タイプで見ると、画像とテキストが含まれます。テキストには直列化した図形、SVG、URL、さらには Mermaid 構文などが入り得ます。最も単純な場合から始めます。前の節で直列化した図形一覧のテキストを受け取る場合です。

```ts
document.addEventListener('paste', this.handlePaste, { passive: false });
```

クリップボードへの書き込みと同じく、まず [read] メソッドを試します。このメソッドは HTTPS でのみ動作し、理論上はプレーンテキストに限らずあらゆる種類のデータをサポートします。ほぼすべてのモダンブラウザがこのメソッドをサポートしますが、データ型には制限があり、通常はテキスト、HTML、画像が含まれます。このメソッドが使えないか、要求が拒否された場合は [readText] へフォールバックします。

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

このメソッドを使って、その時点でクリップボードが空かどうかも判断でき、空なら `Paste` メニュー項目を無効にします。最後に注意する点は、クリップボードを読むメソッドにはドキュメントへのフォーカスが必要だということです。実行時にフォーカスがブラウザのアドレスバーや開発者ツールにあると、次のエラーが報告されます。そのため、読む前に `document.hasFocus()` で成功するかどうかを確認できます。

> [!CAUTION]
> Uncaught (in promise) NotAllowedError: Failed to execute 'read' on 'Clipboard': Document is not focused

### 図形のデシリアライズ {#deserialize}

デシリアライズしたあと、再生成するのは `id` だけで済みます。

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

ただし、このままではコピーした図形が重なります。次の二つの方針を採れます。

1. マウス位置に従って作成します。これには、マウスが直近に動いた位置の記録が必要です
2. 元の図形位置にオフセットを加えます

二つ目の方が単純です。

```ts
const nodes = data.elements.map((node) => {
    node.id = uuidv4();
    node.x += 10; // [!code ++]
    node.y += 10; // [!code ++]
    return node;
});
```

一つ目は、コンテキストメニューが開いたときの位置か、直近のマウス移動位置を記録する必要があります。

```ts
private handleContextMenu = async (event: MouseEvent) => {
    this.lastContextMenuPosition = { x: event.clientX, y: event.clientY }; // [!code ++]
}
private handlePointerMove = (event: PointerEvent) => {
    this.lastPointerMovePosition = { x: event.clientX, y: event.clientY }; // [!code ++]
};
```

[第 6 課 - 座標] で既に扱ったとおり、Client 座標を Canvas 座標系へ変換します。

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

### 非ベクター画像 {#non-vector-image}

まず、非ベクター画像をコピーする場合を見ます。[第 10 課 - 画像をレンダリングする] で見たように、`@loaders.gl` を使うとクリップボードの画像ファイルを読み込めます。そのあと元の幅と高さ、そして `dataURL` を得て、一連の調整を経て最終的な幅と高さを求め、最後に矩形を作成してその `fill` を `dataURL` に設定します。

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

元画像の幅と高さをそのまま使えないのはなぜでしょうか。作成する矩形の幅と高さはワールド座標系にあり、キャンバスの大きさ、現在のカメラのズーム、元画像のサイズの影響を受ける必要があります。Excalidraw はヒューリスティックなアルゴリズムを使います。

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

画像を貼り付けるとき、Excalidraw は SVG タイプの画像を特別には処理しません。その結果、内部要素を引き続き編集できる可能性を失います。

Figma は SVG 要素をキャンバスのグラフィックへ変換し、その要素を編集可能にできます。[Convert SVG to frames] を参照してください。この方法は [第 10 課 - SVGElement から Serialized Node へ] で扱いました。その前に `DOMParser` で文字列を SVGElement へ変換する必要があります。

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

もちろん `innerHTML` の方法も使えますが、複雑な SVG には推奨しません（名前空間を失うことがあります）。

```ts
const container = document.createElement('div');
container.innerHTML = svgString.trim();
const svgElement = container.firstChild;
```

最後の場合は、最も単純でもあります。このときクリップボードの内容がプレーンテキストなら、対応する `text` を作成します。Excalidraw では、現在のユーザーが設定したフォントや色などの属性を使う点も挙げておきます。

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

## ドラッグ＆ドロップで画像を読み込む {#drag-n-drop}

多くのファイルアップロードコンポーネントは、ファイルマネージャなどから指定領域へファイルをドラッグ＆ドロップしてアップロードを完了できます。[react-dropzone] がその例です。Excalidraw も [handleAppOnDrop] をサポートしているため、画像、書き出した成果物、さらには動画までキャンバスへドラッグ＆ドロップして読み込むのがとても簡単です。

```tsx
<div onDrop={this.handleAppOnDrop} />
```

`drop` イベントが `<canvas>` 上で正しく発火するには、`dragover` も受け取り、ブラウザの既定の動作を無効にする必要があります。参照: [HTML5/Canvas onDrop event isn't firing?] と [Prevent the browser's default drag behavior]。

```ts
this.api.element.addEventListener('dragover', this.handleDragOver);
this.api.element.addEventListener('drop', this.handleDrop);
```

そのあと [files] から、ファイルシステムからドラッグされたファイルを読み取れます。

```ts
private handleDrop = async (event: DragEvent) => {
    for (const file of Array.from(event.dataTransfer.files)) {}
}
```

ページからドラッグされたテキストと画像もサポートできます。テキストは `dataTransfer` から直接読めます。画像については [Dragging Images] を参照し、画像 URL を `dataTransfer` へ書き込む方法が推奨されます。次の例では、画像の `dragstart` でこれを行います。

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

次の例では、右側の画像か、このページのテキストをキャンバスへ直接ドラッグ＆ドロップできます。

<DragNDropImage />

## ファイルシステムからのアップロード {#upload-from-filesystem}

もちろん、最も伝統的なファイルシステムからのアップロード方法もあります。フロントエンドで最も馴染みのある `<input type="file">` です。ここでは Excalidraw の [filesystem] 実装を参考にし、[browser-fs-access] を使って、より命令型の [File System API] を試します。ブラウザがサポートしていなければ自動的にフォールバックします。

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

左のツールバーにある「画像」ボタンをクリックすると、この機能を試せます。

## 選択した図形の書き出し {#export-selected-shapes}

[第 10 課 - キャンバス内容を画像へ書き出す] に加えて、よりよく使われる書き出しは選択したグラフィックを対象にします。[File System API] を引き続き使い、選択したグラフィックを SVG と PNG 形式の画像として書き出してローカルに保存します。

### SVG への書き出し {#export-selected-shapes-to-svg}

キャンバス全体の書き出しと異なり、選択した図形のバウンディングボックスを計算する必要があります。`viewBox` で SVG のビューポートを適切な大きさに調整し、選択した図形がすべて既定でビューポート内に含まれるようにします。

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

### PNG への書き出し {#export-selected-shapes-to-png}

非ベクターのグラフィックを書き出すときも `HTMLCanvasElement.toDataURL()` を使いますが、描画は一時的な `<canvas>` 要素の上で行う必要があります。

### シーンメタデータの埋め込み {#embed-scene-metadata}

グラフィック情報に加えて、シーンのメタデータも書き出し結果へ埋め込めます。下の画像は Excalidraw のものです。

![Excalidraw での画像書き出し](/export-image-in-excalidraw.png)

```ts
// https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/index.ts#L176-L178
encodePngMetadata({
    blob,
    metadata: serializeAsJSON(elements, appState, files, 'local'),
});
```

## さらに読む {#extended-reading}

-   [Interact with the clipboard]
-   [Prevent the browser's default drag behavior]

[contextmenu]: https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
[radix - Context Menu]: https://www.radix-ui.com/primitives/docs/components/context-menu
[第 18 課 - Spectrum で UI を実装する]: /ja/guide/lesson-018
[Using a virtual trigger]: https://opensource.adobe.com/spectrum-web-components/components/imperative-api/#using-a-virtual-trigger
[copy]: https://developer.mozilla.org/en-US/docs/Web/API/Element/copy_event
[Interact with the clipboard]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
[excalidraw clipboard]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/clipboard.ts
[actionClipboard]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/actions/actionClipboard.tsx#L62
[ClipboardEvent]: https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent
[passive]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive
[read]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/read
[readText]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText
[Convert SVG to frames]: https://forum.figma.com/ask-the-community-7/convert-svg-to-frames-18578
[第 6 課 - 座標]: /ja/guide/lesson-006#coordinates
[第 10 課 - 画像をレンダリングする]: /ja/guide/lesson-010#render-image
[第 10 課 - SVGElement から Serialized Node へ]: /ja/guide/lesson-010#svgelement-to-serialized-node
[react-dropzone]: https://github.com/react-dropzone/react-dropzone
[handleAppOnDrop]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L1560C9-L1560C38
[HTML5/Canvas onDrop event isn't firing?]: https://stackoverflow.com/questions/7699987/html5-canvas-ondrop-event-isnt-firing
[files]: https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files
[Dragging Images]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#dragging_images
[Prevent the browser's default drag behavior]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop#prevent_the_browsers_default_drag_behavior
[filesystem]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/filesystem.ts
[browser-fs-access]: https://www.npmjs.com/package/browser-fs-access
[File System API]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
[第 10 課 - キャンバス内容を画像へ書き出す]: /ja/guide/lesson-010#export-canvas-to-image
