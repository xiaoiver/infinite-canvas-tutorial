---
title: '3D 场景光照（Light3D）'
description: '可切换的环境光、平行光、点光和聚光灯，以及可调节的材质参数。'
---

<!-- example-intro:zh -->

# 3D 场景光照

本页演示 `Light3D` 的四种光源：环境光、平行光、点光和聚光灯。立方体、球体、圆柱保持静止，方便比较光照；每种直接光照模式都保留一盏显式的弱环境光，便于观察未受光的面。球体的 `metallic` 与 `roughness` 可实时调节，还能对比 HDR 与 LDR 摄影棚全景图、调整聚光灯光锥半角，分别切换灯光阴影、球体投影和地板接影，并调节阴影偏移；点击播放后聚光灯会移动。

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

-   **光源组合**：没有显式光源时使用默认环境光和平行光；只要有显式光源，就仅使用这些光源。环境光只贡献颜色与强度，其他光源共用最多 8 个槽位，超出的光源不会渲染。
-   **坐标与范围**：位置与方向使用画布世界单位；在本例的联动相机中，z 值越小越靠近观察者。`direction` 从光源指向场景。默认模式在 `range > 0` 时使用原有的平方范围衰减，`range <= 0` 时关闭距离衰减。设置 `attenuation: 'inverse-square'` 后，亮度随距离平方衰减，在小于 `referenceDistance` 的 10% 处封顶，并在正数 `range` 处平滑降为零。此时 `range <= 0` 仅关闭范围截断。世界单位由 `referenceDistance` 校准，并非物理 SI 光强单位。
-   **聚光灯**：`innerConeAngle` / `outerConeAngle` 使用弧度。外角必须大于内角；渲染器会对无效输入和相等角度做安全处理。
-   **颜色与材质**：光源颜色、材质底色和贴图按 sRGB 输入，在线性空间计算光照，再做胶片映射并编码为 sRGB。`metallic` 和 `roughness` 控制 GGX 高光；`ambient` 同时控制环境填充与可选的环境反射。旧 `diffuse` / `specular` / `shininess` 字段不再影响着色。
-   **环境光照**：`material3d.environmentMap` 接受等距柱状 LDR 图片或 Radiance `.hdr` URL。HDR 辐亮度在线性空间处理；渲染器用二阶球谐函数计算漫反射，并生成五级 GGX 重要性采样后的粗糙度反射。缓存的 64 × 64 split-sum BRDF 查找表补充随视角与粗糙度变化的 GGX 遮蔽项。各级存入兼容 WebGL 与 WebGPU 的 RGBM 图集。示例可以切换生成的 HDR 摄影棚全景图与 LDR SVG。图片未设置或加载失败时保留原有环境填充。
-   **投射阴影**：为平行光、点光或聚光灯 `light3d` 设置 `castShadow: true`。前八盏直接光中最多两盏开启阴影的有效光源会让 Mesh 向其他 Mesh（包括地板）投射阴影，每盏光各用一张阴影图。平行光阴影图按 Mesh 范围拟合；外锥半角小于 85° 的聚光灯使用单张透视阴影图，更宽的聚光灯和点光则使用六个 90° 视角组成 3 × 2 图集，聚光灯的光锥仍限制照明区域。柔和阴影使用 3 × 3 PCF。图集采样跨越立方体面边缘时会重投影到相邻面；单张阴影图外的采样视为受光。`shadowStrength` 控制 0 到 1 的阴影深浅（默认 1）；为 0 时不会分配阴影图。`shadowSoftness` 控制 0 到 4 个纹素的 PCF 采样间距（默认 1）。设为 0 时只读取一次深度，呈现硬边缘；正值仍使用 3 × 3 采样。切换至“点光 + 环境光”或“聚光灯 + 环境光”可分别查看阴影；“全部光源”组合平行光与点光阴影。
-   **Mesh 阴影开关**：`material3d.castShadow: false` 让 `mesh3d` 不进入任何阴影图，但仍正常显示。`material3d.receiveShadow: false` 让 Mesh 的直接光照不受阴影遮挡，但它仍可投影。`Material3D` 和 `mesh3d` 节点中两项默认都为 `true`。示例中地板不投影，球体投影和地板接影可以分别切换。没有投影 Mesh 或没有接影 Mesh 时不会调度阴影图；环境光与环境贴图不受接影开关影响。
-   **阴影偏移**：`shadowBiasScale` 调整渲染器随表面倾角变化的深度偏移倍率（0–4，默认 1）。降低可让阴影贴近物体，但可能出现自阴影条纹；增大可消除条纹，但可能使阴影与物体分离。`shadowNormalBias` 沿接影表面的世界空间法线移动采样点，单位是画布世界单位（0–10，默认 0）；仅在深度偏移不足以解决斜面条纹时调大。两项均为逐灯设置，不改变阴影图投影或柔化程度。
-   **边界**：漫反射使用全景图的 128 × 64 缩略采样与二阶球谐函数，细节会丢失。反射图集最清晰的一层为 128 × 64，RGBM 可存储最高 16 的辐亮度。BRDF 查找表量化为 RGBA8，尺寸为 64 × 64。最多两盏光投射阴影：平行光和窄光锥聚光灯使用 1024 × 1024 阴影图，点光和宽光锥聚光灯使用六个 512 × 512 面。后续开启阴影的灯仍提供照明，但不投射阴影。透明裁切与半透明材质见[3D Mesh 透明度](/zh/example/mesh3d-alpha)。
-   **动画**：示例通过 `api.updateNode` 更新聚光灯位置与方向；默认暂停，离开视口或页面隐藏时自动停止帧更新。

## 与立方体示例的差异 {#vs-cube}

| 项目     | [cube-perspective](/zh/example/cube-perspective) | 本页                            |
| -------- | ------------------------------------------------ | ------------------------------- |
| 光源     | 渲染器默认 ambient + directional                 | 显式 spawn 多盏 `Light3D`       |
| 物体     | 单个白色立方体                                   | 立方体、球体、圆柱              |
| 动态效果 | 仅 mesh 旋转                                     | 可播放/暂停的聚光灯轨道         |
| 默认工具 | 选择                                             | 选择（`Pick3D` 需 Select 工具） |
