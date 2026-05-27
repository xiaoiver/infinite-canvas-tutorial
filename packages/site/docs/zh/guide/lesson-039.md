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
       ├─ Pass：网格 / 2D 矢量（原有 BatchManager）
       └─ Pass：后处理 → 上屏
```

-   **`Renderer3DPlugin`**：注册 3D 组件，调度 `MeshPipeline3D`（GPU 缓存）与 **`CameraSync`**（联动 2D 相机）。
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

示例可参考仓库内 `packages/webcomponents/examples/main.ts`，或在线交互页 [旋转立方体](/zh/example/cube)。文档站交互示例统一经 `packages/site/docs/lib/ensure-example-world.ts` 启动 ECS，默认包含 3D 插件，SPA 跳转无需刷新。

## 核心组件 {#components}

| 组件              | 作用                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- |
| **`Camera3D`**    | 透视 / 正交、`eye` / `center` / `up`、近远裁剪；`linked` 时由 `CameraSync` 跟随 2D 相机 |
| **`Mesh3D`**      | `positions`、`normals`、可选 `indices`（三角网格）                                      |
| **`Material3D`**  | Blinn-Phong：`baseColor`、`ambient`、`diffuse`、`specular`、`shininess`                 |
| **`Transform3D`** | 平移、欧拉角旋转、缩放                                                                  |
| **`Mat4`**        | 4×4 矩阵工具（`perspective` / `ortho` / `lookAt`）                                      |

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

若希望 **拖动画布时 2D 与 3D 一起平移/缩放**，为 `Camera3D` 设置 `linked: true`（默认配合 `projection: 'orthographic'`）：

```ts
commands.spawn(
    new Camera3D({
        linked: true,
        projection: 'orthographic',
    }),
);
```

`CameraSync` 每帧读取 2D `ComputedCamera` 的 `(x, y, zoom)`，并写入 3D 相机：

-   平移 `(x, y)` → `eye = [x, y, baseDistance / zoom]`，`center = [x, y, 0]`
-   缩放 → 与 z = 0 平面的距离按 `baseDistance / zoom` 变化

**独立 3D 相机**（例如固定观察立方体的演示）则不设 `linked`，自行指定 `eye` / `center` 即可；此时 2D 的平移缩放只影响 2D 图层。

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

## 当前范围与后续 {#roadmap}

**已具备：**

-   静态/动态三角网格、Blinn-Phong 光照、背面剔除
-   与 2D `MeshPipeline` 同图合成
-   `linked` 模式下的 2D/3D 相机同步

**尚未覆盖（可结合 [#76](https://github.com/xiaoiver/infinite-canvas-tutorial/issues/76) 继续演进）：**

-   glTF 导入、PBR 材质、阴影与多光源
-   将 2D 图元完全迁入统一 3D 变换栈（而非「3D pass + 2D pass」叠层）
-   与 Vello 管线的 3D 整合

## 扩展阅读 {#extended-reading}

-   [PR #271：3D rendering pipeline with unified space mode](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271)
-   [Spline：Working with 2D and 3D objects](https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects)
-   [Bevy Core3dPlugin](https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html)（插件分层参考）
