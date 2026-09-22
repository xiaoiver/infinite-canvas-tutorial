---
title: 'VectorNetwork 立方体 — 拖拽边'
description: '7 顶点、9 条边的线框立方体；在 Move 模式下拖拽整条边。'
---

<!-- example-intro:zh -->

# VectorNetwork 立方体 — 拖拽边

本示例复现 [Figma Vector Networks](https://www.figma.com/blog/introducing-vector-networks/) 与 [alexharri.com](https://alexharri.com/blog/vector-networks) 文章中的经典线框立方体：**7 个顶点**、**9 条边**（省略不可见的后边）。与用多条 Path 拼合不同，移动一条边时共享顶点会自然联动。

编辑模式说明见 [课程 22 — VectorNetwork](/zh/guide/lesson-022#vector-edit-mode)。

## 交互示例

1. 页面加载后立方体已处于 **顶点编辑模式**（Move 工具）。
2. **将指针移到某条边上**，出现线段中点锚点后，或直接靠近边线。
3. **拖拽整条边** — 该边的两个端点一起移动，与之相连的其它边随之更新（例如拖动顶面边可改变立方体的「挤出」深度）。

<script setup>
import VectorNetworkCube from '../../components/VectorNetworkCube.vue'
</script>

<VectorNetworkCube />

## 拓扑数据 {#topology}

```ts
// 7 个顶点 — 前面 0–3，后面 4–6（省略不可见后边）
vertices: [
  { x: 0, y: 80 }, { x: 80, y: 80 }, { x: 80, y: 0 }, { x: 0, y: 0 },
  { x: 30, y: 100 }, { x: 110, y: 20 }, { x: 30, y: 20 },
],
// 9 条边
segments: [
  { start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 0 },
  { start: 3, end: 6 }, { start: 6, end: 5 }, { start: 2, end: 5 },
  { start: 0, end: 4 }, { start: 4, end: 6 },
],
```

源码：[`packages/site/docs/lib/vector-network-cube.ts`](https://github.com/xiaoiver/infinite-canvas-tutorial/blob/main/packages/site/docs/lib/vector-network-cube.ts)。
