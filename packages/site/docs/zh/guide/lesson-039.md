---
outline: deep
description: '在现有 2D 无限画布上叠加真 3D Mesh 渲染：统一三维空间、Camera3D 与 MeshPipeline3D。'
---

# 课程 39 - 3D Mesh 渲染

在 [课程 30 - 后处理与渲染图] 之前，画布上的图形都走 **2D 管线**：`mat3` 正交相机、路径三角化填充、SDF 等。本节在 **不替换** 这套 2D 渲染的前提下，增加一条 **真 3D Mesh** 分支：顶点带法线、透视/正交投影、深度测试，并与 2D 图层合成到同一块画布上。

设计目标接近 [Spline 的 2D/3D 同空间模型](https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects)：2D 图形可视为落在 **z = 0** 平面上的对象，3D 模型与之共处同一世界；平移/缩放 2D 相机时，可选让 3D 相机一起联动。实现见 [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271)。

## 架构概览 {#architecture}

```plaintext
同一 WebGL/WebGPU 上下文
  └─ MeshPipeline 渲染图
       ├─ Pass：3D（MeshPipeline3D.drawMeshes）
       ├─ Pass：3D Gizmo（RenderGizmo3D.drawGizmos，叠在 mesh 之后）
       ├─ Pass：网格 / 2D 矢量（原有 BatchManager）
       └─ Pass：后处理 → 上屏
```

-   **`Renderer3DPlugin`**：注册 3D 组件，调度 `MeshPipeline3D`（GPU 缓存）、**`CameraSync`**（联动 2D 相机）、**`Pick3D`**（选中/拖拽）与 **`RenderGizmo3D`**（变换把手绘制）。
-   **`MeshPipeline3D`**：不负责单独 swapchain present；在 `MeshPipeline` 的主 pass 里 **先画 3D、再画 2D**，共用颜色与深度附件。
-   现有 **`Mesh.ts`** 仍是 **2D 矢量填充**，不要与 3D 的 `Mesh3D` 混淆。

插件组合方式：

```ts
import {
    App,
    DefaultPlugins,
    DefaultRenderer3DPlugin,
} from '@infinite-canvas-tutorial/ecs';

const app = new App().addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin);
app.run();
```

示例可参考：

-   **[立方体（透视）](/zh/example/cube-perspective)**：`linked` + `perspective`，`translation: [100, 100, 40]`（与 `packages/webcomponents/examples/main.ts` 一致）
-   **[立方体（正交）](/zh/example/cube)**：`linked` + `orthographic`，`translation: [200, 100, 40]`

文档站交互示例统一经 `packages/site/docs/lib/ensure-example-world.ts` 启动 ECS，默认注册 `DefaultRenderer3DPlugin`，SPA 跳转无需刷新。

## 核心组件 {#components}

| 组件              | 作用                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **`Camera3D`**    | `projection: 'perspective' \| 'orthographic'`；`linked` 时由 `CameraSync` 跟随 2D 平移/缩放 |
| **`Mesh3D`**      | `positions`、`normals`、可选 `indices`（三角网格）                                          |
| **`Material3D`**  | Blinn-Phong：`baseColor`、`ambient`、`diffuse`、`specular`、`shininess`                     |
| **`Transform3D`** | 平移、欧拉角旋转、缩放                                                                      |
| **`Selected3D`**  | 3D 选中态：当前 gizmo 模式、激活轴/平面、拖拽参考点等（见 [3D 变换 Gizmo](#gizmo)）         |
| **`Mat4`**        | 4×4 矩阵工具（`perspective` / `ortho` / `lookAt`）                                          |

通过 ECS `commands.spawn` 创建实体，例如：

```ts
import {
    Camera3D,
    Mesh3D,
    Material3D,
    Transform3D,
} from '@infinite-canvas-tutorial/ecs';

commands.spawn(
    new Camera3D({
        eye: [3, 3, 5],
        center: [0, 0, 0],
        clearColor: true,
    }),
);

commands.spawn(
    new Mesh3D({ positions, normals, indices }),
    new Material3D({
        baseColor: [0.25, 0.55, 0.95, 1],
        ambient: 0.15,
        diffuse: 0.75,
        specular: 0.4,
        shininess: 48,
    }),
    new Transform3D({
        translation: [0, 0, 0],
        rotation: [0.3, 0.6, 0],
        scale: [1, 1, 1],
    }),
);
```

## Rect 挤出 `extrude3d`（Spline 式）{#extrude3d}

在 rect 节点上设置 `extrude3d`，由 `SyncExtrude3D` 按 **同一套** `x` / `y` / `width` / `height` 生成 3D 盒子（无需手写 `Transform3D`）：

```ts
api.updateNodes([
    {
        id: 'box',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        extrude3d: 80, // 或 true（默认深度 100）
        fills: [
            /* … */
        ],
    },
]);
```

-   包围盒、拖拽、缩放仍由 2D rect 的 Transformer 处理。
-   首次挤出会自动创建 `linked` + `orthographic` 的 `Camera3D`；mesh 中心与 rect 的 `x`/`y`/`extrude3d` 对齐（画布坐标）。
-   删除 rect 或去掉 `extrude3d` 会清理 companion mesh。

## 统一三维空间（linked 相机）{#unified-space}

若希望 **拖动画布时 2D 与 3D 一起平移/缩放**，为 `Camera3D` 设置 `linked: true`。`linked` 时默认 `projection: 'orthographic'`；显式设为 `'perspective'` 可获得近大远小（见下文与 `packages/webcomponents/examples/main.ts`）。

`CameraSync` 每帧读取 2D `ComputedCamera` 的 `(x, y, zoom)`，并写入 3D 相机的 `eye` / `center` / `baseDistance`：

-   缩放：`baseDistance = canvas.height / 2`，`eye.z = baseDistance / zoom`，与 2D `mat3.projection` 在 z=0 处的可见高度一致
-   **正交 linked**（`projection: 'orthographic'`）：`eye = [x, -y, distance]`，`center = [x, -y, 0]`（2D 画布 Y 向下，3D 世界 Y 向上，经 `canvasWorldToWorld3D` 取反）
-   **透视 linked**（`projection: 'perspective'`）：`eye = [x, y, distance]`，`center = [x, y, 0]`（与 2D 节点相同，**画布坐标 Y 向下**）

### linked + 正交 {#linked-orthographic}

`MeshPipeline3D` 直接使用 2D 的 `viewProjectionMatrix`（含 Y 翻转与平移缩放），适合 `extrude3d` 与 2D rect 严格对齐：

```ts
commands.spawn(
    new Camera3D({
        linked: true,
        projection: 'orthographic',
        clearColor: false,
    }),
);

commands.spawn(
    new Mesh3D({ positions, normals, indices }),
    new Material3D({
        /* … */
    }),
    new Transform3D({
        // 与 2D 节点一致时可使用 canvasWorldToWorld3D(x, y, z)
        translation: [200, 100, 40],
        scale: [100, 100, 100],
    }),
);
```

文档站 [立方体（正交）](/zh/example/cube) 示例使用 **linked + orthographic**（`translation: [200, 100, 40]`）。

### linked + 透视 {#linked-perspective}

透视模式下，屏幕位置由 **完整 2D VP** 决定（平移、缩放、Y 翻转与 2D 一致），深度方向用透视矩阵按 `Transform3D.translation.z` 做近大远小；锚点为 `translation` 的 `(x, y, z)`，使物体落点与 2D 的 `(x, y)` 对齐。

```ts
commands.spawn(
    new Camera3D({
        linked: true,
        projection: 'perspective',
        clearColor: false,
    }),
);

commands.spawn(
    new Mesh3D({ positions, normals, indices }),
    new Material3D({
        baseColor: [1, 1, 1, 1],
        ambient: 0.25,
        diffuse: 0.75,
        specular: 0.4,
        shininess: 48,
    }),
    new Transform3D({
        // 画布坐标，与 SerializedNode 的 x/y 同系，勿对 x/y 再 canvasWorldToWorld3D
        translation: [100, 100, 40],
        rotation: [0.3, 0.6, 0],
        scale: [100, 100, 100],
    }),
);
```

在线示例 [立方体（透视）](/zh/example/cube-perspective) 使用上述 **linked + perspective** 配置；拖动画布时 cube 应与 2D 图层同向平移、同向缩放。

### 独立 3D 相机 {#standalone-camera}

不设 `linked` 时自行指定 `eye` / `center` / `projection`，2D 平移缩放只影响 2D 图层。适合固定机位的演示或单元测试：

```ts
commands.spawn(
    new Camera3D({
        eye: [0, 0, 3.5],
        center: [0, 0, 0],
        clearColor: true,
    }),
);

commands.spawn(
    new Mesh3D({ positions, normals, indices }),
    new Material3D({
        /* … */
    }),
    new Transform3D({
        translation: [0, 0, 0],
        rotation: [0.4, 0.4, 0],
        scale: [1, 1, 1],
    }),
);
```

## 与 2D 图层合成 {#compositing}

典型用法：

1. `commands.spawn` 创建 `Camera3D` 与带 `Mesh3D` 的实体；
2. `commands.execute()`；
3. 照常 `api.updateNodes([...])` 添加矩形、图片等 2D 节点。

3D 先写入 framebuffer（可清屏），2D 网格与矢量再叠加上去；HTML overlay 仍由原有 `RenderHTML` 等系统处理。

## 动画与重绘 {#animation}

`MeshPipeline` 默认 **按需渲染**（有脏标记才 `renderCamera`）。修改 **`Transform3D`**（或 `Mesh3D` / `Material3D` / `Camera3D`）后，会触发本帧 3D 重绘。

驱动旋转示例（在 `requestAnimationFrame` 里写组件即可，与 `App` 自带的 `world.execute()` 循环配合）：

```ts
const cubeEntity = commands
    .spawn(/* Mesh3D + Material3D + Transform3D */)
    .id()
    .hold();

commands.execute();

const t0 = performance.now();
const spin = (now: number) => {
    const t = (now - t0) / 1000;
    cubeEntity.write(Transform3D).rotation = [
        0.3 + t * 0.9,
        0.6 + t * 1.2,
        t * 0.5,
    ];
    requestAnimationFrame(spin);
};
requestAnimationFrame(spin);
```

## 3D 变换 Gizmo {#gizmo}

在 **选择工具**（`penbarSelected === Pen.SELECT`）下点击 3D 网格，会为实体挂上 **`Selected3D`**，并在物体中心绘制 **平移（translate）** 把手：红/绿/蓝箭头 + 半透明平面块。拖拽把手会写回 **`Transform3D.translation`**；与 2D 的 `Selected` + `RenderTransformer` 类似，但走独立 3D 拾取与绘制路径。

### 交互流程 {#gizmo-flow}

```plaintext
pointer down（Select 工具）
  └─ Pick3D.handlePointerDown
       ├─ probePick3DAtViewport：先测 gizmo，再测 Mesh3D
       ├─ 命中 gizmo → 记录 activeAxis、dragHitStart，dragging = true
       └─ 命中 mesh → add Selected3D；未命中 → 移除已有 Selected3D

pointer move（按住）
  └─ Pick3D.handleDrag：射线与约束平面求交，delta = 当前交点 − dragHitStart

pointer up
  └─ 结束拖拽，清空 activeAxis / dragHitStart
```

**避免「一点击就跳位」：** 拖拽位移以 **`dragHitStart`**（按下时射线在约束平面上的交点）为基准，而不是物体中心。否则点击箭头末端时，首帧就会产生巨大 delta。

**与 2D 框选的关系：** `Select` 在按下时会用 `probePick3DAtViewport` 探测是否点在 3D 网格或 gizmo 上；若命中则跳过 2D 刷选。`pick3d-bridge` 中的 `is3DGizmoDragging` 在 gizmo 拖拽期间为 true，避免与 2D marquee 冲突。

### 坐标与把手含义 {#gizmo-axes}

与 [统一三维空间](#unified-space) 一致，gizmo 使用 **画布坐标（Y 向下）**，不是 Blender 的 Y-up：

| 颜色 | 轴  | 方向（典型 linked 画布视图） | 拖拽改动的分量  |
| ---- | --- | ---------------------------- | --------------- |
| 红   | +X  | 向右                         | `translation.x` |
| 绿   | +Y  | 向下                         | `translation.y` |
| 蓝   | +Z  | **深度**（`z+` 朝画面里）    | `translation.z` |

-   **箭头**：沿单轴平移。
-   **平面**（`xy` / `xz` / `yz` 半透明方块）：在该平面内同时改两个分量（例如 `xy` = 只动 X、Y，不改 Z）。

-   **合并模式 `transform`（默认，接近 Spline）**：**同时**显示平移箭头/平面与旋转圆环；点哪类把手就执行哪类操作（`activePartKind`：`translate` | `rotate`），无需 `W` / `E` 切换。
-   拖 **箭头 / 平面** → 改 `Transform3D.translation`；拖 **圆环** → 改 `Transform3D.rotation`（局部欧拉角，与 mesh 一致）。
-   圆环随物体当前朝向绘制；箭头仍保持画布世界轴向（X 右、Y 下、Z 深度）。
-   拾取按屏幕空间 **最近** 命中；重叠时箭头在上层，优先拖到平移。`scale` 仍预留。

### 渲染：`RenderGizmo3D` {#gizmo-render}

-   系统在 **`Renderer3DPlugin`** 里注册；几何在 `initPipeline` 时由 **`createTranslateGizmo()`** 上传 GPU（`packages/ecs/src/utils/gizmo-geometry.ts`）。
-   实际绘制在 **`MeshPipeline3D`** 主 pass 内、**`drawMeshes` 之后** 调用 `drawGizmos()`（`gizmo3d-bridge` 持有 `RenderGizmo3D` 实例）。
-   使用专用着色器 **`gizmo3d-display`**（`packages/ecs/src/shaders/gizmo3d-display.ts`）：
    -   顶点：与 `mesh3d` 相同的 linked 透视投影，并对 **+Z 深度轴** 施加可计算的屏幕偏移（见下）；
    -   片元：**无光照**，直接输出 `u_BaseColor`（把手颜色固定，不受场景光影响）。
-   **绘制顺序**：先画半透明 **平面**，再画 **箭头**，避免平面盖住轴心。
-   **MegaState**：深度测试 `ALWAYS`、不写深度，保证 gizmo 始终叠在 3D mesh 之上。

**屏幕尺寸恒定：** `computeGizmoScale()` 根据相机与物体距离换算世界空间缩放。`camera.linked` 时只用 **轴向深度** `|eye.z − object.z|`，避免拖 X/Y 时因 eye 与物体水平距离变化导致把手忽大忽小（`packages/ecs/src/utils/gizmo-geometry.ts`）。

### linked + 透视下的蓝轴显示 {#gizmo-linked-z}

真 +Z 在 linked 透视里几乎投影成一个点，无法看见箭头。因此对蓝轴增加 **`computeLinkedPerspectiveZGizmoScreenBias()`**（`packages/ecs/src/utils/gizmo-projection.ts`）：

-   比较 X 轴与 Z 轴端点在屏幕上的长度；
-   若 Z 轴过短，则按固定屏幕方向（略向右下）偏移，使 **蓝轴屏幕长度与红轴一致**；
-   拾取使用同一套 bias（`pick3d-probe.ts` → `pickMeshAtViewport`），保证「看到哪就能点哪」。

逻辑深度仍为 **`translation.z`**；屏幕上的倾斜仅为 **显示与拾取辅助**，不改变世界 +Z 的定义（`mesh3d` 注释：`Canvas z+ points into the screen`）。

### 拾取：`Pick3D` 与 `probePick3DAtViewport` {#gizmo-pick}

| 模块                            | 路径                                     | 作用                                                     |
| ------------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| **`Pick3D`**                    | `packages/ecs/src/systems/Pick3D.ts`     | 仅在 Select 工具下读 `Input`；处理 down/move/up          |
| **`probePick3DAtViewport`**     | `packages/ecs/src/utils/pick3d-probe.ts` | 共享探测：gizmo 优先，再 mesh；`Select` 与 `Pick3D` 共用 |
| **`buildPickSceneForViewport`** | `packages/ecs/src/utils/pick3d-probe.ts` | 与 `buildCamera3DSceneUniforms` 一致的拾取场景           |
| **屏幕空间拾取**                | `packages/ecs/src/utils/ray-casting.ts`  | `pickMeshLinkedPerspective` 与 `mesh3d` 顶点投影一致     |

**约束平面（平移）：** 例如拖 X 轴时在 Y 法向平面内求交；拖 `xy` 平面时在 Z 法向平面内求交，再只把 delta 的分量写回 `initialTranslation`（`Pick3D.computeConstrainedTranslation`）。

**调度：** `Pick3D` 排在 **`CameraSync` 与 `Select` 之后**、`Last` 之前，保证本帧相机矩阵与 2D 选择逻辑已就绪，且与 `ZoomLevel` / `ComputeCamera` 无环（见 `Renderer3DPlugin` 注释）。

### 场景矩阵共享 {#gizmo-uniforms}

`buildCamera3DSceneUniforms` / `packSceneUniformBuffer`（`packages/ecs/src/utils/mesh3d-scene.ts`）同时服务于 **mesh 绘制**、**gizmo 绘制** 与 **拾取**，避免投影不一致。`u_CanvasAnchor` 使用物体 **`translation` 的 (x, y, z)**，透视缩放锚点与 cube 落点一致。

### 试用方式 {#gizmo-try}

在 `packages/webcomponents/examples/main.ts` 中已 spawn **linked + perspective** 的 `Camera3D` 与 cube（`translation: [100, 100, 40]`）。切换到 **选择工具**，点击 cube：

1. 出现 translate gizmo；
2. 拖红/绿轴在画布平面内移动，拖蓝轴改深度；
3. 拖箭头/平面平移，拖圆环旋转（无需切换模式）。

## 当前范围与后续 {#roadmap}

**已具备：**

-   静态/动态三角网格、Blinn-Phong 光照、背面剔除
-   与 2D `MeshPipeline` 同图合成
-   `linked` + **orthographic**（2D VP 对齐）与 **perspective**（2D 平移/缩放/Y 翻转 + 透视深度）
-   `extrude3d` 挤出盒子（linked 正交路径）
-   **3D 合并 Transform Gizmo**：平移 + 旋转一体；`Pick3D` 按把手类型分支；linked 透视 Z 轴可见性修正；与 2D Select 协同

## 快照测试 {#tests}

ECS 回归测试（需 headless WebGL，见仓库 `docs/running-ecs-tests.md`）：

| 文件                                     | 场景                                       | 金图                             |
| ---------------------------------------- | ------------------------------------------ | -------------------------------- |
| `__tests__/ecs/cube.spec.ts`             | 独立 `Camera3D` + 原点 cube                | `snapshots/cube.png`             |
| `__tests__/ecs/cube-perspective.spec.ts` | `linked` + `perspective`，`(100, 100, 40)` | `snapshots/cube-perspective.png` |

```bash
pnpm exec jest -c ./jest.ecs.config.js __tests__/ecs/cube.spec.ts __tests__/ecs/cube-perspective.spec.ts
```

因 becsy / `App.run()` 限制，**每个 spec 文件只能启动一次 App**，透视用例单独放在 `cube-perspective.spec.ts`。

**尚未覆盖（可结合 [#76](https://github.com/xiaoiver/infinite-canvas-tutorial/issues/76) 继续演进）：**

-   glTF 导入、PBR 材质、阴影与多光源
-   Gizmo **缩放** 模式（`Selected3D.mode` 已预留）
-   将 2D 图元完全迁入统一 3D 变换栈（而非「3D pass + 2D pass」叠层）
-   与 Vello 管线的 3D 整合

## 扩展阅读 {#extended-reading}

-   [PR #271：3D rendering pipeline with unified space mode](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271)
-   [Spline：Working with 2D and 3D objects](https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects)
-   [Bevy Core3dPlugin](https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html)（插件分层参考）
