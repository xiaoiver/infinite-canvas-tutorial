---
title: 'glTF Duck（外部模型加载）'
description: '加载 glTF/GLB 模型，展示 PBR 光照、法线与环境遮蔽贴图，以及双面材质。'
---

<!-- example-intro:zh -->

# glTF Duck

本页演示如何通过声明式 **`mesh3d`** 节点加载外部 **glTF/GLB** 模型。示例使用 Khronos 官方的 **Duck**（`/data/Duck.gltf` + `Duck0.bin`）：`LoadMesh3DGeometry` 异步解析网格、归一化到单位包围盒，再用 `scale3d` 缩放到画布尺寸；光照与 [场景光照](/zh/example/lighting) 类似，采用环境光 + 平行光。

实现参考 `packages/site/docs/components/GltfDuck.vue` 与 [课程 39 — glTF 模型](/zh/guide/lesson-039#gltf)。

## 交互示例

<script setup>
import GltfDuck from '../../components/GltfDuck.vue'
import GltfMaterial from '../../components/GltfMaterial.vue'
import GltfVertexColors from '../../components/GltfVertexColors.vue'
</script>

<GltfDuck />

## PBR 材质对比 {#pbr-material}

Khronos **NormalTangentTest** GLB 同时包含基础颜色、金属度与粗糙度、切线空间法线贴图、环境遮蔽贴图以及双面材质。通过开关比较各项效果：法线贴图改变直接光照，遮蔽贴图仅压暗环境光和环境反射；`doubleSided` 控制背面剔除，并翻转背面的光照法线。

<GltfMaterial locale="zh" />

导入的 `normalTexture.scale`、`occlusionTexture.strength`、UV 集选择、`KHR_texture_transform` 和 glTF `TANGENT` 属性均会在 GLB 导出再导入后保留。有切线时，法线贴图使用其手性符号处理镜像 UV 岛和硬边接缝。本示例模型没有切线，因此使用屏幕空间导数；法线贴图使用第二套 UV 或 UV 缩放、旋转时也会用导数推导切线空间，此时结果可能与原始切线不同。[模型与贴图](https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/NormalTangentTest)由 Ed Mackey 制作，版权归 2017 Analytical Graphics, Inc. 所有，使用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可。

## 顶点颜色 {#vertex-colors}

这个小型 glTF 在平面的四个角使用归一化 8 位 `COLOR_0`，颜色会在表面插值。切换光照可比较自发光与受光材质，也可以使用画布工具移动或旋转图形。

<GltfVertexColors locale="zh" />

`COLOR_0` 支持 RGB 或 RGBA；RGB 的 alpha 默认为 1。顶点 RGB 是线性颜色，会在线性空间与材质基础色及贴图相乘；顶点 alpha 也会与它们的 alpha 相乘。混合场景中，没有顶点颜色的图元使用白色。GLB 导出会把导入的颜色保存为浮点 RGBA，便于再次导入。

## 要点 {#notes}

-   **几何声明**：`geometry: { type: 'gltf', url: '/data/Duck.gltf' }`；也可指定 `mesh` 索引，默认取第一个 mesh。
-   **异步加载**：`EnsureMesh3DNodes` 先创建空 companion mesh，`LoadMesh3DGeometry` 在 PostUpdate 发起 fetch，完成后写入 `positions` / `normals` / `indices`。
-   **归一化**：烘焙时居中并缩放到单位包围盒，画布上的实际大小由 `scale3d`（及 `width` / `height` 锚点）决定。
-   **材质**：使用 GGX 金属度与粗糙度光照；glTF 的 `baseColorTexture`（例如 `DuckCM.png`）会解析为 `Material3D.map`，并在 `mesh3d` 着色器中采样。
-   **颜色空间**：glTF 的 `baseColorFactor` 使用线性 RGB；导入时转为 ECS 的 sRGB `Material3D.baseColor`，由着色器解码。Alpha 保持原值，导出 GLB 时再转回线性 RGB，以便往返后保持颜色一致。
-   **相机**：`linked: true` + `perspective`，与 2D 平移/缩放联动；可用选择 / 手型工具交互。
-   **资源路径**：VitePress 静态资源放在 `docs/public/data/`，运行时 URL 为 `/data/…`（`.gltf` 内引用的 `.bin` 需与 `.gltf` 同目录）。

## 与内置几何的差异 {#vs-primitives}

| 项目       | [lighting](/zh/example/lighting)（cube / sphere / cylinder） | 本页                               |
| ---------- | ------------------------------------------------------------ | ---------------------------------- |
| 几何来源   | 内置 primitive 即时生成                                      | 外部 glTF 异步加载                 |
| `geometry` | `'cube'` / `'sphere'` / `'cylinder'`                         | `{ type: 'gltf', url: '…' }`       |
| 首帧表现   | 立即可见                                                     | 加载完成前 companion 为空网格      |
| 贴图       | 纯色 PBR 材质                                                | glTF 基础颜色、PBR、法线与遮蔽贴图 |
