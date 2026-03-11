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
| `addCircle(canvasId, options)`   | 在指定画布上添加圆形。`options`: `{ id, parentId?, zIndex?, cx, cy, r, fill?, stroke? }`                    |
| `addLine(canvasId, options)`     | 在指定画布上添加线段。`options`: `{ id, parentId?, zIndex?, x1, y1, x2, y2, strokeWidth?, color? }`         |
| `addText(canvasId, options)`     | 在指定画布上添加文本。需先调用 `registerDefaultFont(字体字节)`。`options` 同上。                            |
| `registerDefaultFont(bytes)`     | 注册默认字体。`bytes` 为 **Uint8Array** 或 **ArrayBuffer**（TTF/OTF 字节），供后续 `addText` 渲染使用。     |
| `clearShapes(canvasId)`          | 清空指定画布上由 JS 添加的所有图形。                                                                        |

- **id**：必填，唯一标识，用于被 **parentId** 引用以建立父子关系。
- **parentId**：可选；若传入则当前图形为该 id 对应图形的子节点，其坐标（x/y、cx/cy 等）为**父节点局部空间**；无 parentId 时为世界坐标。
- **zIndex**：可选，整数，默认 0；数值越大越靠上绘制，同 zIndex 按添加顺序。
- **fill** / **color**：RGBA 数组 `[r, g, b, a]`，取值 0–1；默认填充白色、描边黑色。
- **stroke**：可选，`{ width, color? }`；不传或 `width ≤ 0` 表示不描边。
- **radius**：矩形圆角，默认 0（直角）。
- **strokeWidth**：线段线宽，默认 1。

示例（在 `runWithCanvas` 的 `onReady` 回调中拿到 `canvasId` 后调用）：

```js
import init, { addRect, addCircle, addLine, clearShapes, runWithCanvas } from './pkg/vello_renderer.js';
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

  addCircle(canvasId, {
  id: 'circle1',
  cx: 550,
  cy: 300,
  r: 60,
  fill: [1, 0.5, 0.6, 1],
  stroke: { width: 2, color: [1, 1, 1, 1] },
});

  addCircle(canvasId, {
  id: 'child1',
  parentId: 'rect1',
  cx: 60,
  cy: 40,
  r: 25,
  fill: [1, 1, 0.8, 1],
});

  addLine(canvasId, {
  id: 'line1',
  x1: 100,
  y1: 400,
  x2: 400,
  y2: 350,
  strokeWidth: 4,
  color: [0.3, 0.8, 1, 1],
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
