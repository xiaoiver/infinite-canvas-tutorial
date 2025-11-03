---
outline: deep
description: ''
---

# 课程 29 - 嵌入 HTML 内容

有时候我们希望在画布中嵌入 HTML 内容，例如 YouTube 播放器、CodeSandbox 组件、ShaderToy 等等。

## HTML

Excalidraw 并不支持在画布中嵌入 HTML 内容，但 tldraw 支持 [TLEmbedShape]。它在网页中将一个 HTML 容器（含 iframe 或其他元素）和画布 `<svg>` 元素并排或叠加显示，而不是“完全”在单一画布内部。

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

[External content sources]: https://tldraw.dev/examples/external-content-sources
[TLEmbedShape]: https://tldraw.dev/reference/tlschema/TLEmbedShape
