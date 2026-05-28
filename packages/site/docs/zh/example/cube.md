---
title: '旋转立方体（正交 3D Mesh）'
description: 'linked + orthographic：与 2D 对齐的 Blinn-Phong 立方体，并叠加 2D 矩形。'
---

<!-- example-intro:zh -->

# 旋转立方体（正交）

本页是 [课程 39 — 3D Mesh 渲染](/zh/guide/lesson-039#linked-orthographic) 的 **linked + orthographic** 示例：注册 `DefaultRenderer3DPlugin`，用 2D 共享的 view-projection 绘制立方体，深度方向为平行投影；再叠一层 2D 矩形，演示 3D pass 与 2D 矢量同屏合成。

需要 **近大远小** 的透视效果时，请看 [立方体（透视）](/zh/example/cube-perspective)。

实现参考 [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271)。

## 交互示例

<script setup>
import Cube from '../../components/Cube.vue'
</script>

<Cube />

## 要点 {#notes}

-   **相机**：`projection: 'orthographic'`（默认 linked 模式）。
-   **插件**：`DefaultPlugins` + `DefaultRenderer3DPlugin` + `UIPlugin`（仅需画布壳，已隐藏工具栏）。
-   **几何**：`Mesh3D` 传入 `positions` / `normals` / `indices`；示例用 procedural 立方体（每面 4 顶点、2 三角）。
-   **动画**：在 `requestAnimationFrame` 里 `cubeEntity.write(Transform3D)`；`MeshPipeline` 检测到 3D 组件变更后会重绘。
-   **2D 叠加**：`updateNodes` 的矩形画在 3D 之后，可平移缩放画布（手型工具）观察透视与叠加关系。

站点所有交互示例通过 `docs/lib/ensure-example-world.ts` 统一启动 ECS，**默认注册 `DefaultRenderer3DPlugin`**，从任意示例页 SPA 跳转到本页均可正常显示 3D。
