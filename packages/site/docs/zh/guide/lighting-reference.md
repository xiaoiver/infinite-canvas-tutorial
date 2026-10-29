---
title: 光照参考
outline: deep
---

# 光照参考

返回[第 39 课](/zh/guide/lesson-039#lighting)体验交互场景。

## 概览与兼容性

在静止的立方体、球体和圆柱上对比环境光、平行光、点光和聚光灯。可切换光源、调整强度与范围、修改球体金属度与粗糙度、开启摄影棚环境光照和投射阴影，或播放聚光灯轨道动画。点光与聚光灯可使用原有的平滑范围衰减，也可设置参考距离，改用逆平方衰减。渲染器对直接光照使用 GGX，并在线性空间计算颜色、以胶片映射处理亮部。可选的 LDR 全景图或 Radiance HDR 图片提供球谐漫反射光照，以及结合 split-sum BRDF 查找表的预过滤反射。

最多两盏设置 `castShadow: true` 的平行光、点光或聚光灯可同时投射阴影，并通过 3 × 3 PCF 过滤。每盏灯可设置 `shadowStrength`（0–1）、`shadowSoftness`（0–4 个纹素）、`shadowBiasScale`（0–4）和 `shadowNormalBias`（0–10 个画布单位）；默认值保持原有画面。每个 Mesh 可以用 `material3d.castShadow` 与 `material3d.receiveShadow` 分别关闭投影和接影（两者默认 `true`）。平行光阴影图按当前 Mesh 范围拟合；聚光灯外锥半角小于 85° 时使用一张透视阴影图，更宽的光锥和点光使用六面图集。PCF 采样跨越图集面接缝时改采样相邻面，不再重复边缘纹素。控件、阴影图尺寸与 API 说明见[光照示例](/zh/example/lighting)。

自发光表面可设置 `material3d.emissiveFactor` 与 `emissiveStrength`，无需增加场景光源。glTF 的 `KHR_materials_emissive_strength` 会随材质导入导出；可在[光照示例](/zh/example/lighting)中拖动立方体自发光强度滑块查看效果。

需要保持纯色、不受光照影响时，可设置 `material3d.unlit`，它会跳过场景光照与色调映射，同时保留基础颜色贴图与 Alpha。导入、导出 GLB 时会保留 glTF 的 `KHR_materials_unlit`；可在[光照示例](/zh/example/lighting)中通过立方体开关与自发光对比。

贴图镂空和半透明表面可分别使用 `material3d.alphaMode` 的 `mask` 与 `blend`；阴影效果和排序限制见 [3D Mesh 透明度示例](/zh/example/mesh3d-alpha)。

WebGL1 片元着色器读取 uniform 数组时需要使用常量索引。渲染器会为灯光数据和阴影矩阵
生成有界的读取分支；WebGL2 和 WebGPU 保留原生索引。材质计算通过辅助函数把颜色返回
`main()`，确保无光照材质也会执行 WebGL1 的最终颜色输出转换。浏览器回归会强制使用
WebGL1，检查顶点色、切线空间法线贴图、多光源以及平行光和点光源阴影。

## 参数与限制

### 光源组合

没有显式光源时使用默认环境光和平行光；只要有显式光源，就仅使用这些光源。环境光只贡献颜色与强度，其他光源共用最多 8 个槽位，超出的光源不会渲染。

### 坐标与范围

位置与方向使用画布世界单位；在本例的联动相机中，z 值越小越靠近观察者。`direction` 从光源指向场景。

默认模式在 `range > 0` 时使用原有的平方范围衰减，`range <= 0` 时关闭距离衰减。设置 `attenuation: 'inverse-square'` 后，亮度随距离平方衰减，在小于 `referenceDistance` 的 10% 处封顶，并在正数 `range` 处平滑降为零。

此时 `range <= 0` 仅关闭范围截断。世界单位由 `referenceDistance` 校准，并非物理 SI 光强单位。

### 聚光灯

`innerConeAngle` / `outerConeAngle` 使用弧度。外角必须大于内角；渲染器会对无效输入和相等角度做安全处理。

### 颜色与材质

光源颜色、材质底色和贴图按 sRGB 输入，在线性空间计算光照，再做胶片映射并编码为 sRGB。`metallic` 和 `roughness` 控制 GGX 高光；`ambient` 同时控制环境填充与可选的环境反射。

旧 `diffuse` / `specular` / `shininess` 字段不再影响着色。

### 环境光照

`material3d.environmentMap` 接受等距柱状 LDR 图片或 Radiance `.hdr` URL。HDR 辐亮度在线性空间处理；渲染器用二阶球谐函数计算漫反射，并生成五级 GGX 重要性采样后的粗糙度反射。

缓存的 64 × 64 split-sum BRDF 查找表补充随视角与粗糙度变化的 GGX 遮蔽项。各级存入兼容 WebGL 与 WebGPU 的 RGBM 图集。

示例可以切换生成的 HDR 摄影棚全景图与 LDR SVG。图片未设置或加载失败时保留原有环境填充。

### 投射阴影

为平行光、点光或聚光灯 `light3d` 设置 `castShadow: true`。前八盏直接光中最多两盏开启阴影的有效光源会让 Mesh 向其他 Mesh（包括地板）投射阴影，每盏光各用一张阴影图。

平行光阴影图按 Mesh 范围拟合；外锥半角小于 85° 的聚光灯使用单张透视阴影图，更宽的聚光灯和点光则使用六个 90° 视角组成 3 × 2 图集，聚光灯的光锥仍限制照明区域。柔和阴影使用 3 × 3 PCF。

图集采样跨越立方体面边缘时会重投影到相邻面；单张阴影图外的采样视为受光。`shadowStrength` 控制 0 到 1 的阴影深浅（默认 1）；为 0 时不会分配阴影图。

`shadowSoftness` 控制 0 到 4 个纹素的 PCF 采样间距（默认 1）。设为 0 时只读取一次深度，呈现硬边缘；正值仍使用 3 × 3 采样。

切换至“点光 + 环境光”或“聚光灯 + 环境光”可分别查看阴影；“全部光源”组合平行光与点光阴影。

### Mesh 阴影开关

`material3d.castShadow: false` 让 `mesh3d` 不进入任何阴影图，但仍正常显示。`material3d.receiveShadow: false` 让 Mesh 的直接光照不受阴影遮挡，但它仍可投影。

`Material3D` 和 `mesh3d` 节点中两项默认都为 `true`。示例中地板不投影，球体投影和地板接影可以分别切换。

没有投影 Mesh 或没有接影 Mesh 时不会调度阴影图；环境光与环境贴图不受接影开关影响。

### 阴影偏移

`shadowBiasScale` 调整渲染器随表面倾角变化的深度偏移倍率（0–4，默认 1）。降低可让阴影贴近物体，但可能出现自阴影条纹；增大可消除条纹，但可能使阴影与物体分离。

`shadowNormalBias` 沿接影表面的世界空间法线移动采样点，单位是画布世界单位（0–10，默认 0）；仅在深度偏移不足以解决斜面条纹时调大。两项均为逐灯设置，不改变阴影图投影或柔化程度。

### 边界

漫反射使用全景图的 128 × 64 缩略采样与二阶球谐函数，细节会丢失。反射图集最清晰的一层为 128 × 64，RGBM 可存储最高 16 的辐亮度。

BRDF 查找表量化为 RGBA8，尺寸为 64 × 64。最多两盏光投射阴影：平行光和窄光锥聚光灯使用 1024 × 1024 阴影图，点光和宽光锥聚光灯使用六个 512 × 512 面。

后续开启阴影的灯仍提供照明，但不投射阴影。透明裁切与半透明材质见[3D Mesh 透明度](/zh/example/mesh3d-alpha)。

### 自发光

`material3d.emissiveFactor` 是 0–1 范围的线性 RGB，`emissiveStrength` 与其相乘，默认 1，也可设置大于 1 的非负值。导入、导出 GLB 时保留 glTF 的 `KHR_materials_emissive_strength`。

自发光只会提高该表面的亮度，不会照亮邻近 Mesh，也不会产生泛光。

### 无光照材质

开启“无光照立方体”后，基础颜色和贴图不受直接光、环境光、阴影、自发光或电影色调映射影响。`material3d.unlit` 默认 `false`；导入、导出 GLB 时保留 glTF 的 `KHR_materials_unlit`。

Alpha 裁剪与混合仍生效。

### 导入材质贴图

glTF 法线贴图会改变表面光照法线；遮蔽贴图只衰减环境光和环境反射。`doubleSided` 还会绘制背面并翻转其光照法线。

可在[真实 GLB 的 PBR 材质示例](/zh/example/gltf-duck#pbr-material)中对比，并了解当前的切线空间限制。

### 动画

示例通过 `api.updateNode` 更新聚光灯位置与方向；默认暂停，离开视口或页面隐藏时自动停止帧更新。
