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

单材质 glTF Mesh 导入时会继承 `alphaMode`（`OPAQUE`、`MASK` 或 `BLEND`）与 `alphaCutoff`；节点上显式设置的 `material3d` 属性可分别覆盖它们。当前加载器会把多个图元合并为一个 Mesh，并对所有图元使用第一个材质，因此还不支持在同一导入模型中混用不同的 alpha 模式。

导出 GLB 时会保留无贴图 Mesh 显式设置的 alpha 模式和裁切阈值。当前导出器尚未嵌入底色贴图，因此依赖贴图形成的镂空图形暂时无法通过 GLB 完整往返。
