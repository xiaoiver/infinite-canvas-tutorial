---
title: '3D 场景光照（Light3D）'
description: '可切换的环境光、平行光、点光和聚光灯，以及可调节的材质参数。'
---

<!-- example-intro:zh -->

# 3D 场景光照

在静止的立方体、球体和圆柱上比较环境光、平行光、点光和聚光灯。每种直接光模式都保留一盏弱环境光，方便观察未受光的面。

-   切换光源并调整强度或范围。
-   修改球体的金属度、粗糙度，或对比 HDR 与 LDR 环境贴图。
-   切换阴影并调整偏移；播放聚光灯动画，或提高「立方体自发光强度」对比自发光表面。

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
        id: 'sun',
        type: 'light3d',
        lightType: 'directional',
        direction: [0.45, 0.65, 0.55],
        intensity: 1.8,
        castShadow: true,
    },
    {
        id: 'lamp',
        type: 'light3d',
        lightType: 'point',
        x: 165,
        y: 105,
        z: -160,
        intensity: 18,
        range: 500,
        castShadow: true,
    },
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
        castShadow: true,
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
        material3d: {
            baseColor: '#ebeff2',
            metallic: 1,
            roughness: 0.25,
            environmentMap: '/lighting-studio.hdr',
            castShadow: true,
            receiveShadow: true,
        },
        camera3d: { linked: true, projection: 'perspective' },
    },
]);
```

点光或聚光灯可设置 `attenuation: 'inverse-square'` 使用逆平方距离衰减，并以画布世界单位设置正数 `referenceDistance`。在此距离处，逆平方系数为 1；默认值为 100。交互示例可以切换两种衰减方式。

```ts
const lamp = api.getNodeById('lamp');
if (lamp) {
    api.updateNode(lamp, {
        attenuation: 'inverse-square',
        referenceDistance: 100,
        shadowStrength: 0.6,
        shadowSoftness: 2,
        shadowBiasScale: 0.75,
        shadowNormalBias: 1,
    });
}
```

## 要点 {#notes}

-   **光源：**没有显式光源时使用默认环境光和平行光；显式光源会替代它们。最多支持 8 盏直接光。
-   **材质：**调整 `metallic`、`roughness` 或 LDR/HDR `environmentMap`；自发光使用 `emissiveFactor` / `emissiveStrength`，不受光照的材质使用 `unlit`。
-   **阴影：**最多 2 盏符合条件的直接光源可投影；每个 Mesh 可分别控制投影和接影。
-   **距离衰减：**点光和聚光灯可使用默认范围衰减，或通过 `inverse-square` 与 `referenceDistance` 设置逆平方衰减。

控件、默认值和限制详见[光照参考](/zh/guide/lighting-reference#参数与限制)。

## 与立方体示例的差异 {#vs-cube}

| 项目     | [cube-perspective](/zh/example/cube-perspective) | 本页                            |
| -------- | ------------------------------------------------ | ------------------------------- |
| 光源     | 渲染器默认 ambient + directional                 | 显式 spawn 多盏 `Light3D`       |
| 物体     | 单个白色立方体                                   | 立方体、球体、圆柱              |
| 动态效果 | 仅 mesh 旋转                                     | 可播放/暂停的聚光灯轨道         |
| 默认工具 | 选择                                             | 选择（`Pick3D` 需 Select 工具） |
