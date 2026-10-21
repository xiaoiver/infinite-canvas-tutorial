---
title: '3D Mesh 透明度'
description: '透明区域裁切、半透明 Mesh 和对应的阴影。'
---

# 3D Mesh 透明度

`material3d.alphaMode` 控制底色和贴图 alpha 的处理方式：

| 模式             | 颜色渲染                             | 阴影渲染                           |
| ---------------- | ------------------------------------ | ---------------------------------- |
| `opaque`（默认） | 忽略 alpha，写入深度                 | 不透明阴影                         |
| `mask`           | 丢弃 alpha 小于 `alphaCutoff` 的像素 | 使用相同阈值裁切                   |
| `blend`          | 从远到近混合，不写入深度             | 使用稳定的覆盖率抖动近似半透明阴影 |

有贴图时，有效 alpha 等于底色 alpha 与贴图 alpha 的乘积。`alphaCutoff` 默认是 `0.5`。渲染器先绘制不透明和裁切 Mesh，再按相机空间中心深度排序绘制半透明 Mesh。半透明 Mesh 相交或**同一个 Mesh 内**的三角形互相遮挡时，仍可能出现排序痕迹；边缘清晰的镂空图形建议用 `mask`。

<script setup>
import MeshAlpha from '../../components/MeshAlpha.vue'
</script>

<MeshAlpha locale="zh" />

```ts
api.updateNodes([
    {
        id: 'cutout',
        type: 'mesh3d',
        geometry: { type: 'plane' },
        x: 36,
        y: 77,
        width: 150,
        height: 150,
        z: 25,
        scale3d: [150, 150, 1],
        rotation3d: [0, Math.PI, 0],
        material3d: {
            map: '/mesh3d-alpha-mask.svg',
            alphaMode: 'mask',
            alphaCutoff: 0.5,
            castShadow: true,
        },
    },
    {
        id: 'glass',
        type: 'mesh3d',
        geometry: { type: 'plane' },
        x: 235,
        y: 95,
        width: 150,
        height: 170,
        z: 0,
        scale3d: [150, 170, 1],
        rotation3d: [0, Math.PI, 0],
        material3d: {
            baseColor: [1, 0.2, 0.16, 0.45],
            alphaMode: 'blend',
            castShadow: true,
        },
    },
]);
```

场景还需要 `Camera3D`、光源和接收阴影的地板，参见[光照示例](/zh/example/lighting)。半透明阴影只做单层近似，多块玻璃重叠时不会按物理透射率累加。

导入 glTF 时，每个三角形图元会保留各自的基础颜色、贴图、金属度和粗糙度系数、`alphaMode`（`OPAQUE`、`MASK` 或 `BLEND`）和 `alphaCutoff`。可选的 `metallicRoughnessMap` 遵循 glTF 通道约定：绿色通道乘以粗糙度，蓝色通道乘以金属度；红色和 alpha 通道不参与计算。缺省的系数按 glTF 规范取 `1`。节点上显式设置的 `material3d` 属性会覆盖所有图元对应的导入值，包括 `metallic: 0`、`roughness: 1` 和 `metallicRoughnessMap: null`。多个图元共用同一变换，选中时仍作为一个模型。导出 GLB 时保留各图元的颜色、PBR 系数、PBR 贴图和透明模式。

基础颜色贴图和金属度/粗糙度贴图可以分别使用 `TEXCOORD_0` 或 `TEXCOORD_1`，导出 GLB 时会保留各自的 glTF `texCoord` 选择。自定义贴图可通过 `material3d.mapTexCoord` 或 `material3d.metallicRoughnessTexCoord` 指定 `0` 或 `1`。导入时会应用 `KHR_texture_transform` 的偏移、缩放、旋转和 UV 集覆盖，导出 GLB 时也会保留。自定义变换可设置 `material3d.mapTextureTransform` 或 `material3d.metallicRoughnessTextureTransform`，例如 `{ offset: [0.25, 0], scale: [0.5, 1], rotation: Math.PI / 4 }`；设置为 `null` 可清除导入的变换。导入时会跳过更高编号的 UV 集。

使用 `await api.exportGlb()` 获取并嵌入基础颜色与金属度/粗糙度贴图。PNG 和 JPEG 保留原始字节；SVG 等可解码格式会栅格化为 PNG。导出的 GLB 再次导入时会保留贴图。贴图 URL 需要允许 CORS 获取。同步的 `api.export({ format: ExportFormat.GLB })` 仍可用于无贴图导出，但不会嵌入贴图。

现在也支持 glTF 发光材质。`material3d.emissiveFactor` 使用线性 RGB，默认值为 `[0, 0, 0]`；`material3d.emissiveMap` 按 sRGB 采样后与该系数相乘。例如 `{ emissiveFactor: [0, 1, 0], emissiveMap: '/glow.png' }` 会提高贴图绿色区域的亮度。`emissiveTexCoord` 和 `emissiveTextureTransform` 可独立选择、变换其 UV。`emissiveStrength` 默认 1，支持通过 glTF `KHR_materials_emissive_strength` 设置大于 1 的非负值。导出 GLB 时会保留发光系数、强度、贴图、UV 集和变换。

设置 `material3d.unlit: true` 可让基础颜色不受场景光照与色调映射影响，同时保留 `alphaMode`、`alphaCutoff` 和基础颜色贴图的 Alpha。导入、导出 GLB 时对应 glTF `KHR_materials_unlit`。
