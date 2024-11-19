---
outline: deep
publish: false
---

# 课程 14 - 画布模式与辅助 UI

之前我们使用 Web Components 实现了一些包括相机缩放、图片下载在内的 [画布 UI 组件]。在本节课中我们将通过组件把更多画布能力暴露出来：

-   在手型模式下移动、旋转、缩放画布
-   在选择模式下单选、多选、移动图形
-   在绘制模式下向画布中添加图形

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

下面让我们来实现一个新的 UI 组件在这些模式间切换。

## 模式选择工具条 {#mode-toolbar}

使用 Lit 提供的 [Dynamic classes and styles]，我们可以实现类似 [clsx] 的效果（如果你在项目中使用过 [tailwindcss] 一定不会陌生），对 `className` 进行管理，例如根据条件生成。这里我们用来实现选中模式下的高亮样式：

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

另外，为了减少模版代码量，我们使用了 Lit 提供的 [Built-in directives - map]

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

这样我们就能很轻松地区分 `wheel` 事件在缩放和平移场景下对应的不同行为了：

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

在选择模式下，用户可以通过点击选中画布中的图形。在选中状态下，原图形上会覆盖一个辅助 UI，它通常由蒙层和若干锚点组成。在蒙层上拖拽可以移动图形，在锚点上拖拽可以沿各方向改变图形大小，我们还将在顶部图形之外增加一个锚点用于旋转。

![Anchor positioning diagram with physical properties](https://developer.chrome.com/blog/anchor-positioning-api/image/anchor-diagram-1.png)

既然是蒙层，就需要展示在所有图形之上，这就涉及到展示次序的用法了，通过 `z-index` 控制：

```ts
mask.zIndex = 999;
```

下面让我们来实现它吧。

### 实现 z-index {#z-index}

在 CSS [z-index] 中，数值的大小只有在同一个 [Stacking context] 下才有意义。例如下图中虽然 `DIV #4` 的 `z-index` 大于 `DIV #1`，但由于它处在 `DIV #3` 的上下文中，在渲染次序上还是在更下面：

![Understanding z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context/understanding_zindex_04.png)

由于排序是一个非常消耗性能的操作，因此我们为 Shape 增加一个 `sortDirtyFlag` 属性，每当 `zIndex` 改变时就将父节点的该属性置为 `true`

```ts
class Sortable {
    get zIndex() {
        return this.#zIndex;
    }
    set zIndex(zIndex: number) {
        if (this.#zIndex !== zIndex) {
            this.#zIndex = zIndex;
            this.renderDirtyFlag = true;
            if (this.parent) {
                this.parent.sortDirtyFlag = true; // [!code ++]
            }
        }
    }
}
```

在 `appendChild` 和 `removeChild` 时也需要考虑：

```ts
class Shapable {
    appendChild(child: Shape) {
        if (child.parent) {
            child.parent.removeChild(child);
        }

        child.parent = this;
        child.transform._parentID = -1;
        this.children.push(child);

        if (!isUndefined(child.zIndex)) {
            this.sortDirtyFlag = true; // [!code ++]
        }

        return child;
    }
}
```

然后在渲染循环的每个 tick 中进行脏检查，如有需要才进行排序。另外我们不希望直接改变 `children`，而是使用 `sorted` 存储排序结果，毕竟 `z-index` 只应当影响渲染次序而非场景图中的实际顺序：

```ts
traverse(this.#root, (shape) => {
    if (shape.sortDirtyFlag) {
        shape.sorted = shape.children.slice().sort(sortByZIndex); // [!code ++]
        shape.sortDirtyFlag = false; // [!code ++]
    }
    // Omit rendering each shape.
});
```

`sortByZIndex` 的实现如下，如果设置了 `zIndex` 就按降序排列，否则就保持在父节点中的原始顺序，这里也能看出我们不改变 `children` 的意义，它保留了默认情况下的排序依据：

```ts
export function sortByZIndex(a: Shape, b: Shape) {
    const zIndex1 = a.zIndex ?? 0;
    const zIndex2 = b.zIndex ?? 0;
    if (zIndex1 === zIndex2) {
        const parent = a.parent;
        if (parent) {
            const children = parent.children || [];
            return children.indexOf(a) - children.indexOf(b);
        }
    }
    return zIndex1 - zIndex2;
}
```

### SVG 中的 z-index {#z-index-in-svg}

当导出为 SVG 时，不能直接将 `z-index` 映射到元素属性，原因是 SVG 是按元素出现在文档中的顺序渲染的，详见：[How to use z-index in svg elements?]

> In SVG, z-index is defined by the order the element appears in the document.

因此在导出时我们需要进行额外的排序工作，对 `SerializedNode` 的排序实现几乎和 `Shape` 相同，这里就不再展示了：

```ts
export function toSVGElement(node: SerializedNode, doc?: Document) {
    // Omit handling other attributes.
    [...children]
        .sort(sortByZIndex) // [!code ++]
        .map((child) => toSVGElement(child, doc))
        .forEach((child) => {
            $g.appendChild(child);
        });

    return $g;
}
```

### 点击选择图形 {#select-shape}

我们实现 Selector 插件：

```ts
export class Selector implements Plugin {}
```

监听 `click` 事件后我们需要处理以下几种情况：

-   点击画布空白处，取消当前选中的图形
-   点击图形展示选中状态的 UI。如果之前已经选中过其他图形，先取消选中
-   按住 `Shift` 进入多选模式

```ts
const handleClick = (e: FederatedPointerEvent) => {
    const mode = getCanvasMode();
    if (mode !== CanvasMode.SELECT) {
        return;
    }

    const selected = e.target as Shape;

    if (selected === root) {
        if (!e.shiftKey) {
            this.deselectAllShapes();
            this.#selected = [];
        }
    } else if (selected.selectable) {
        if (!e.shiftKey) {
            this.deselectAllShapes();
        }
        this.selectShape(selected);
    } else if (e.shiftKey) {
        // Multi select
    }
};
root.addEventListener('click', handleClick);
```

### 多选 {#multi-select}

按住 `Shift` 可以进行多选。

### 拖拽移动图形 {#dragndrop}

## 扩展阅读 {#extended-reading}

-   [Excalidraw ToolType]
-   [Introducing the CSS anchor positioning API]

[画布 UI 组件]: /zh/guide/lesson-007
[Introducing the CSS anchor positioning API]: https://developer.chrome.com/blog/anchor-positioning-api
[Excalidraw ToolType]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts#L120-L135
[rnote]: https://github.com/flxzt/rnote
[Dynamic classes and styles]: https://lit.dev/docs/components/styles/#dynamic-classes-and-styles
[Built-in directives - map]: https://lit.dev/docs/templates/directives/#map
[CameraControlPlugin]: /zh/guide/lesson-004#implement-a-plugin
[clsx]: https://github.com/lukeed/clsx
[tailwindcss]: https://tailwindcss.com/
[handleCanvasPanUsingWheelOrSpaceDrag]: https://github.com/excalidraw/excalidraw/blob/57cf577376e283beae08eb46192cfea7caa48d0c/packages/excalidraw/components/App.tsx#L6561
[Element: wheel event]: https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
[Catching Mac trackpad zoom]: https://stackoverflow.com/a/28685082/4639324
[z-index]: https://developer.mozilla.org/en-US/docs/Web/CSS/z-index
[Stacking context]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context
[How to use z-index in svg elements?]: https://stackoverflow.com/questions/17786618/how-to-use-z-index-in-svg-elements
