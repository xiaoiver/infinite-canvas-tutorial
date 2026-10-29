---
outline: deep
description: '在现有 2D 无限画布上叠加真 3D Mesh 渲染：统一三维空间、Camera3D 与 MeshPipeline3D。'
---

<script setup>
import Cube from '../../components/Cube.vue'
import CubePerspective from '../../components/CubePerspective.vue'
import Lighting from '../../components/Lighting.vue'
import GltfDuck from '../../components/GltfDuck.vue'
import SvgExtrusion from '../../components/SvgExtrusion.vue'
import IconExtrusion from '../../components/IconExtrusion.vue'
</script>

# 课程 39 - 3D Mesh 渲染

在 [课程 30 - 后处理与渲染图] 之前，画布上的图形都走 2D 管线：正交相机、SDF、路径三角化填充等。本节在不替换这套 2D 渲染的前提下，增加一条 3D Mesh 分支：顶点带法线、透视/正交投影、深度测试，并与 2D 图层合成到同一块画布上。

## Framer、Spline、Rive 和 Bevy {#framer-spline-rive-bevy}

Framer 和 Spline 实现 2D/3D 融合的核心思路可以归纳为两种技术路径，它们根据产品定位选择了不同的架构策略。

Framer 的 3D 能力本质上是 CSS 3D Transforms 的增强封装，而非真正的 3D 渲染管线。因此无法导入外部 3D 模型（GLB/OBJ），无真实光照、阴影、材质系统，3D 效果仅限于"卡片翻转"、"视差层"等简单场景。详见：[How to Turn 2D Elements into Interactive 3D Objects in Framer]

![source: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer](https://framerusercontent.com/images/j0Ohpy2LqEoU8uSlHGeoymyLlg.png)

Spline 是真正的 3D 编辑器，其架构更接近游戏引擎。Spline 允许创建独立的 [UI Scenes]（2D 画布），然后将其作为纹理贴到 3D 场景中的 UI Frame 对象上。[Working with 2D and 3D objects]

![source: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects](https://cdn.spline.design/_assets/docs/957fce0d-3bef-420c-90b0-9085ffec39fd.png)

Rive 目前本质上仍是 2D 工具，它的"3D 感"来自 2.5D 变换、网格变形等，而非完整的 3D 管线。

我们的思路和 [2D Rendering in Bevy] 接近，2D 图形可视为落在 **z = 0** 平面上的对象，3D 模型与之共处同一世界；平移/缩放 2D 相机时，可选让 3D 相机一起联动。实现见 [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271)。

## 架构概览 {#architecture}

```plaintext
同一 WebGL/WebGPU 上下文
  └─ MeshPipeline 渲染图
       ├─ Pass：3D（MeshPipeline3D.drawMeshes）
       ├─ Pass：3D Gizmo（RenderGizmo3D.drawGizmos，叠在 mesh 之后）
       ├─ Pass：网格 / 2D 矢量（原有 BatchManager）
       └─ Pass：后处理 → 上屏
```

-   **`Renderer3DPlugin`**：注册 3D 组件，调度 `MeshPipeline3D`（GPU 缓存）、**`CameraSync`**（联动 2D 相机）、**`Pick3D`**（选中/拖拽）与 **`RenderGizmo3D`**（变换把手绘制）。
-   **`MeshPipeline3D`**：不负责单独 swapchain present；在 `MeshPipeline` 的主 pass 里 **先画 3D、再画 2D**，共用颜色与深度附件。
-   现有 **`Mesh.ts`** 仍是 **2D 矢量填充**，不要与 3D 的 `Mesh3D` 混淆。

插件组合方式：

```ts
import {
    App,
    DefaultPlugins,
    DefaultRenderer3DPlugin,
} from '@infinite-canvas-tutorial/ecs';

const app = new App().addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin);
app.run();
```

## 核心组件 {#components}

| 组件              | 作用                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **`Camera3D`**    | `projection: 'perspective' \| 'orthographic'`；`linked` 时由 `CameraSync` 跟随 2D 平移/缩放 |
| **`Mesh3D`**      | `positions`、`normals`、可选 `indices`（三角网格）                                          |
| **`Material3D`**  | 金属度与粗糙度 PBR：`baseColor`、`metallic`、`roughness` 和环境光系数；旧字段保留兼容性     |
| **`Light3D`**     | `ambient` / `directional` / `point` / `spot`；见 [场景光照示例](/zh/example/lighting)       |
| **`Transform3D`** | 平移、欧拉角旋转、缩放                                                                      |
| **`Selected3D`**  | 3D 选中态：当前 gizmo 模式、激活轴/平面、拖拽参考点等（见 [3D 变换 Gizmo](#gizmo)）         |
| **`Mat4`**        | 4×4 矩阵工具（`perspective` / `ortho` / `lookAt`）                                          |

通过 ECS `commands.spawn` 创建实体，例如：

```ts
import {
    Camera3D,
    Mesh3D,
    Material3D,
    Transform3D,
} from '@infinite-canvas-tutorial/ecs';

commands.spawn(
    new Camera3D({
        eye: [3, 3, 5],
        center: [0, 0, 0],
        clearColor: true,
    }),
);

commands.spawn(
    new Mesh3D({ positions, normals, indices }),
    new Material3D({
        baseColor: [0.25, 0.55, 0.95, 1],
        ambient: 0.45,
        diffuse: 0.75,
        specular: 0.4,
        shininess: 48,
    }),
    new Transform3D({
        translation: [0, 0, 0],
        rotation: [0.3, 0.6, 0],
        scale: [1, 1, 1],
    }),
);
```

## 统一三维空间（linked 相机）{#unified-space}

若希望 **拖动画布时 2D 与 3D 一起平移/缩放**，为 `Camera3D` 设置 `linked: true`

`CameraSync` 每帧读取 2D `ComputedCamera` 的 `(x, y, zoom)`，并写入 3D 相机的 `eye` / `center` / `baseDistance`：

-   缩放：`baseDistance = canvas.height / 2`，`eye.z = baseDistance / zoom`，与 2D `mat3.projection` 在 z=0 处的可见高度一致
-   **正交 linked**（`projection: 'orthographic'`）：`eye = [x, -y, distance]`，`center = [x, -y, 0]`（2D 画布 Y 向下，3D 世界 Y 向上，经 `canvasWorldToWorld3D` 取反）
-   **透视 linked**（`projection: 'perspective'`）：`eye = [x, y, distance]`，`center = [x, y, 0]`（与 2D 节点相同，**画布坐标 Y 向下**）

### linked + 正交 {#linked-orthographic}

`MeshPipeline3D` 直接使用 2D 的 `viewProjectionMatrix`（含 Y 翻转与平移缩放），适合 `extrude3d` 与 2D rect 严格对齐。

[立方体（正交）](/zh/example/cube) 示例使用 **linked + orthographic**（`translation: [200, 100, 40]`）。

<Cube />

### linked + 透视 {#linked-perspective}

透视模式下，屏幕位置由 **完整 2D VP** 决定（平移、缩放、Y 翻转与 2D 一致），深度方向用透视矩阵按 `Transform3D.translation.z` 做近大远小；锚点为 `translation` 的 `(x, y, z)`，使物体落点与 2D 的 `(x, y)` 对齐。

[立方体（透视）](/zh/example/cube-perspective) 使用上述 **linked + perspective** 配置；拖动画布时 cube 应与 2D 图层同向平移、同向缩放。

<CubePerspective />

## 基于 Raycast 的拾取 {#raycast-picking}

3D 选中与 gizmo 拖拽由 **`Pick3D`** 系统负责（选择工具下 **`Select`** 也会调用同一套逻辑）。指针按下时，对光标下的视口像素做 CPU 检测，依次测试 gizmo 把手与 `Mesh3D` 三角形，**不**走 GPU picking pass。实现集中在 `ray-casting.ts` 与 `pick3d-probe.ts`。

### 流程

```plaintext
视口坐标 (x, y)
  └─ buildPickSceneForViewport(camera, …)  →  Mesh3DPickScene（与渲染同一套矩阵）
       └─ probePick3DAtViewport(…)
            ├─ 1. 已 Selected3D 实体的 gizmo 部件（逐 part 检测）
            └─ 2. 本 canvas 全部 Mesh3D → 取最近命中（最小 t）
```

**优先级**：先测 **已选中** 实体上的 gizmo；未命中再测场景 mesh。多个 mesh 同时命中时，取沿射线 **距离最近** 的一个（linked 透视下为 **深度最大/最靠前**）。

### 标准 Raycast（正交 / 自由相机）

非 linked 透视模式时，拾取路径与常见 3D 编辑器一致：

1. **`screenToRay`**：视口像素 → NDC → 用 **`inv(view × projection)`** 反投影近/远点，得到世界空间射线。
2. **`rayMeshIntersection`**：顶点经 model 矩阵变换后：
    - **粗测**：射线 vs 变换后的 **AABB**（slab 法）。
    - **细测**：对每个三角形做 **Möller–Trumbore** 射线-三角形求交，保留最小 `t`。

```ts
// packages/ecs/src/utils/ray-casting.ts（示意）
const invVP = computeInvViewProjection(projMatrix, viewMatrix);
const ray = screenToRay(vx, vy, width, height, invVP);
const hit = rayMeshIntersection(ray, positions, indices, modelMatrix);
// hit: { t, point, triangleIndex } | null
```

**Linked 正交**（`linked + orthographic`）走同一路径：`MeshPipeline3D` 将 2D 的 `viewProjectionMatrix` 注入 pick scene，点击与 2D rect、`extrude3d` 严格对齐。

### Linked 透视：屏幕空间三角形

**Linked 透视**对 mesh **不用**世界射线。屏幕位置由完整 2D VP 决定，深度由 `translation.z` 上的透视矩阵单独处理。为与顶点着色器一致，**`pickMeshLinkedPerspective`** 用相同 uniform 把每个三角形投影到视口，再用 **`pointInTriangle2D`** 判断光标是否在 **二维投影三角形** 内，并取该像素处 **最靠前** 的深度。gizmo 部件复用同一 helper（把手可带 Z 向 screen bias）。

这样在无限画布上平移/缩放时，透视 cube 仍能做到「所见即所点」。

### 拖拽约束

按下 gizmo 后会创建 `GizmoSession`，保存初始姿态和固定的投影。普通相机通过射线与
约束平面求交；linked 相机反解实际显示的把手投影，包括 Z 轴的屏幕偏移。平移沿
选中的轴或平面，旋转沿局部圆环轴；退化或无法求解的采样不会改动预览。

拖动只更新运行时组件，松手时声明式源节点才提交一次文档改动和撤销记录。
Escape、指针取消或离开画布会恢复起始姿态，不产生文档改动。

拖动期间切换相机、改变相机投影/视图或画布尺寸，会取消当前手势。通过 API 或撤销
修改源节点的姿态、几何配置或祖先节点的变换，也会取消手势，并从**当前文档**恢复
运行时预览，避免旧的松手事件覆盖新状态。名称、颜色等无关编辑可与继续进行的拖动
合并；其他画布的修改不会中断当前手势。再次按下锚点即可在新视图中开始拖动。

计算布局也属于手势上下文。Yoga 可能只更新 ECS 中的位置或尺寸，而保留文档中的
同名字段；这类变化以及祖先变换变化也会取消预览。取消时保留新的布局结果，只撤销
仍由预览持有的坐标；布局未变时按 Escape，会回到拖动前的计算位置，即使它与文档
坐标不同。手势自身产生的预览写入不会触发取消。

`GizmoSourceFrame` 保存源节点和祖先的局部几何快照，避免世界矩阵延迟更新导致
误判。指针会话拥有源节点预览期间，伴生同步不再重复回写源节点；直接操作伴生网格
的集成仍保留原有的反向同步。

无变化帧不再重复写入伴生网格的变换和材质。位姿或材质变化复用参数化网格的 CPU
顶点数据，只有几何配置变化才使对应缓存失效。

`MeshPipeline3D` 在位姿和材质编辑时也会复用 GPU 顶点、法线、UV、索引和逐网格
uniform 缓冲。只有 `Mesh3D` 写入会使几何缓存失效；直接修改数组前，需要通过
`entity.write(Mesh3D)` 取得组件。缓存检查在伴生同步之后执行，未绘制帧会保留
更新标记，下一次绘制只上传一次新几何。每个画布独立拥有缓存和场景 uniform。
几何数组完全相同的实例在同一画布中共用已上传的几何缓冲，但各自保留模型 uniform
和绘制绑定。原地修改几何会上传新一代缓冲，其他实例继续使用原来的 GPU 快照，
直到更新或移除。
删除网格或跨画布移动会释放旧缓冲；画布销毁时，先释放这些资源再销毁设备。
分配失败会回收本次已分配的缓冲，保留旧的完整缓存项，允许下一次绘制重试。

模型和法线矩阵只在位姿变化时重新计算。无变化帧或仅相机变化时跳过模型 uniform
上传；材质编辑和纹理加载完成会更新 uniform，无需重算这两个矩阵。直接修改
变换或颜色数组时，缓存按数值比较，能够识别原地修改。

场景 uniform 按画布缓存。相机与联动二维视图变化时更新场景矩阵；灯光变化只
重新打包灯光数据，无需重算矩阵。无变化绘制复用场景数据和各网格的 draw binding。
纹理就绪或替换、几何重建及 GPU 资源更换会使相应绑定失效；释放时先销毁绑定，
再销毁其引用的缓冲和纹理。场景上传或绑定分配失败后，下一次绘制可以重试。

3D 图层列表根据 ECS 中几何、名称、归属和成员的变化更新，无变化帧不再扫描
全部网格。选中成员单独跟踪，悬停 gizmo 把手不会重建图层列表。图层保留稳定的
实体引用，后续从面板选择对象以及撤销重做仍可使用。

完整指针流程与把手含义见 [3D 变换 Gizmo](#gizmo)。

## 3D 变换 Gizmo {#gizmo}

在 **选择工具**（`penbarSelected === Pen.SELECT`）下点击 3D 网格，会为实体挂上 **`Selected3D`**，并在物体中心绘制 **平移（translate）** 把手：红/绿/蓝箭头 + 半透明平面块。拖拽把手会写回 **`Transform3D.translation`**；与 2D 的 `Selected` + `RenderTransformer` 类似，但走独立 3D 拾取与绘制路径。

### 交互流程 {#gizmo-flow}

```plaintext
pointer down（Select 工具）
  └─ Pick3D：先测 gizmo，再测 Mesh3D
       ├─ 命中 gizmo → 保存姿态/投影，创建 GizmoSession
       └─ 命中 mesh → 选中；未命中 → 清空选择

pointer move（按住）
  └─ GizmoSession.update → 受约束的运行时预览

pointer up
  └─ finish(true) → 提交一次源节点姿态，记录历史

Escape / pointer cancel / leave
  └─ finish(false) → 恢复姿态，清空手势状态
```

### 坐标与把手含义 {#gizmo-axes}

与 [统一三维空间](#unified-space) 一致，gizmo 使用 **画布坐标（Y 向下）**，不是 Blender 的 Y-up：

| 颜色 | 轴  | 方向（典型 linked 画布视图） | 拖拽改动的分量  |
| ---- | --- | ---------------------------- | --------------- |
| 红   | +X  | 向右                         | `translation.x` |
| 绿   | +Y  | 向下                         | `translation.y` |
| 蓝   | +Z  | **深度**（`z+` 朝画面里）    | `translation.z` |

-   **箭头**：沿单轴平移。
-   **平面**（`xy` / `xz` / `yz` 半透明方块）：在该平面内同时改两个分量（例如 `xy` = 只动 X、Y，不改 Z）。

-   **合并模式 `transform`（默认，接近 Spline）**：**同时**显示平移箭头/平面与旋转圆环；点哪类把手就执行哪类操作（`activePartKind`：`translate` | `rotate`），无需 `W` / `E` 切换。
-   拖 **箭头 / 平面** → 改 `Transform3D.translation`；拖 **圆环** → 改 `Transform3D.rotation`（局部欧拉角，与 mesh 一致）。
-   圆环随物体当前朝向绘制；箭头仍保持画布世界轴向（X 右、Y 下、Z 深度）。
-   拾取按屏幕空间 **最近** 命中；重叠时箭头在上层，优先拖到平移。`scale` 仍预留。

### 编辑挤出矩形 {#extrude-editing}

设置了 `extrude3d` 的 `rect` 使用与声明式网格相同的 gizmo。序列化选项支持高度偏移和局部三维旋转：

```ts
const node: RectSerializedNode = {
    id: 'extruded-card',
    type: 'rect',
    zIndex: 0,
    x: 100,
    y: 80,
    width: 160,
    height: 100,
    extrude3d: { depth: 80, z: 20, rotation: [0.2, 0.3, 0] },
    fills: [{ type: 'solid', value: '#3377dd' }],
};
```

-   XY 平移写回源矩形在父坐标系中的 `x`/`y`，支持父级旋转、缩放和翻转。父变换不可逆时拒绝预览。
-   Z 平移改变 `extrude3d.z`，保留厚度 `depth`。未施加三维旋转时，`z` 表示前表面的高度偏移；伴生网格中心位于 `z - depth / 2`。
-   圆环旋转写入 `extrude3d.rotation`，使用弧度制 XYZ 欧拉角，相对于源图形已有的世界空间二维旋转。源图形的二维 `rotation` 保持不变。普通旋转图形的网格使用 `Rz(sourceAngle) × Rx(x) × Ry(y) × Rz(z)` 组合姿态。

松手提交一次，取消恢复预览；撤销、重做和重新载入文档会恢复相同姿态。拖动中关闭
挤出或替换伴生网格会中断手势，并从当前文档恢复，不会重建过期的网格。

`extrude3d: true` 仍表示厚度 100，数值仍表示指定厚度。对象写法默认厚度 100、
高度偏移 0、旋转 `[0, 0, 0]`。更新采用整个选项值替换，省略的字段恢复上述默认值。
目前没有缩放把手，可通过矩形尺寸和 `depth` 改变大小。Rect 挤出会沿着局部
顶点应用旋转和缩放；圆角、翻转及父级变换形成的剪切会烘入网格，底面与可编辑的
二维源图形对齐。不可逆的父级变换不会生成新的三维网格。

### 挤出闭合 Path {#extrude-path}

只有一层纯色填充的闭合 Path 也可以设置 `extrude3d`。前后封盖遵循实际填充轮廓，
包括孔洞；修改 `d` 或 `fillRule` 会重建网格，平移会复用。父级变换产生的剪切会
烘入网格，线性变换改变时会重建网格。

```ts
const vector: PathSerializedNode = {
    id: 'extruded-vector',
    type: 'path',
    zIndex: 0,
    x: 100,
    y: 80,
    d: 'M100 80 L200 80 L200 180 L100 180 Z M125 105 L125 155 L175 155 L175 105 Z',
    fillRule: 'evenodd',
    fills: [{ type: 'solid', value: '#3377dd' }],
    extrude3d: { depth: 40, z: 0, sideColor: '#facc15' },
};
```

每条子路径都必须闭合。开放路径、含描边图层、多层或非纯色填充、非流形轮廓
以及不可逆的退化变换会继续以 2D 显示。原 Path 文档节点保持可编辑，也支持 gizmo、撤销和
重新载入。

### 将图标转换为 3D {#icon-to-3d}

<IconExtrusion />

在在线 App 中选中 Icon，打开 **3D → 将图标转换为 3D**，设置厚度和材质预设
（哑光、亮面、金属）。转换会将 SVG 描边及端点、转角展开为闭合轮廓；填充和孔洞
转换为分组内可编辑的 Path。选中分组可统一修改厚度和材质，选中单个 Path 可修改
轮廓或倒角。撤销可恢复原 IconFont。转换结果是当时的几何快照。

注册图标集后，也可以调用 `iconFontToExtrudedPaths`：

```ts
const result = iconFontToExtrudedPaths(iconNode, {
    depth: 40,
    bevelSize: 2,
    metallic: 1,
    roughness: 0.25,
});
if (result) api.updateNodes([result.group, ...result.paths]);
```

`metallic` 和 `roughness` 是 0 到 1 的 PBR 材质参数，预设沿用现有光照管线。
当前不支持透明玻璃及折射。含 SVG 滤镜、渐变或不支持的填充的图标可能需要先整理轮廓。

`sideColor` 可选，用 CSS 颜色设置侧壁；前后封盖仍使用原图形的填充色。
省略时所有表面都使用原填充色。修改侧壁颜色只更新材质，不重建网格。

对于 SVG 的 `<path>`、`<polygon>`、`<rect>`、`<circle>`、`<ellipse>`，以及首尾点重合的
`<polyline>`，可以通过
`svgElementsToExtrudedNodes` 导入为可编辑的挤出图形；其他元素继续保持 2D。
该函数要求厚度为有限正数。

```ts
import { svgElementsToExtrudedNodes } from '@infinite-canvas-tutorial/ecs';

const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
const nodes = svgElementsToExtrudedNodes(
    svg.documentElement as unknown as SVGSVGElement,
    40,
);
api.updateNodes(nodes);
```

在在线 App 中，选中矩形或 Path 后可从顶部工具栏打开 **3D** 控件，开启挤出并
调整厚度与倒角。项目菜单中的 **导入 SVG 为 3D** 会按可见图形的实际范围居中，
即使图形只占 SVG 画布的一小部分也能落在视口中央；不支持挤出的图层仍保持 2D。
通过 **导出为 → GLB（三维）** 可下载
项目中已就绪的所有挤出网格。App 还可设置倒角轮廓的段数（1–8）和可选的十六进制
侧面颜色；侧面颜色留空时沿用图形的填充色。
如果 Path 无法生成网格，App 会禁用挤出操作，并提示闭合轮廓、填充和描边的要求。

**导入支持范围：**闭合纯色轮廓及受支持的纯色描边可转换为可编辑的 3D 图形；渐变、图案和其他不支持挤出的图层保留为 2D。导入保留受支持的孔洞、分组变换、局部引用和裁剪。外部引用、遮罩及滤镜不会转换为 3D。

下方示例可切换描边、裁剪、重复引用，以及渐变与图片图案等素材。各 SVG 元素、描边、图案、渐变和裁剪的具体支持条件，以及重叠图层的 GLB 导出行为，见 [SVG 挤出与导入兼容性参考](/zh/guide/svg-extrusion-reference)。

设置 `extrude3d.bevelSize`（单位为画布单位）可为 Path 和 Rect 挤出的前后两端
添加倒角，示例中可用 **Bevel** 滑块调整。内缩后拓扑保持稳定时，也支持孔洞、
多个独立轮廓和凹角。若轮廓相交或狭窄区域塌陷，则保留直边。改变深度或尺寸会
重新生成伴生网格，原图形仍可编辑。
为限制网格生成开销，填充边界求解后总计超过 4096 个顶点时也会保留直边。

设置 `extrude3d.bevelSegments` 为 `1`（默认）可使用直线倒角；设置为 `2`–`8`
可生成圆弧倒角。段数越多，轮廓越平滑，但网格三角形也越多。示例中的 **Bevel profile**
控件可用于比较两种效果。

示例中的 **Download GLB** 按钮会将已生成的三维网格导出为独立的 glTF 二进制文件。
使用 `api.exportGlb` 可下载画布中所有已就绪的挤出图形；指定 `nodes` 可只导出选区，
包括选中分组的子图形：

```ts
await api.exportGlb();
const glb = await api.exportGlb({
    nodes: [api.getNodeById('extruded-vector')!],
    download: false,
}); // Uint8Array
```

导出会把画布向下的 Y 轴转换为 glTF 向上的 Y 轴，并保留当前三维姿态、纯色填充及
可选的侧壁颜色。只有已就绪的伴生网格会写入文件；不支持的二维 SVG 元素不会导出。
基础颜色贴图会嵌入为 PNG 或 JPEG（其他可解码格式转换为 PNG），贴图 URL 需要允许 CORS 获取。
同步的 `api.export({ format: ExportFormat.GLB })` 仍可用于无贴图导出。
如需直接导出网格组件，可以调用底层的 `exportMeshesToGlb(sources, await loadGlbImages(sources))`。

点击 **ViewBox + shear sample** 可以查看变换后的轮廓与偶奇填充孔洞，再关闭挤出对比 2D 轮廓。
点击 **Slice clipping sample** 可以查看视口对孔洞、分离区域和曲线边缘的裁切。

<SvgExtrusion />

## 光照 {#lighting}

在下面的场景中对比环境光、平行光、点光和聚光灯。调整球体的金属度与粗糙度，切换环境贴图，或试用阴影和移动的聚光灯。

场景最多使用 8 盏直接光，其中最多 2 盏符合条件的光源可投影。自发光使用 `material3d.emissiveFactor` / `emissiveStrength`，无光照材质使用 `material3d.unlit`；镂空和透明使用 `alphaMode`。

参数、限制与实现细节见[光照参考](/zh/guide/lighting-reference)；API 与控件操作见[光照示例](/zh/example/lighting)。

<Lighting locale="zh" />

## glTF 模型 {#gltf}

通过声明式 `mesh3d` 的 `geometry: { type: 'gltf', url: '…' }` 加载外部 glTF/GLB。Khronos **Duck** 示例使用 `/data/` 下的 `.gltf` + `.bin`；网格会归一化到单位包围盒，再用 `scale3d` 缩放到画布尺寸。

glTF 基础颜色系数使用线性 RGB，ECS 材质基础颜色则存储为 sRGB。导入时进行转换，导出 GLB 时转回线性 RGB，让材质颜色在往返后保持一致。

导入还会保留 glTF 的 `doubleSided`、`normalTexture`、`occlusionTexture` 和 `TANGENT` 属性，包括独立的 UV 集、变换与强度参数。法线贴图影响光照法线；遮蔽贴图只影响间接光。[PBR 材质交互示例](/zh/example/gltf-duck#pbr-material)说明何时使用原始切线或从 UV 推导切线空间。

glTF `COLOR_0` 顶点颜色（浮点数或归一化无符号字节/短整数，RGB 或 RGBA）在线性空间与材质基础色相乘。[顶点颜色交互示例](/zh/example/gltf-duck#vertex-colors)可对比有无场景光照的结果。导出时保留为浮点 RGBA。

导入器支持三角形列表、三角带（`mode: 5`）和三角扇（`mode: 6`），无论是否提供索引，都会转换为三角形列表用于渲染和 GLB 导出。节点发生镜像变换时也会修正三角面朝向，避免单面材质被背面剔除。

稀疏 glTF accessor 可用于位置、法线、UV、颜色、切线和三角形索引。未提供基础数据时先填零，再只替换稀疏索引指定的元素。导出 GLB 时会写入普通的完整缓冲区。

<GltfDuck />

## 扩展阅读 {#extended-reading}

-   [Working with 2D and 3D objects]
-   [Bevy Core3dPlugin](https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html)（插件分层参考）

[课程 30 - 后处理与渲染图]: /zh/guide/lesson-030
[How to Turn 2D Elements into Interactive 3D Objects in Framer]: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer
[UI Scenes]: https://docs.spline.design/designing-in-3-d/ui-scenes
[Working with 2D and 3D objects]: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects
[2D Rendering in Bevy]: https://bevy.org/examples/2d-rendering/2d-shapes/
