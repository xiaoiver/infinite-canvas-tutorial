---
outline: deep
---

在 [获取 API] 后，可以调用相关方法：

## get/setAppState

控制整个画布应用的状态，例如在运行时切换明暗主题：

```ts
api.setAppState({
    theme: ThemeMode.LIGHT,
});
```

或者隐藏右侧 taskbar：

```ts
api.setAppState({
    taskbarVisible: false,
});
```

完整状态如下：

```ts
export interface AppState {
    theme: Theme;
    themeMode: ThemeMode;
    checkboardStyle: CheckboardStyle;
    cameraZoom: number;
    cameraX: number;
    cameraY: number;
    cameraRotation: number;
    contextBarVisible: boolean;
    contextMenuVisible: boolean;
    topbarVisible: boolean;
    penbarVisible: boolean;
    penbarAll: Pen[];
    penbarSelected: Pen;
    penbarDrawRect: Partial<StrokeAttributes & FillAttributes>;
    penbarDrawEllipse: Partial<StrokeAttributes & FillAttributes>;
    penbarDrawLine: Partial<StrokeAttributes>;
    penbarDrawArrow: Partial<StrokeAttributes & MarkerAttributes>;
    penbarDrawRoughRect: Partial<
        RoughAttributes & StrokeAttributes & FillAttributes
    >;
    penbarDrawRoughEllipse: Partial<
        RoughAttributes & StrokeAttributes & FillAttributes
    >;
    penbarPencil: Partial<StrokeAttributes>;
    penbarText: Partial<
        TextSerializedNode & {
            fontFamilies: string[];
        }
    >;
    taskbarVisible: boolean;
    taskbarAll: Task[];
    taskbarSelected: Task[];
    taskbarChatMessages: Message[];
    layersSelected: SerializedNode['id'][];
    layersHighlighted: SerializedNode['id'][];
    propertiesOpened: SerializedNode['id'][];
    /**
     * Allow rotate in transformer
     */
    rotateEnabled: boolean;
    /**
     * Allow flip in transformer
     */
    flipEnabled: boolean;

    /**
     * Allow snap to pixel grid
     */
    snapToPixelGridEnabled: boolean;
    snapToPixelGridSize: number;

    /**
     * Allow snap to objects
     */
    snapToObjectsEnabled: boolean;
}
```

### snapToPixelGridEnabled

是否开启网格吸附，详见：[课程 27 - 吸附与对齐]。默认值为 `false`

### snapToPixelGridSize

开启网格吸附后的最小间距，默认值为 `10`

### snapToObjectsEnabled

是否开启对象吸附，默认值为 `false`

### snapToObjectDistance

开启对象吸附后，最小判定距离，默认值为 `8`

## get/setNodes

获取或者设置画布中的图形。

```ts
api.setNodes(nodes);
```

## getNodeById

通过 id 获取图形：

```ts
api.getNodeById('1'); // { id: '1', ... }
```

## getCanvas

获取 Canvas Entity，随后可以获取关联的一系列 Component：

```ts
const entity = api.getCanvas();
```

例如获取画布对应的 DOM 元素：

```ts
const { element } = entity.read(Canvas); // HTMLCanvasElement | OffscreenCanvas
```

下面我们介绍这些 Component

### Canvas

核心组件

-   `element` 画布对应的 DOM 元素 `HTMLCanvasElement | OffscreenCanvas`
-   `htmlLayer` HTML 容器元素 `HTMLDivElement`
-   `width` 画布宽度
-   `height` 画布高度
-   `renderer` 渲染器，可选值为 `'webgl' | 'webgpu'`，默认为 `'webgl'`
-   `shaderCompilerPath` 运行时将 GLSL 转译成 WGSL
-   `devicePixelRatio` 默认为 `1`，详见：[devicePixelRatio]

### Theme

详见：[课程 7 - 明暗主题]

```ts
entity.read(Theme).mode; // ThemeMode.LIGHT
```

-   `mode` `ThemeMode.LIGHT | ThemeMode.DARK`
-   `colors`

```ts
{
    [ThemeMode.LIGHT]: {
        background: '#fbfbfb',
        grid: '#dedede',
        selectionBrushFill: '#dedede',
        selectionBrushStroke: '#dedede',
        swatches: [],
    },
    [ThemeMode.DARK]: {
        background: '#121212',
        grid: '#242424',
        selectionBrushFill: '#242424',
        selectionBrushStroke: '#242424',
        swatches: [],
    },
}
```

### Grid

在画布中绘制网格作为背景，详见：[课程 5 - 绘制网格]

```ts
enum CheckboardStyle {
    NONE = 'none',
    GRID = 'grid',
    DOTS = 'dots',
}
```

`checkboardStyle` 默认值为 `CheckboardStyle.GRID`

```ts
entity.read(Grid).checkboardStyle; // CheckboardStyle.GRID
```

### Cursor

鼠标样式，详见：[CSS cursor]

```ts
entity.read(Cursor).value; // 'default'
```

### GPUResource

保存一系列 GPU 相关资源

-   `device` 详见 [@antv/g-device-api]
-   `swapChain` 详见：[课程 1 - SwapChain]
-   `renderTarget`
-   `depthRenderTarget`
-   `renderCache`
-   `texturePool`

### Screenshot

详见：[导出图片]

```ts
const { dataURL } = entity.read(Screenshot); // 'data:'
```

## getHtmlLayer

获取 HTML 内容容器，详见：[课程 29 - HTML 容器]

```ts
api.getHtmlLayer(); // HTMLDivElement
// 等价于
api.getCanvas().read(Canvas).htmlLayer;
```

## getSvgLayer

获取 SVG 内容容器，框选组件、套索、橡皮擦轨迹、激光笔都会放在这个容器内。

```ts
api.getSvgLayer(); // HTMLDivElement
// 等价于
api.getCanvas().read(Canvas).svgLayer;
```

## getCanvasElement

获取 `<canvas>` 元素

## client2Viewport

将客户端坐标系下的点转换为视口坐标系下的点。

```ts
client2Viewport({ x, y }: IPointData): IPointData
```

## viewport2Client

将视口坐标系下的点转换为客户端坐标系下的点。

```ts
viewport2Client({ x, y }: IPointData): IPointData
```

[获取 API]: /zh/reference/create-app#use-api
[课程 29 - HTML 容器]: /zh/guide/lesson-029#create-html-container
[devicePixelRatio]: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
[CSS cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[课程 5 - 绘制网格]: /zh/guide/lesson-005
[课程 7 - 明暗主题]: /zh/guide/lesson-007#theme
[导出图片]: /zh/reference/export-image
[课程 1 - SwapChain]: /zh/guide/lesson-001#swapchain
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[课程 27 - 吸附与对齐]: /zh/guide/lesson-027
