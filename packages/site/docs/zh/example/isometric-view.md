---
title: '等距 3D 视图'
description: '交互比较严格等距与 2:1 二轴测正交相机。'
---

# 等距 3D 视图

示例包含立方体、地板、光照和带孔 SVG 路径的挤出 Mesh。可切换 **严格等距**（方位角 45°、俯角 35.264°）与 **2:1 二轴测**（方位角 45°、俯角 30°）。视图高度控制缩放；改变相机距离不会改变正交投影的比例。

<script setup>
import IsometricView from '../../components/IsometricView.vue'
</script>

<IsometricView locale="zh" />

## 相机 API

```ts
api.setCamera3D({
    preset: 'isometric', // 或 'dimetric-2-1'
    center: [245, 180, 15],
    distance: 650,
    orthographicHeight: 380,
    clearColor: false,
});
```

`setCamera3D` 为当前画布设置专属相机，后加入的 Mesh 不会覆盖它。简单场景也可在 `mesh3d` 节点的 `camera3d` 中声明同样的配置；画布专属相机优先。预设使用 Z 向上的自由正交相机。未设置预设时，旧的联动相机行为不变。`orthographicHeight` 仅用于自由正交相机。

SVG 源图形仍可在原有 2D 画布中编辑。当前倾斜视图用于预览挤出 Mesh；在倾斜视图中直接编辑源图形的 2D 锚点属于后续导航与编辑阶段。
