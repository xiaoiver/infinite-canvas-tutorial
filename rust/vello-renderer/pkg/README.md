# vello-renderer

以 [Vello](https://github.com/linebender/vello) 作为 2D GPU 渲染层的最小可运行示例，结构参考 [Graphite](https://github.com/GraphiteEditor/Graphite) 的渲染流程。

## 简介

Vello 是基于 GPU Compute 的 2D 渲染引擎，使用 wgpu 访问 GPU，适合作为无限画布等 2D 场景的渲染后端。本示例演示：

- 使用 **winit** 创建窗口与事件循环
- 使用 **vello::util::RenderContext** 管理 wgpu 设备与 surface
- 构建 **Scene**（填充/描边图形），再通过 **Renderer::render_to_texture** 渲染到纹理
- 将渲染结果 blit 到窗口 surface 并 present

## 环境要求

- **Rust**：1.88 或更高（vello 0.7 需要 edition 2024）
  - 若当前版本较低：`rustup update`
- 支持 **WebGPU/wgpu** 的 GPU 驱动（桌面：Vulkan / Metal / D3D12；浏览器：Chrome 113+ 等）

## 运行

### 桌面

```bash
cd packages/vello-renderer
cargo run
```

成功后会打开一个窗口，绘制圆角矩形、圆形和线段。

### 浏览器（Wasm）

1. 安装 [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)（若尚未安装）：`cargo install wasm-pack`
2. 在项目根目录执行：`pnpm build:vello`，或在 `vello-renderer` 下执行：`wasm-pack build --target web`，会生成 `pkg/` 目录。  
   - 使用 `pnpm build:vello` 会在构建后自动删除 `pkg/.gitignore`，便于将 pkg 纳入版本控制。
3. 用本地服务器打开（需 HTTP，不能 file://）：`npx serve .`，然后访问提示的地址（如 <http://localhost:3000>）。

需要支持 **WebGPU** 的浏览器（如 Chrome 113+、Edge 113+）。

画布需由 JS 创建并传入：先 `await init()`，再调用 **`runWithCanvas(canvas, onReady)`**。canvas 需已插入 DOM；若宽高为 0，会按 `clientWidth`/`clientHeight` 自动设置。**支持多画布**：对多个 canvas 分别调用 `runWithCanvas`，每个会在就绪时回调 `onReady(canvasId)`，后续 `addRect`/`addCircle` 等需传入对应的 `canvasId`。

```js
import init, { runWithCanvas, addRect } from './pkg/vello_renderer.js';
await init();
const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 600;
document.getElementById('container').appendChild(canvas);
runWithCanvas(canvas, (canvasId) => {
    addRect(canvasId, {
        id: 'r1',
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        fill: [1, 0, 0, 1],
    });
});
```

## JS API（仅 Wasm）

在浏览器中，wasm 模块通过 `import` 引入后，可从 JS 向画布追加图形。坐标为**世界坐标**，会随画布平移/缩放一起变换。参数为**对象格式**，支持可选字段与 camelCase。

| 方法                             | 说明                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `runWithCanvas(canvas, onReady)` | 用指定 canvas 启动渲染。`onReady(canvasId)` 在画布就绪时调用，后续 add\* 需传入该 `canvasId`。支持多画布。  |
| `addRect(canvasId, options)`     | 在指定画布上添加矩形。`options`: `{ id, parentId?, zIndex?, x, y, width, height, radius?, fill?, stroke? }` |
| `addEllipse(canvasId, options)` | 在指定画布上添加椭圆。`options`: `{ id, parentId?, zIndex?, cx, cy, rx, ry, fill?, stroke?, localTransform? }` |
| `addLine(canvasId, options)`     | 在指定画布上添加线段。`options`: `{ id, parentId?, zIndex?, x1, y1, x2, y2, stroke? }`，stroke 同 addRect |
| `addPath(canvasId, options)`     | 在指定画布上添加 path。`options`: `{ id, parentId?, zIndex?, d, fill?, stroke?, fillRule? }`，d 为 SVG path 的 d 属性 |
| `addPolyline(canvasId, options)` | 在指定画布上添加折线。`options`: `{ id, parentId?, zIndex?, points, stroke? }`，points 为 [[x,y],[x,y],...]     |
| `addText(canvasId, options)`     | 在指定画布上添加文本。需先调用 `registerDefaultFont(字体字节)`。`options` 同上。                            |
| `registerDefaultFont(bytes)`     | 注册默认字体。`bytes` 为 **Uint8Array** 或 **ArrayBuffer**（TTF/OTF 字节），供后续 `addText` 渲染使用。     |
| `clearShapes(canvasId)`          | 清空指定画布上由 JS 添加的所有图形。                                                                        |
| `setCameraTransform(canvasId, opts)` | 设置画布相机变换。`opts`: `{ x?, y?, scale?, rotation? }`，下一帧渲染前生效。                             |
| `addGroup(canvasId, options)`    | 添加组/容器，用于组织子元素。`options`: `{ id, parentId?, zIndex?, localTransform? }`                      |
| `addRoughRect(canvasId, options)` | 添加手绘风格矩形。`options`: 同 addRect，额外支持 `roughness`, `bowing`, `fillStyle` 等                   |
| `addRoughEllipse(canvasId, options)` | 添加手绘风格椭圆。`options`: 同 addEllipse，额外支持 `roughness`, `bowing`, `fillStyle` 等               |
| `addRoughLine(canvasId, options)` | 添加手绘风格线段。`options`: 同 addLine，额外支持 `roughness`, `bowing` 等                                |

**相机控制**：Rust 不再监听 Mouse/Cursor/Touch 事件，相机 transform 完全由 JS 通过 `setCameraTransform` 同步。JS 需自行监听 canvas 的鼠标/触摸事件，计算平移与缩放，并调用 `setCameraTransform` 实现拖拽、滚轮缩放等效果。

- **id**：必填，唯一标识，用于被 **parentId** 引用以建立父子关系。
- **parentId**：可选；若传入则当前图形为该 id 对应图形的子节点，其坐标（x/y、cx/cy 等）为**父节点局部空间**；无 parentId 时为世界坐标。
- **zIndex**：可选，整数，默认 0；数值越大越靠上绘制，同 zIndex 按添加顺序。
- **fill** / **color**：RGBA 数组 `[r, g, b, a]`，取值 0–1；默认填充白色、描边黑色。
- **stroke**：可选，`{ width, color? }`；不传或 `width ≤ 0` 表示不描边。
- **radius**：矩形圆角，默认 0（直角）。
- **stroke**：可选，`{ width, color?, linecap?, linejoin?, miterLimit? }`；不传时默认黑色线宽 1。

### 组/容器 (addGroup)

使用 `addGroup` 创建逻辑分组，子元素通过 `parentId` 关联到组。组本身不可见，只提供变换和层级：

```js
addGroup(canvasId, {
  id: 'group1',
  zIndex: 1,
});

addRect(canvasId, {
  id: 'rect1',
  parentId: 'group1',  // 成为 group1 的子元素
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fill: [1, 0, 0, 1],
});
```

### 手绘风格形状 (addRoughRect/addRoughEllipse/addRoughLine)

Rough 形状模拟手绘/草图风格，支持以下额外参数：

- **roughness**：粗糙度，0 = 完美形状，1 = 默认手绘风格，>1 = 更粗糙
- **bowing**：线条弯曲程度，默认 1
- **fillStyle**：填充样式，可选 `hachure`（默认）、`solid`、`zigzag`、`cross-hatch`、`dots`、`dashed`、`zigzag-line`
- **hachureAngle**：hachure 填充角度（度），默认 -41
- **hachureGap**：hachure 线间隙，默认 4
- **curveStepCount**：曲线步数，默认 9
- **simplification**：简化程度，0-1 之间

```js
addRoughRect(canvasId, {
  id: 'rr1',
  x: 100,
  y: 100,
  width: 120,
  height: 80,
  fill: [0.9, 0.9, 0.5, 1],
  stroke: { width: 2, color: [0, 0, 0, 1] },
  roughness: 2,
  bowing: 1.5,
  fillStyle: 'hachure',
  hachureAngle: -45,
});

addRoughEllipse(canvasId, {
  id: 're1',
  cx: 300,
  cy: 200,
  rx: 60,
  ry: 40,
  fill: [0.5, 0.8, 0.9, 1],
  roughness: 1.5,
  fillStyle: 'dots',
});

addRoughLine(canvasId, {
  id: 'rl1',
  x1: 100,
  y1: 300,
  x2: 400,
  y2: 350,
  stroke: { width: 3, color: [0.8, 0.3, 0.3, 1] },
  roughness: 2.5,
});
```

示例（在 `runWithCanvas` 的 `onReady` 回调中拿到 `canvasId` 后调用）：

```js
import init, { addRect, addEllipse, addLine, clearShapes, runWithCanvas } from './pkg/vello_renderer.js';
await init();
const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 600;
document.body.appendChild(canvas);
runWithCanvas(canvas, (canvasId) => {
  addRect(canvasId, {
  addRect(canvasId, {
  id: 'rect1',
  x: 300,
  y: 100,
  width: 120,
  height: 80,
  radius: 10,
  fill: [1, 0.6, 0.2, 1],
});

  addEllipse(canvasId, {
  id: 'ellipse1',
  cx: 550,
  cy: 300,
  rx: 60,
  ry: 60,
  fill: [1, 0.5, 0.6, 1],
  stroke: { width: 2, color: [1, 1, 1, 1] },
});

  addEllipse(canvasId, {
  id: 'child1',
  parentId: 'rect1',
  cx: 60,
  cy: 40,
  rx: 25,
  ry: 25,
  fill: [1, 1, 0.8, 1],
});

  addLine(canvasId, {
  id: 'line1',
  x1: 100,
  y1: 400,
  x2: 400,
  y2: 350,
  stroke: { width: 4, color: [0.3, 0.8, 1, 1] },
});

  // clearShapes(canvasId);
});
```

**文本**：需先注册字体（TTF/OTF 字节），再在 onReady 回调里调用 `addText(canvasId, options)`。例如：

```js
runWithCanvas(canvas, (canvasId) => {
    fetch('.../NotoSans-Regular.ttf')
        .then((r) => r.arrayBuffer())
        .then((buf) => {
            registerDefaultFont(buf);
            addText(canvasId, {
                id: 't1',
                content: 'Hello',
                anchorX: 100,
                anchorY: 200,
                fontSize: 24,
                fill: [0, 0, 0, 1],
            });
        });
});
```

## 项目结构

```plaintext
packages/vello-renderer/
├── Cargo.toml   # 依赖：vello, winit, pollster, anyhow；wasm：wasm-bindgen 等
├── index.html   # 浏览器入口，加载 pkg/vello_renderer.js
├── README.md
├── src/
│   ├── lib.rs   # 共用逻辑 + run_native / run_wasm_async + runWithCanvas
│   └── main.rs  # 桌面入口
└── pkg/         # wasm-pack build 生成
```

## 参考

- [Vello - linebender](https://github.com/linebender/vello)
- [Graphite - GraphiteEditor](https://github.com/GraphiteEditor/Graphite)
- [Vello README 中的 Getting started](https://github.com/linebender/vello#getting-started)
