---
title: '等距 3D 视图'
description: '交互比较严格等距与 2:1 二轴测正交相机。'
---

# 等距 3D 视图

示例包含立方体、地板、光照和带孔 SVG 路径的挤出 Mesh。可切换 **严格等距**（方位角 45°、俯角 35.264°）与 **2:1 二轴测**（方位角 45°、俯角 30°）。视图高度控制缩放；改变相机距离不会改变正交投影的比例。

选择 Mesh 可以使用 3D gizmo。选择 **平移** 可移动视图，选择 **旋转视角** 可在受限俯角内转动视角；鼠标、触控笔和单指触摸拖动均可操作。在平移工具下，Shift + 拖动也能旋转视角。滚轮以指针下的地面点为中心缩放，Shift + 滚轮平移；双指可以平移或捏合缩放。相机手势只改变当前画布的 3D 视图，不修改 2D 源图形，也不进入撤销历史。切换预设或调整滑块会重置相机姿态。

拾取遵循画面中的 3D 遮挡顺序，因此立方体挡住地板时会优先选中立方体。按下 Mesh 时会优先处理 3D 命中，不会误拖动重叠的 2D 源图形；选中对象的名称会随相机移动，并始终面向屏幕。

使用「选择」工具从空白处拖动可框选 3D 图形；按住 **Shift** 可以从地板或其他 Mesh 上开始框选。选框按 Mesh 投影到屏幕后的范围实时更新选择，完整包围的图形才会被选中，因此小选框不会把大块地板一并选中。

选择「绘制盒子」并在画布上拖动，即可创建 3D 盒子。「编辑平面 Z」设定底面的高度，「盒子深度」设定向上延伸的厚度。四角预览始终投影在指定平面上，改变视角后也跟随指针。松手后生成可选中的 Mesh；轻点或很短的拖动不会创建图形。

选择「编辑 SVG 锚点」，可直接在前表面拖动橙色环的外轮廓或内部孔洞锚点。拖动时源 Path 与挤出 Mesh 会同步变化。点击「倾斜 SVG」为挤出图形添加 3D 旋转，然后仍可在旋转后的前表面拖动锚点；空白区域可平移、旋转相机。此示例中的其他 SVG 图元尚不能作为 Path 锚点编辑。

开启「显示标注」可以为立方体和挤出 SVG 显示引导线与屏幕朝向的标签。锚点来自实时 3D Mesh 或 Path 顶点，因此标注会跟随视角、Mesh 变换及 SVG 锚点编辑；锚点移出视口后会隐藏。编辑时可关闭标注。这一层使用 DOM/SVG 覆盖，不参与 3D 深度遮挡。

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

自定义工具栏可将 `penbarSelected` 设为 `Pen.ORBIT_3D`，用单指针拖动自由正交 3D 视图。`Pen.HAND` 仍负责平移，按住 Shift 拖动仍可旋转。联动相机和透视相机不会响应这个旋转工具。

自定义绘制手势时，可调用 `api.viewport2WorldOnPlane({ x, y }, planeZ)` 将视口坐标投到固定 Z 平面，再用 `api.world3D2Viewport([x, y, z])` 取得覆盖层所需的视口坐标。两者使用与渲染一致的相机矩阵；若没有自由正交画布相机或输入无效，则返回 `null`。浏览器事件坐标需先经 `api.client2Viewport` 转换。

对于挤出 Path 锚点，`api.pathLocal2Viewport3D(node, [x, y])` 将 Path 局部坐标投到伴随 Mesh 的前表面；`api.viewport2PathLocal3D(node, { x, y })` 使用渲染相机的射线与该表面求交，再反算包含父级剪切和 3D 旋转的源图形局部坐标。伴随 Mesh 尚未就绪、源变换不可逆或视线与表面平行时返回 `null`。这两个方法同时适用于导入的 SVG Path 和普通 Path。可用 `normalizePathCommands`、`collectPathControlHandles`、`setPathHandlePoint` 和 `toPathData` 编辑 `d`；拖动中更新节点，松手时调用一次 `api.record()`。
