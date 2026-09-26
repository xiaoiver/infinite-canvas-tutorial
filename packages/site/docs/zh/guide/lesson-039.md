---
outline: deep
description: '在现有 2D 无限画布上叠加真 3D Mesh 渲染：统一三维空间、Camera3D 与 MeshPipeline3D。'
---

<script setup>
import Cube from '../../components/Cube.vue'
import CubePerspective from '../../components/CubePerspective.vue'
import Lighting from '../../components/Lighting.vue'
import GltfDuck from '../../components/GltfDuck.vue'
</script>

# 课程 39 - 3D Mesh 渲染

在 [课程 30 - 后处理与渲染图] 之前，画布上的图形都走 2D 管线：正交相机、SDF、路径三角化填充等。本节在不替换这套 2D 渲染的前提下，增加一条 3D Mesh 分支：顶点带法线、透视/正交投影、深度测试，并与 2D 图层合成到同一块画布上。

## Framer、Spline、Rive 和 Bevy {#framer-spline-rive-bevy}

Framer 和 Spline 实现 2D/3D 融合的核心思路可以归纳为两种技术路径，它们根据产品定位选择了不同的架构策略。

Framer 的 3D 能力本质上是 CSS 3D Transforms 的增强封装，而非真正的 3D 渲染管线。因此无法导入外部 3D 模型（GLB/OBJ），无真实光照、阴影、材质系统，3D 效果仅限于"卡片翻转"、"视差层"等简单场景。详见：[How to Turn 2D Elements into Interactive 3D Objects in Framer]

![source: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer](https://framerusercontent.com/images/j0Ohpy2LqEoU8uSlHGeoymyLlg.png)

Spline 是真正的 3D 编辑器，其架构更接近游戏引擎。Spline 允许创建独立的 [UI Scenes]（2D 画布），然后将其作为纹理贴到 3D 场景中的 UI Frame 对象上。[Working with 2D and 3D objects]

![source: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects](https://cdn.spline.design/_assets/docs/957fce0d-3bef-420c-90b0-9085ffec39fd.png)

Rive 目前本质上仍是 2D 工具，它的"3D 感"来自 2.5D 变换、网格变形等，而非完整的 3D 管线。

我们的思路和 [2D Rendering in Bevy] 接近，2D 图形可视为落在 **z = 0** 平面上的对象，3D 模型与之共处同一世界；平移/缩放 2D 相机时，可选让 3D 相机一起联动。实现见 [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271)。

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

## 核心组件 {#components}

| 组件              | 作用                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **`Camera3D`**    | `projection: 'perspective' \| 'orthographic'`；`linked` 时由 `CameraSync` 跟随 2D 平移/缩放 |
| **`Mesh3D`**      | `positions`、`normals`、可选 `indices`（三角网格）                                          |
| **`Material3D`**  | Blinn-Phong：`baseColor`、`ambient`、`diffuse`、`specular`、`shininess`                     |
| **`Light3D`**     | `ambient` / `directional` / `point` / `spot`；见 [场景光照示例](/zh/example/lighting)       |
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

## 统一三维空间（linked 相机）{#unified-space}

若希望 **拖动画布时 2D 与 3D 一起平移/缩放**，为 `Camera3D` 设置 `linked: true`

`CameraSync` 每帧读取 2D `ComputedCamera` 的 `(x, y, zoom)`，并写入 3D 相机的 `eye` / `center` / `baseDistance`：

-   缩放：`baseDistance = canvas.height / 2`，`eye.z = baseDistance / zoom`，与 2D `mat3.projection` 在 z=0 处的可见高度一致
-   **正交 linked**（`projection: 'orthographic'`）：`eye = [x, -y, distance]`，`center = [x, -y, 0]`（2D 画布 Y 向下，3D 世界 Y 向上，经 `canvasWorldToWorld3D` 取反）
-   **透视 linked**（`projection: 'perspective'`）：`eye = [x, y, distance]`，`center = [x, y, 0]`（与 2D 节点相同，**画布坐标 Y 向下**）

### linked + 正交 {#linked-orthographic}

`MeshPipeline3D` 直接使用 2D 的 `viewProjectionMatrix`（含 Y 翻转与平移缩放），适合 `extrude3d` 与 2D rect 严格对齐。

[立方体（正交）](/zh/example/cube) 示例使用 **linked + orthographic**（`translation: [200, 100, 40]`）。

<Cube />

### linked + 透视 {#linked-perspective}

透视模式下，屏幕位置由 **完整 2D VP** 决定（平移、缩放、Y 翻转与 2D 一致），深度方向用透视矩阵按 `Transform3D.translation.z` 做近大远小；锚点为 `translation` 的 `(x, y, z)`，使物体落点与 2D 的 `(x, y)` 对齐。

[立方体（透视）](/zh/example/cube-perspective) 使用上述 **linked + perspective** 配置；拖动画布时 cube 应与 2D 图层同向平移、同向缩放。

<CubePerspective />

## 基于 Raycast 的拾取 {#raycast-picking}

3D 选中与 gizmo 拖拽由 **`Pick3D`** 系统负责（选择工具下 **`Select`** 也会调用同一套逻辑）。指针按下时，对光标下的视口像素做 CPU 检测，依次测试 gizmo 把手与 `Mesh3D` 三角形，**不**走 GPU picking pass。实现集中在 `ray-casting.ts` 与 `pick3d-probe.ts`。

### 流程

```plaintext
视口坐标 (x, y)
  └─ buildPickSceneForViewport(camera, …)  →  Mesh3DPickScene（与渲染同一套矩阵）
       └─ probePick3DAtViewport(…)
            ├─ 1. 已 Selected3D 实体的 gizmo 部件（逐 part 检测）
            └─ 2. 本 canvas 全部 Mesh3D → 取最近命中（最小 t）
```

**优先级**：先测 **已选中** 实体上的 gizmo；未命中再测场景 mesh。多个 mesh 同时命中时，取沿射线 **距离最近** 的一个（linked 透视下为 **深度最大/最靠前**）。

### 标准 Raycast（正交 / 自由相机）

非 linked 透视模式时，拾取路径与常见 3D 编辑器一致：

1. **`screenToRay`**：视口像素 → NDC → 用 **`inv(view × projection)`** 反投影近/远点，得到世界空间射线。
2. **`rayMeshIntersection`**：顶点经 model 矩阵变换后：
    - **粗测**：射线 vs 变换后的 **AABB**（slab 法）。
    - **细测**：对每个三角形做 **Möller–Trumbore** 射线-三角形求交，保留最小 `t`。

```ts
// packages/ecs/src/utils/ray-casting.ts（示意）
const invVP = computeInvViewProjection(projMatrix, viewMatrix);
const ray = screenToRay(vx, vy, width, height, invVP);
const hit = rayMeshIntersection(ray, positions, indices, modelMatrix);
// hit: { t, point, triangleIndex } | null
```

**Linked 正交**（`linked + orthographic`）走同一路径：`MeshPipeline3D` 将 2D 的 `viewProjectionMatrix` 注入 pick scene，点击与 2D rect、`extrude3d` 严格对齐。

### Linked 透视：屏幕空间三角形

**Linked 透视**对 mesh **不用**世界射线。屏幕位置由完整 2D VP 决定，深度由 `translation.z` 上的透视矩阵单独处理。为与顶点着色器一致，**`pickMeshLinkedPerspective`** 用相同 uniform 把每个三角形投影到视口，再用 **`pointInTriangle2D`** 判断光标是否在 **二维投影三角形** 内，并取该像素处 **最靠前** 的深度。gizmo 部件复用同一 helper（把手可带 Z 向 screen bias）。

这样在无限画布上平移/缩放时，透视 cube 仍能做到「所见即所点」。

### 拖拽约束

gizmo 命中后，**`Pick3D.handleDrag`** 每帧重新求射线，并与 **约束平面** 求交（`intersectRayWithPlane`）：

-   **平移**（箭头 / 平面）：平面法线随当前轴或平面 widget。
-   **旋转**（圆环）：平面法线为环轴；角度增量由 `angleOnRotationPlane` 计算。

相对初始命中点（`dragHitStart`）的增量写回 **`Transform3D`**。

完整指针流程与把手含义见 [3D 变换 Gizmo](#gizmo)。

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

### 把手结构（PlayCanvas 风格） {#gizmo-shapes}

把手几何参照 PlayCanvas 的 [`extras/gizmo`](https://github.com/playcanvas/engine/tree/main/src/extras/gizmo) 组织：用一个 `gizmo/` 模块与 `GizmoShape` 类层级，替代原先单一的扁平几何函数。

```plaintext
packages/ecs/src/gizmo/
  ├─ constants.ts   轴 / 平面 / 空间 / 拖拽模式
  ├─ color.ts       轴色 + hover（向白插值）/ disabled / 插值工具
  ├─ gizmos.ts      按模式装配：translate / rotate / scale / transform
  └─ shape/
       ├─ shape.ts        GizmoShape 基类：mesh + 各状态颜色 + hover/disabled/visible
       ├─ arrow-shape.ts  单轴平移箭头（柱体 + 锥体）
       ├─ plane-shape.ts  半透明平面拖拽方块
       ├─ torus-shape.ts  旋转圆环
       ├─ box-shape.ts    单轴缩放方块
       └─ sphere-shape.ts 中心 / 统一缩放把手
```

每个 `GizmoShape` 自带三角网格（`positions` / `normals` / `indices`）与 `defaultColor` / `hoverColor` / `disabledColor`，并由 `hover` / `disabled` 状态驱动 `getColor()`。`utils/gizmo-geometry.ts` 现在把这些 shape 适配为 `RenderGizmo3D` / `Pick3D` 使用的扁平 `GizmoMeshData[]`，因此渲染与拾取路径保持不变。`scale` 相关 shape（`box` + 中心 `sphere`）与 `createScaleGizmo()` 为后续缩放 gizmo 提供几何；拖拽逻辑放在下一阶段。

## 光照 {#lighting}

演示 Light3D 组件与 Blinn-Phong 材质配合：环境光打底、冷色平行光作填充，暖色聚光灯绕场景中心轨道运动，立方体 / 球体 / 圆柱三种几何体便于对比 specular 与明暗变化。

<Lighting />

## glTF 模型 {#gltf}

通过声明式 `mesh3d` 的 `geometry: { type: 'gltf', url: '…' }` 加载外部 glTF/GLB。Khronos **Duck** 示例使用 `/data/` 下的 `.gltf` + `.bin`；网格会归一化到单位包围盒，再用 `scale3d` 缩放到画布尺寸。

<GltfDuck />

## 扩展阅读 {#extended-reading}

-   [Working with 2D and 3D objects]
-   [Bevy Core3dPlugin](https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html)（插件分层参考）

[课程 30 - 后处理与渲染图]: /zh/guide/lesson-030
[How to Turn 2D Elements into Interactive 3D Objects in Framer]: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer
[UI Scenes]: https://docs.spline.design/designing-in-3-d/ui-scenes
[Working with 2D and 3D objects]: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects
[2D Rendering in Bevy]: https://bevy.org/examples/2d-rendering/2d-shapes/
