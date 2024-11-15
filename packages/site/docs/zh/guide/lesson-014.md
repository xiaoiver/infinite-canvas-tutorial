---
outline: deep
publish: false
---

# 课程 14 - 画布模式与辅助 UI

之前我们使用 Web Components 实现了一些包括相机缩放、图片下载在内的 [画布 UI 组件]。在本节课中我们将继续增加。

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

下面让我们来实现一个新的 UI 组件。

## 模式选择工具条 {#mode-toolbar}

使用 Lit 提供的 [Dynamic classes and styles]，我们可以实现类似 [clsx] 的效果，即根据条件生成 `className`。这里我们用来实现选中模式下的高亮样式：

```ts
@customElement('ic-mode-toolbar')
export class ModeToolbar extends LitElement {
    render() {
        const items = [
            { name: CanvasMode.HAND, label: 'Move', icon: 'arrows-move' },
            { name: CanvasMode.SELECT, label: 'Select', icon: 'cursor' },
        ];
        return html`
            <sl-button-group label="Zoom toolbar">
                ${map(items, ({ name, label, icon }) => {
                    const classes = { active: this.mode === name }; // [!code ++]
                    return html`<sl-tooltip content=${label}>
                        <sl-icon-button
                            class=${classMap(classes)}
                            name=${icon}
                            label=${label}
                            @click="${() => this.changeCanvasMode(name)}"
                        ></sl-icon-button>
                    </sl-tooltip>`;
                })}
            </sl-button-group>
        `;
    }
}
```

## 手型模式 {#hand-mode}

顾名思义，在该模式下用户只能对画布整体进行平移、旋转和缩放操作。之前我们已经实现了 [CameraControlPlugin]，现在让我们与画布模式结合一下，在手型模式下和原来行为一致，即移动或者旋转画布。只是在拖拽开始时以及过程中将鼠标样式修改为 `grab` 和 `grabbing`：

```ts
export class CameraControl implements Plugin {
    apply(context: PluginContext) {
        root.addEventListener('drag', (e: FederatedPointerEvent) => {
            const mode = getCanvasMode();
            if (mode === CanvasMode.HAND) {
                setCursor('grabbing'); // [!code ++]

                if (rotate) {
                    rotateCamera(e);
                } else {
                    moveCamera(e);
                }
            }
        });
    }
}
```

### 通过 wheel 移动画布 {#pan-with-wheel}

之前我一直错误地将 `wheel` 和滚动行为或者说 `scroll` 事件搞混。以下是 MDN 对于 [Element: wheel event] 的说明：

> A wheel event doesn't necessarily dispatch a scroll event. For example, the element may be unscrollable at all. Zooming actions using the wheel or trackpad also fire wheel events.

在使用 Figma 和 Excalidraw 的过程中，我发现除了拖拽，使用 wheel 也能快捷地完成画布平移操作。在 Excalidraw 中还支持在其他画布模式下按住 `Space` 拖拽，详见：[handleCanvasPanUsingWheelOrSpaceDrag]。因此我们先修改下原本的缩放逻辑：

```ts
root.addEventListener('wheel', (e: FederatedWheelEvent) => {
    e.preventDefault();

    // zoomByClientPoint(  // [!code --]
    //     { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }, // [!code --]
    //     e.deltaY, // [!code --]
    // ); // [!code --]
    camera.x += e.deltaX / camera.zoom; // [!code ++]
    camera.y += e.deltaY / camera.zoom; // [!code ++]
});
```

值得注意的是每次移动的距离需要考虑相机当前的缩放等级，在放大时每次应当移动更小的距离。

### 通过 wheel 缩放画布 {#zoom-with-wheel}

当然缩放行为依旧需要保留，当按下 `Command` 或者 `Control` 时触发。如果你开启了 Mac 触控板的 `pinch to zoom` 功能，触发的 `wheel` 事件会自动带上 `ctrlKey`，详见：[Catching Mac trackpad zoom]：

![zoom in mac trackpad](/mac-trackpad-zoom.gif)

这样我们就能很轻松地区分 `wheel` 事件在缩放和平移这两种场景了：

```ts
root.addEventListener('wheel', (e: FederatedWheelEvent) => {
    e.preventDefault();

    if (e.metaKey || e.ctrlKey) {
        zoomByClientPoint(
            { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
            e.deltaY,
        );
    } else {
        camera.x += e.deltaX / camera.zoom;
        camera.y += e.deltaY / camera.zoom;
    }
});
```

值得一提的是，Excalidraw 还支持了按住 `Shift` 进行水平滚动画布。但此前我们已经为画布的该行为分配了旋转操作了，这里就不再实现了。

## 选择模式 {#select-mode}

而在选择模式下随用户拖拽展示选区，稍后我们将实现它。

![Anchor positioning diagram with physical properties](https://developer.chrome.com/blog/anchor-positioning-api/image/anchor-diagram-1.png)

### 点击选择图形 {#select-shape}

## 扩展阅读 {#extended-reading}

-   [Excalidraw ToolType]
-   [Introducing the CSS anchor positioning API]

[画布 UI 组件]: /zh/guide/lesson-007
[Introducing the CSS anchor positioning API]: https://developer.chrome.com/blog/anchor-positioning-api
[Excalidraw ToolType]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts#L120-L135
[rnote]: https://github.com/flxzt/rnote
[Dynamic classes and styles]: https://lit.dev/docs/components/styles/#dynamic-classes-and-styles
[CameraControlPlugin]: /zh/guide/lesson-004#implement-a-plugin
[clsx]: https://github.com/lukeed/clsx
[handleCanvasPanUsingWheelOrSpaceDrag]: https://github.com/excalidraw/excalidraw/blob/57cf577376e283beae08eb46192cfea7caa48d0c/packages/excalidraw/components/App.tsx#L6561
[Element: wheel event]: https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
[Catching Mac trackpad zoom]: https://stackoverflow.com/a/28685082/4639324
