---
outline: deep
description: ''
---

# 课程 29 - 嵌入 HTML 内容

有时候我们希望在画布中嵌入 HTML 内容，例如 YouTube 播放器、CodeSandbox 组件、ShaderToy 等等。

## 创建 HTML 容器 {#create-html-container}

Excalidraw 并不支持在画布中嵌入 HTML 内容，但 tldraw 支持 [TLEmbedShape]。它在网页中将一个 HTML 容器（含 iframe 或其他元素）和画布 `<svg>` 元素并排或叠加显示，而不是“完全”在单一画布内部。

HTMLContainer 的职责是把“普通 DOM”内容放到编辑器的合适层（通常是 editor 的 container），并处理与 shape 的位移/缩放/旋转同步（shape 的 transform -> DOM transform）以保证 DOM 元素在画布上的位置和 shape 对齐。

```css
.tl-html-container {
    position: absolute;
    inset: 0px;
    height: 100%;
    width: 100%;
    pointer-events: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    transform-origin: top left;
    color: var(--tl-color-text-1);
}
```

![HTML external content in tldraw](/html-in-tldraw.png)

在 [External content sources] 例子中，我们可以看到 tldraw 是这样支持 HTML 内容的：

```ts
class DangerousHtmlExample extends BaseBoxShapeUtil<IDangerousHtmlShape> {
    static override type = 'html' as const;

    override getDefaultProps() {
        return {
            type: 'html',
            w: 500,
            h: 300,
            html: '<div>hello</div>',
        };
    }
}
```

我们也增加一种可序列化图形：

```ts
export interface HtmlAttributes {
    html: string;
}
export interface HtmlSerializedNode
    extends BaseSerializeNode<'html'>,
        Partial<HtmlAttributes> {}
```

## 粘贴 URL

在 [课程 24 - 读取剪贴板] 中，我们介绍过如何处理剪贴板中的图片和文本内容。

URL 是特殊的文本，在 tldraw 中：

-   当 URL 被识别为外部链接时，默认处理器会抓取页面的 metadata（og:image、title、favicon、description），并把这些信息包装成一个 bookmark asset（TLBookmarkAsset）和对应的 shape，使用书签样式渲染
-   当 URL 是可嵌入内容（例如 YouTube、Figma、Google Maps 等），此时使用 `<iframe>` 渲染
-   当 URL 是图片或者视频资源时，把它作为媒体 asset（TLImageAsset / TLVideoAsset）去加载并用 ImageShapeUtil 渲染

```ts
// @see https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/hooks/clipboard/pasteUrl.ts#L12
export async function pasteUrl() {
    return await editor.putExternalContent({
        type: 'url',
        point,
        url,
        sources,
    });
}
```

### 书签 {#bookmark}

```ts
// @see https://github.com/tldraw/tldraw/blob/ef0eba14c5a8baf4f36b3659ac9af98256d3b5dd/packages/tldraw/src/lib/defaultExternalContentHandlers.ts#L249
export async function defaultHandleExternalUrlAsset() {
    let meta: {
        image: string;
        favicon: string;
        title: string;
        description: string;
    };

    const resp = await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
    });
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    meta = {
        image:
            doc.head
                .querySelector('meta[property="og:image"]')
                ?.getAttribute('content') ?? '',
        // title, favicon, description
    };

    // Create bookmark asset
}
```

## 粘贴 HTML 内容

```ts
// @see https://github.com/tldraw/tldraw/blob/ef0eba14c5a8baf4f36b3659ac9af98256d3b5dd/packages/tldraw/src/lib/ui/hooks/useClipboardEvents.ts#L200-L204
const handlePasteFromEventClipboardData = async () => {
    if (item.type === 'text/html') {
        things.push({
            type: 'html',
            source: new Promise((r) => item.getAsString(r)) as Promise<string>,
        });
    }
};
```

[External content sources]: https://tldraw.dev/examples/external-content-sources
[TLEmbedShape]: https://tldraw.dev/reference/tlschema/TLEmbedShape
[课程 24 - 读取剪贴板]: /zh/guide/lesson-024#clipboard-read
