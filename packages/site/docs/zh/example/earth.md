---
title: '贴图地球（透视 3D Mesh）'
description: '通过 baseColor 贴图（map）为球体几何包裹等距柱状投影的地球纹理，并绕 Y 轴自转。'
---

<!-- example-intro:zh -->

# 贴图地球（透视）

本页在 [课程 39 — 3D Mesh 渲染](/zh/guide/lesson-039) 的基础上，演示如何为球体几何 `geometry: { type: 'sphere' }` 设置 **基础色贴图** `material3d.map`，从而实现地球效果。贴图为等距柱状投影（equirectangular）的地球影像，球体绕 Y 轴匀速自转。

参考 AntV [G 的 sphere 示例](https://github.com/antvis/G/blob/master/site/examples/3d/geometry/demo/sphere.js)。

## 交互示例

<script setup>
import Earth from '../../components/Earth.vue'
</script>

<Earth />

## 要点 {#notes}

-   **几何**：声明式 `type: 'mesh3d'` + `geometry: { type: 'sphere', segments: [48, 32] }`；球体几何会生成等距柱状投影的 UV，供贴图采样。
-   **贴图**：`material3d.map` 接收图片 URL（基础色贴图）。纹理异步加载，加载完成前以 1×1 白色贴图占位，加载完成后自动出现在下一帧。采样器在经度方向 `REPEAT`、纬度方向 `CLAMP_TO_EDGE`，适配 equirectangular 地球贴图。
-   **光照**：声明式 `light3d`（一盏环境光 + 一盏平行光）配合 `baseColor: '#ffffff'`，让贴图颜色不被染色；适当提高 `ambient` 使背光面仍可见。
-   **相机**：`projection: 'perspective'` 获得近大远小的透视效果。
-   **动画**：`requestAnimationFrame` 中通过 `api.updateNode(earth, { rotation3d }, false)` 更新绕 Y 轴的旋转角度实现自转。

> 贴图需允许跨域（CORS）加载。示例使用与 AntV G 相同的公开地球贴图资源。
