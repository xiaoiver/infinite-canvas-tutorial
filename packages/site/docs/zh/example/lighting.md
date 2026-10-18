---
title: '3D 场景光照（Light3D）'
description: '可切换的环境光、平行光、点光和聚光灯，以及可调节的材质参数。'
---

<!-- example-intro:zh -->

# 3D 场景光照

本页演示 `Light3D` 的四种光源：环境光、平行光、点光和聚光灯。立方体、球体、圆柱保持静止，方便比较光照；每种直接光照模式都保留一盏显式的弱环境光，便于观察未受光的面。球体的 `metallic` 与 `roughness` 可实时调节，点击播放后聚光灯会移动。

实现见 [`Lighting.vue`](https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/packages/site/docs/components/Lighting.vue) 与[课程 39 — 3D Mesh 渲染](/zh/guide/lesson-039)。

## 交互示例

<script setup>
import Lighting from '../../components/Lighting.vue'
</script>

<Lighting locale="zh" />

## 在场景中添加光源 {#api}

通过 `api.updateNodes` 将光源和 Mesh 一同加入场景。聚光灯的 `direction` 从光源位置指向物体，锥角单位为弧度。动画可通过 `api.updateNode` 更新位置与方向。

```ts
api.updateNodes([
    { id: 'ambient', type: 'light3d', lightType: 'ambient', intensity: 0.4 },
    {
        id: 'spot',
        type: 'light3d',
        lightType: 'spot',
        x: 200,
        y: 40,
        z: -180,
        direction: [0, 1, 1],
        color: '#ffe6b3',
        intensity: 6,
        range: 500,
        innerConeAngle: Math.PI / 8,
        outerConeAngle: Math.PI / 4,
    },
    {
        id: 'sphere',
        type: 'mesh3d',
        geometry: { type: 'sphere' },
        x: 200,
        y: 160,
        z: 40,
        width: 80,
        height: 80,
        scale3d: 70,
        material3d: { baseColor: '#ebeff2', metallic: 1, roughness: 0.25 },
        camera3d: { linked: true, projection: 'perspective' },
    },
]);
```

## 要点 {#notes}

-   **光源组合**：没有显式光源时使用默认环境光和平行光；只要有显式光源，就仅使用这些光源。环境光只贡献颜色与强度，其他光源共用最多 8 个槽位，超出的光源不会渲染。
-   **坐标与范围**：位置与方向使用画布世界单位；在本例的联动相机中，z 值越小越靠近观察者。`direction` 从光源指向场景。`range > 0` 时使用平方距离范围衰减，`range <= 0` 时关闭距离衰减。它不是物理逆平方衰减。
-   **聚光灯**：`innerConeAngle` / `outerConeAngle` 使用弧度。外角必须大于内角；渲染器会对无效输入和相等角度做安全处理。
-   **颜色与材质**：光源颜色、材质底色和贴图按 sRGB 输入，在线性空间计算直接光照，再做胶片映射并编码为 sRGB。`metallic` 和 `roughness` 控制 GGX 高光；`ambient` 仍是每个材质的环境填充系数。旧 `diffuse` / `specular` / `shininess` 字段不再影响着色。
-   **边界**：目前没有阴影、环境贴图反射或间接光照。金属的环境填充只是近似效果，不等同于完整的基于图像的光照。
-   **动画**：示例通过 `api.updateNode` 更新聚光灯位置与方向；默认暂停，离开视口或页面隐藏时自动停止帧更新。

## 与立方体示例的差异 {#vs-cube}

| 项目     | [cube-perspective](/zh/example/cube-perspective) | 本页                            |
| -------- | ------------------------------------------------ | ------------------------------- |
| 光源     | 渲染器默认 ambient + directional                 | 显式 spawn 多盏 `Light3D`       |
| 物体     | 单个白色立方体                                   | 立方体、球体、圆柱              |
| 动态效果 | 仅 mesh 旋转                                     | 可播放/暂停的聚光灯轨道         |
| 默认工具 | 选择                                             | 选择（`Pick3D` 需 Select 工具） |
