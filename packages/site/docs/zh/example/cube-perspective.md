---
title: '透视立方体（linked Camera3D）'
description: 'linked + perspective：画布坐标放置立方体，与 2D 相机平移/缩放联动，近大远小。'
---

<!-- example-intro:zh -->

# 透视立方体

本页是 [课程 39 — 3D Mesh 渲染](/zh/guide/lesson-039#linked-perspective) 的 **linked + perspective** 示例：3D 相机跟随 2D 平移与缩放，立方体用画布坐标 `translation: [100, 100, 40]` 放置（与 2D 节点的 `x`/`y` 同系），旋转时可看到各面 **近大远小**。

对比 [正交立方体](/zh/example/cube)（`projection: 'orthographic'`），正交模式下深度不会改变屏幕上的相对大小。

实现与仓库内 `packages/webcomponents/examples/main.ts`、快照测试 `__tests__/ecs/cube-perspective.spec.ts` 一致。

## 交互示例

<script setup>
import CubePerspective from '../../components/CubePerspective.vue'
</script>

<CubePerspective />

## 要点 {#notes}

-   **相机**：`Camera3D({ linked: true, projection: 'perspective', clearColor: false })`；`CameraSync` 每帧同步 2D 的 `(x, y, zoom)`。
-   **坐标**：`Transform3D.translation` 使用 **画布 Y 向下** 的 `(x, y, z)`，不要对 `x`/`y` 再调用 `canvasWorldToWorld3D`。
-   **透视**：`MeshPipeline3D` 用 2D `viewProjectionMatrix` 对齐平移/翻转，深度方向按 `translation.z` 与锚点做透视缩放。
-   **2D 叠加**：半透明矩形画在 3D 之后；用手型工具拖动画布，立方体应与 2D 图层 **同向** 平移、缩放。

## 与正交示例的差异 {#vs-ortho}

| 项目               | [cube](/zh/example/cube)       | 本页                     |
| ------------------ | ------------------------------ | ------------------------ |
| `projection`       | `orthographic`                 | `perspective`            |
| 深度表现           | 各面平行投影，大小不随远近变化 | 近大远小                 |
| 典型 `translation` | `[200, 100, 40]`               | `[100, 100, 40]`         |
| 适用               | `extrude3d`、与 2D 严格对齐    | Spline 式 2D+3D 透视场景 |
