---
title: '旋转立方体（3D Mesh）'
description: '在同一画布上绘制 Blinn-Phong 立方体，并叠加半透明 2D 矩形。'
---

<!-- example-intro:zh -->

# 旋转立方体

本页是 [课程 39 — 3D Mesh 渲染](/zh/guide/lesson-039) 的**最小可运行示例**：注册 `DefaultRenderer3DPlugin`，用 ECS 创建 `Camera3D` 与三角网格，每帧更新 `Transform3D` 驱动旋转；再用 `api.updateNodes` 叠一层 2D 矩形，演示 3D pass 与 2D 矢量同屏合成。

实现参考 [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271) 与仓库内 `packages/webcomponents/examples/main.ts`。

## 交互示例

<script setup>
import Cube from '../../components/Cube.vue'
</script>

<Cube />

## 要点 {#notes}

-   **插件**：`DefaultPlugins` + `DefaultRenderer3DPlugin` + `UIPlugin`（仅需画布壳，已隐藏工具栏）。
-   **几何**：`Mesh3D` 传入 `positions` / `normals` / `indices`；示例用 procedual 立方体（每面 4 顶点、2 三角）。
-   **动画**：在 `requestAnimationFrame` 里 `cubeEntity.write(Transform3D)`；`MeshPipeline` 检测到 3D 组件变更后会重绘。
-   **2D 叠加**：`updateNodes` 的矩形画在 3D 之后，可平移缩放画布（手型工具）观察透视与叠加关系。

站点所有交互示例通过 `docs/lib/ensure-example-world.ts` 统一启动 ECS，**默认注册 `DefaultRenderer3DPlugin`**，从任意示例页 SPA 跳转到本页均可正常显示 3D。
