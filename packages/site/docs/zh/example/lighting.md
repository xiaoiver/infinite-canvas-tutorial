---
title: '3D 场景光照（Light3D）'
description: 'ambient / directional / spot 组合，Blinn-Phong 材质与动态聚光灯。'
---

<!-- example-intro:zh -->

# 3D 场景光照

本页演示 **`Light3D`** 组件与 **Blinn-Phong** 材质配合：环境光打底、冷色平行光作填充，暖色 **聚光灯** 绕场景中心轨道运动，三个不同高光参数的立方体便于对比 specular 与明暗变化。

实现参考 `packages/webcomponents/examples/main.ts` 与 [课程 39 — 3D Mesh 渲染](/zh/guide/lesson-039)。

## 交互示例

<script setup>
import Lighting from '../../components/Lighting.vue'
</script>

<Lighting />

## 要点 {#notes}

-   **光源类型**：`ambient` 只贡献颜色/强度；`directional`、`point`、`spot` 写入场景光源数组（上限 8 盏，见 `mesh3d` shader）。
-   **自定义光源**：spawn 任意 `Light3D` 后会 **替换** 默认环境光 + 平行光组合；若未提供 `directional`，渲染器会自动补一盏弱平行光，避免 mesh 全黑。
-   **坐标系**：`position` / `direction` 使用与 `Transform3D` 相同的 **画布世界单位**（linked 模式下约 1 px）；`direction` 指向被照亮的场景，渲染器会归一化。
-   **聚光灯**：`innerConeAngle` / `outerConeAngle` 为弧度；`range <= 0` 表示不做距离衰减（与 webcomponents 示例一致）。
-   **材质**：`Material3D` 的 `ambient` / `diffuse` / `specular` / `shininess` 控制 Blinn-Phong 响应；中间立方体更高 `specular` 与 `shininess`，高光斑更明显。
-   **动画**：每帧 `spotLight.write(Light3D)` 更新位置与方向；`MeshPipeline3D` 检测到组件变更后重绘。

## 与立方体示例的差异 {#vs-cube}

| 项目     | [cube-perspective](/zh/example/cube-perspective) | 本页                            |
| -------- | ------------------------------------------------ | ------------------------------- |
| 光源     | 渲染器默认 ambient + directional                 | 显式 spawn 多盏 `Light3D`       |
| 物体     | 单个白色立方体                                   | 三个不同材质参数的立方体        |
| 动态效果 | 仅 mesh 旋转                                     | mesh 旋转 + 聚光灯轨道          |
| 默认工具 | 选择                                             | 选择（`Pick3D` 需 Select 工具） |
