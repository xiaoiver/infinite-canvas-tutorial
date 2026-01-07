---
outline: deep
publish: false
---

After [Getting the API], you can call the related methods:

## get/setAppState

Control the state of the entire canvas application, such as switching between light and dark themes at runtime:

```ts
api.setAppState({
    theme: ThemeMode.LIGHT,
});
```

Or hide taskbar on the right side:

```ts
api.setAppState({
    taskbarVisible: false,
});
```

The complete state is as follows:

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

To enable grid snapping, see: [Lesson 27 - Snap and align]. The default value is `false`.

### snapToPixelGridSize

Minimum spacing after enabling grid snapping. Default value is `10`.

### snapToObjectsEnabled

To enable object snapping. Default value is `false`

### snapToObjectDistance

After enabling object snapping, the minimum detection distance defaults to `8`.

## get/setNodes

Get or set the shapes in the canvas.

```ts
api.setNodes(nodes);
```

## getNodeById

```ts
api.getNodeById('1'); // { id: '1', ... }
```

## getCanvas

Obtain the Canvas Entity, after which you can retrieve the associated set of Components:

```ts
const entity = api.getCanvas();
```

For example, to obtain the DOM element corresponding to the canvas:

```ts
const { element } = entity.read(Canvas); // HTMLCanvasElement | OffscreenCanvas
```

Below we introduce these components.

### Canvas

-   `element` DOM element of canvas `HTMLCanvasElement | OffscreenCanvas`
-   `htmlLayer` HTML container element `HTMLDivElement`
-   `width`
-   `height`
-   `renderer` renderer, the available values are `'webgl' | 'webgpu'`, default to `'webgl'`
-   `shaderCompilerPath` Convert GLSL to WGSL
-   `devicePixelRatio` Default to `1`, see: [devicePixelRatio]

### Theme

See: [Lesson 7 - Theme]

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

Draw a grid as the background on the canvas. For details, see: [Lesson 5 - Draw grid]

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

see: [CSS cursor]

```ts
entity.read(Cursor).value; // 'default'
```

### GPUResource

Save a series of GPU-related resources

-   `device` see: [@antv/g-device-api]
-   `swapChain` see: [Lesson 1 - SwapChain]
-   `renderTarget`
-   `depthRenderTarget`
-   `renderCache`
-   `texturePool`

### Screenshot

see: [Export image]

```ts
const { dataURL } = entity.read(Screenshot); // 'data:'
```

## getHtmlLayer

Retrieve the HTML content container. For details, see: [Lesson 29 - HTML container]

```ts
api.getHtmlLayer(); // HTMLDivElement
// equivalent to
api.getCanvas().read(Canvas).htmlLayer;
```

## getSvgLayer

Retrieve the SVG content container, where the selection tool, lasso tool, eraser tool path, and laser pointer tool will be placed.

```ts
api.getSvgLayer(); // HTMLDivElement
// equivalent to
api.getCanvas().read(Canvas).svgLayer;
```

## getCanvasElement

Retrieve `<canvas>` element.

## client2Viewport

Convert points in the viewport coordinate system to points in the client coordinate system.

```ts
client2Viewport({ x, y }: IPointData): IPointData
```

## viewport2Client

Convert points in the viewport coordinate system to points in the client coordinate system.

```ts
viewport2Client({ x, y }: IPointData): IPointData
```

[Getting the API]: /reference/create-app#use-api
[Lesson 29 - HTML container]: /guide/lesson-029#create-html-container
[devicePixelRatio]: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
[CSS cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[Lesson 5 - Draw grid]: /guide/lesson-005
[Lesson 7 - Theme]: /guide/lesson-007#theme
[Export image]: /reference/export-image
[Lesson 1 - SwapChain]: /guide/lesson-001#swapchain
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[Lesson 27 - Snap and align]: /guide/lesson-027
