---
outline: deep
publish: false
---

# 课程 14 - 辅助 UI

之前我们使用 Web Components 实现了一些包括相机缩放、图片下载在内的 [画布 UI 组件]。在本节课中我们将继续增加

## 画布模式 {#canvas-mode}

无限画布通常都支持很多模式，例如选择模式、手型模式、记号笔模式等等，可以参考 [Excalidraw ToolType] 和 [rnote]。

而不同模式下同样的交互动作对应不同的操作。例如选择模式下，在画布上拖拽对应框选操作；在手型模式下会拖拽整个画布；记号笔模式下则是自由绘制笔迹。

首先让我们为画布增加选择和手型模式，未来可以继续扩展：

```ts
export enum CanvasMode {
    SELECT,
    HAND,
}

class Canvas {
    #mode: CanvasMode = CanvasMode.HAND;
    get mode() {
        return this.#mode;
    }
    set mode(mode: CanvasMode) {
        this.#mode = mode;
    }
}
```

### 手型模式 {#hand-mode}

### 选择模式 {#select-mode}

![Anchor positioning diagram with physical properties](https://developer.chrome.com/blog/anchor-positioning-api/image/anchor-diagram-1.png)

## 扩展阅读 {#extended-reading}

-   [Excalidraw ToolType]
-   [Introducing the CSS anchor positioning API]

[画布 UI 组件]: /zh/guide/lesson-007
[Introducing the CSS anchor positioning API]: https://developer.chrome.com/blog/anchor-positioning-api
[Excalidraw ToolType]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts#L120-L135
[rnote]: https://github.com/flxzt/rnote
