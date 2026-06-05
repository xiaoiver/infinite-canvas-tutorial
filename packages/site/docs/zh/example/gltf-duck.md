---
title: 'glTF Duck（外部模型加载）'
description: '声明式 geometry: { type: "gltf", url } 加载 Khronos Duck，Blinn-Phong 光照与旋转动画。'
---

<!-- example-intro:zh -->

# glTF Duck

本页演示如何通过声明式 **`mesh3d`** 节点加载外部 **glTF/GLB** 模型。示例使用 Khronos 官方的 **Duck**（`/data/Duck.gltf` + `Duck0.bin`）：`LoadMesh3DGeometry` 异步解析网格、归一化到单位包围盒，再用 `scale3d` 缩放到画布尺寸；光照与 [场景光照](/zh/example/lighting) 类似，采用环境光 + 平行光。

实现参考 `packages/site/docs/components/GltfDuck.vue` 与 [课程 39 — glTF 模型](/zh/guide/lesson-039#gltf)。

## 交互示例

<script setup>
import GltfDuck from '../../components/GltfDuck.vue'
</script>

<GltfDuck />

## 要点 {#notes}

-   **几何声明**：`geometry: { type: 'gltf', url: '/data/Duck.gltf' }`；也可指定 `mesh` 索引，默认取第一个 mesh。
-   **异步加载**：`EnsureMesh3DNodes` 先创建空 companion mesh，`LoadMesh3DGeometry` 在 PostUpdate 发起 fetch，完成后写入 `positions` / `normals` / `indices`。
-   **归一化**：烘焙时居中并缩放到单位包围盒，画布上的实际大小由 `scale3d`（及 `width` / `height` 锚点）决定。
-   **材质**：Phase 1 仍用 **Blinn-Phong** + `material3d.baseColor` 着色；`DuckCM.png` 贴图尚未接入 shader。
-   **相机**：`linked: true` + `perspective`，与 2D 平移/缩放联动；可用选择 / 手型工具交互。
-   **资源路径**：VitePress 静态资源放在 `docs/public/data/`，运行时 URL 为 `/data/…`（`.gltf` 内引用的 `.bin` 需与 `.gltf` 同目录）。

## 与内置几何的差异 {#vs-primitives}

| 项目       | [lighting](/zh/example/lighting)（cube / sphere / cylinder） | 本页                              |
| ---------- | ------------------------------------------------------------ | --------------------------------- |
| 几何来源   | 内置 primitive 即时生成                                      | 外部 glTF 异步加载                |
| `geometry` | `'cube'` / `'sphere'` / `'cylinder'`                         | `{ type: 'gltf', url: '…' }`      |
| 首帧表现   | 立即可见                                                     | 加载完成前 companion 为空网格     |
| 贴图       | 纯色 Blinn-Phong                                             | 同上（Phase 1 无 baseColor 贴图） |
