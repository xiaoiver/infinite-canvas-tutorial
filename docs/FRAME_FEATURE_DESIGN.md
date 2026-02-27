# Frame 功能实现方案

参考 Excalidraw、tldraw、Figma 的 Frame 设计，结合当前 infinite-canvas 的 ECS 与渲染架构，给出可落地的实现方案。

---

## 一、产品定义与对标

### 1.1 什么是 Frame

Frame 是一种**容器型图形**：有明确边界（矩形），可包含其他图形作为子节点，用于分区、导出和层级管理。

| 能力        | Excalidraw                  | tldraw                 | Figma                    | 本方案建议                                    |
| ----------- | --------------------------- | ---------------------- | ------------------------ | --------------------------------------------- |
| 容器        | ✅ 子元素在数组上先于 Frame | ✅ FrameShapeUtil 父子 | ✅ Frame 为父节点        | ✅ 沿用现有 Parent/Children                   |
| 裁剪 (clip) | ✅ 子元素被 Frame 边界裁剪  | ✅ shouldClipChild     | ✅ 可选 clip             | ✅ 可选 clipChildren                          |
| 视觉        | 边框 + 可选名称/颜色        | 边框 + 名称 + 颜色     | 可无边框、可 auto layout | 先做：边框 + 名称                             |
| 拖放        | 拖入/拖出改变父子           | onDragShapesIn/Out     | 拖入/拖出                | ✅ 拖入/拖出 reparent                         |
| 导出        | 可按 Frame 导出             | 可按 Frame 导出        | 可按 Frame 导出          | ✅ 导出时支持按 Frame 范围                    |
| 顺序        | 子在前、Frame 在后          | 树形 + 同层排序        | 树形                     | ✅ 子先绘制，再画 Frame（与 Excalidraw 一致） |

### 1.2 与现有 Group 的区分

-   当前项目已有 **Group**（如 `packages/core` 的 `Group`）和序列化里的 **`g`**，多为“逻辑分组、无几何边界”。
-   **Frame** 是“有几何的容器”：有 x, y, width, height，可裁剪子元素，可单独导出。
-   实现上：Frame = **可渲染的矩形容器** + **Parent** + 可选 **ClipChildren**；Group 可继续只做“无边界分组”。

---

## 二、数据模型（ECS + 序列化）

### 2.1 组件设计

在 `packages/ecs` 中：

1. **Frame 组件（新建）**

    - 仅作为“标记”：该实体是 Frame。
    - 可选字段：`name?: string`、`clipChildren: boolean`（默认 true）、`showLabel: boolean` 等。

2. **几何与变换**

    - Frame 使用现有 **Rect**（或单独 **FrameRect** 仅长宽）+ **Transform** 表示位置与大小，便于与现有矩形工具、选中框、导出统一。

3. **层级**

    - 使用现有 **Parent** / **Children**：Frame 实体带 **Parent**，子元素通过 **Children.parent** 指向该 Frame。

4. **渲染与顺序**

    - Frame 需要参与排序与渲染：添加 **Renderable**（batchable: false 或 true 视实现而定）、**FractionalIndex** / **GlobalRenderOrder**、**ComputedBounds** 等，与现有图形一致。
    - 若 Frame 本身要画边框/背景：和 Rect 一样走 SDF/ShadowRect/SmoothPolyline 等；若只做裁剪不画框，可设 `visible: false` 或单独“仅裁剪”分支。

5. **裁剪**
    - 新增 **ClipChildren** 组件（或合在 Frame 组件里）：若存在且为 true，渲染子元素时用 Frame 的 **ComputedBounds**（世界坐标 AABB）做 scissor/clip。

### 2.2 序列化

-   新增类型：`FrameSerializedNode`（或复用 `RectSerializedNode` + `type: 'frame'`）。
-   字段建议：
    -   继承 `BaseSerializeNode<'frame'>`（或 `'rect'` 的扩展）。
    -   `x, y, width, height`（与 Transform/Rect 一致）。
    -   `parentId`：父节点 id（若在根则为空）。
    -   `clipChildren?: boolean`；`name?: string`；`showLabel?: boolean`。
-   反序列化：
    -   先创建 Frame 实体（Transform + Rect + Frame + Parent + Renderable + …），再创建子节点并建立 Children.parent 指向 Frame。
-   顺序：
    -   导出/序列化时采用 **Excalidraw 约定**：同一 Frame 的**所有子节点在前**，**Frame 节点在后**，便于渲染与导出时一致。
    -   即：`[other, frame1_child1, frame1_child2, frame1, ...]`。

### 2.3 类型定义示例（type.ts）

```ts
// type.ts 中
export interface FrameSerializedNode
  extends BaseSerializeNode<'frame'>,
  Partial<{ x: number; y: number; width: number; height: number }>,
  Partial<StrokeAttributes>,  // 边框
  Partial<FillAttributes>,    // 可选背景
  Partial<NameAttributes> {
  clipChildren?: boolean;
  showLabel?: boolean;
}

// SerializedNode 联合类型中加入 FrameSerializedNode
export type SerializedNode =
  | ...
  | FrameSerializedNode;
```

---

## 三、渲染与顺序（核心）

### 3.1 绘制顺序（Excalidraw 风格）

-   当前渲染顺序由 **FractionalIndex / GlobalRenderOrder** 决定，BatchManager 按此排序后依次 `submit`。
-   目标：**同一 Frame 内，先画所有子，再画 Frame 本身**（避免 Frame 矩形盖住子元素）。

两种实现思路：

**方案 A：用 FractionalIndex 保证顺序**

-   创建/反序列化 Frame 时，给 Frame 的 fractionalIndex 设为“比其所有子都大”（例如子用 `generateKeyBetween(prev, null)` 时，Frame 用 `generateKeyBetween(lastChildKey, null)`）。
-   这样在现有 Sort + BatchManager 下，自然得到“子 → Frame”顺序，无需改渲染管线。
-   缺点：移动/插入子时要维护“Frame 始终在子之后”的约束。

**方案 B：渲染时按层级遍历（子先、父后）**

-   在 MeshPipeline 或 BatchManager 中，不再只按 GlobalRenderOrder 排序；而是按“场景树深度 + 同层 FractionalIndex”排序：对每个 camera 的 descendants，先按“是否在某个 Frame 内”分层，同一 Frame 内先输出子再输出 Frame。
-   需要能识别“该 entity 的 parent 是 Frame”并做一次拓扑排序（子在前、Frame 在后）。
-   优点：顺序语义清晰，不依赖 fractional index 的巧妙取值。

**推荐**：先做 **方案 A**（实现快、改动小），若后续有复杂嵌套或拖动顺序问题再考虑方案 B。

### 3.2 裁剪（Clip）

-   当实体带 **Children** 且 **ClipChildren** 为 true（或 Frame 组件 clipChildren 为 true）时，在渲染**该 Frame 的子元素**时施加裁剪。
-   实现层级：
    -   **MeshPipeline**：在 `flush` 前，按 GlobalRenderOrder 顺序遍历要绘制的实体；遇到“Frame 且 clipChildren”时，**push** 该 Frame 的 world AABB（来自 ComputedBounds）作为 scissor；绘制完该 Frame 的最后一个子节点后 **pop** scissor。
    -   需要“某实体是否属于某 Frame”的映射：可从 getDescendants(camera) 的树结构里，对每个 Frame 记录其子节点列表；flush 时对每个 drawcall 判断其 shape 属于哪个 Frame，再决定是否在 scissor 内。
-   另一种做法：在 **Drawcall.submit** 里根据当前“clip stack”传入 scissor（由上层在 flush 前维护 clip stack）。
-   WebGL/WebGPU 使用 `renderPass.setScissorRect`（或等价 API）限制绘制区域；需把 world AABB 转成 NDC 或 viewport 坐标。

### 3.3 Frame 自身的绘制

-   Frame 若要有边框/背景：与 Rect 共用同一套 drawcall（SDF + SmoothPolyline 等），仅标记为 Frame 的实体也走 getDrawcallCtors(Rect) 分支即可。
-   若“仅裁剪、不画框”：可不给 Frame 加 Rect 的 fill/stroke，或设 visibility 为 hidden，仅保留 Transform + ComputedBounds 用于 clip。

---

## 四、交互

### 4.1 创建 Frame

-   工具栏增加“Frame”工具（或快捷键）。
-   行为：拖拽画出矩形 → 创建带 Transform + Rect + Frame + Parent 的实体，并可选：把当前选中的、且完全落在矩形内的节点 reparent 到该 Frame（参考 tldraw 的“选中后创建 Frame”）。
-   新建 Frame 的 fractionalIndex 设为“当前相机下最后一格之后”，保证在顶层且顺序正确。

### 4.2 选中与 Transformer

-   选中 Frame 时：显示与 Rect 相同的 resize 手柄；支持拖动移动（与现有 Transform 一致）。
-   若支持“框选到 Frame 内”：在 Select 系统中，若点击/框选命中某实体，且该实体在某个 Frame 内，则选中该实体（不强制选中 Frame）；若点击的是 Frame 的“空白区域”（矩形内但未命中任何子），则选中 Frame。

### 4.3 拖入 / 拖出

-   **拖入**：当拖拽的实体中心或 AABB 进入某 Frame 的边界内时，执行 reparentNode(node, frameNode)，并更新 local transform（x,y 转为相对 Frame 的坐标）。
-   **拖出**：拖到 Frame 外时，reparent 到 camera（根）或当前 Frame 的父级，并更新世界坐标一致。
-   可参考 API 现有 `reparentNode`，在 Pointer 系统里根据 drag 终点与各 Frame 的 AABB 做命中检测。

### 4.4 重命名 / 显示名称

-   Frame 的 `name` 存于 Name 组件或 Frame 组件；属性面板可编辑。
-   若 `showLabel` 为 true：在 Frame 上方或内部绘制文本（可复用 Text 或简单 overlay），内容为 name。

---

## 五、导出

### 5.1 按 Frame 导出

-   **导出为 PNG/SVG**：若“当前选择”为单个 Frame（或仅包含某 Frame 及其子），则导出范围为该 Frame 的 **ComputedBounds**（世界 AABB），而不是整个画布。
-   实现：在现有 export 逻辑中，若存在“只选了一个 Frame”的情况，则 setViewport 或 setCrop 为该 Frame 的 bounds，再导出。

### 5.2 SVG 结构

-   每个 Frame 对应一个 `<g>`，并设置 `clip-path` 或 `<clipPath>` 引用该 Frame 的矩形；子元素放在该 `<g>` 内。
-   顺序：先输出子的 SVG，再输出 Frame 的边框/背景（若有），与 Excalidraw 文档一致。

---

## 六、实现阶段建议

| 阶段                | 内容                                                                                                                             | 产出                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **1. 数据与序列化** | Frame 组件 + FrameSerializedNode；entityToSerializedNodes / serializedNodesToEntities 支持 frame；顺序约定（子在前、Frame 在后） | 可创建、序列化、反序列化 Frame，无裁剪 |
| **2. 渲染顺序**     | 创建/反序列化时保证 Frame 的 fractionalIndex 在子之后；验证 BatchManager 绘制顺序                                                | 子永远在 Frame 下面，不互相盖住        |
| **3. 裁剪**         | ClipChildren + 在 MeshPipeline/BatchManager 中按 Frame push/pop scissor                                                          | 子被 Frame 边界裁剪                    |
| **4. 创建与选中**   | Frame 工具、选中 Frame 显示 Transformer、框选/点击逻辑                                                                           | 可画 Frame、可选中、可移动缩放         |
| **5. 拖入/拖出**    | reparentNode + 命中检测                                                                                                          | 拖入/拖出 Frame                        |
| **6. 导出与 SVG**   | 按 Frame 导出 PNG/SVG；SVG 中 clipPath + `<g>` 结构                                                                              | 按 Frame 导出、SVG 结构正确            |

---

## 七、关键文件索引（便于落地）

-   **组件**：`packages/ecs/src/components/`（新建 Frame.ts；可选 ClipChildren.ts）。
-   **序列化**：`packages/ecs/src/utils/serialize/type.ts`（FrameSerializedNode）、`entity.ts`（entityToSerializedNodes 分支 frame）、`deserialize` 中创建 Frame 实体并挂 Parent/Children。
-   **层级与顺序**：`packages/ecs/src/systems/Transform.ts`（getDescendants）、`Sort.ts` / `ComputeZIndex.ts`（FractionalIndex）、`BatchManager.ts`（sort + flush）。
-   **裁剪**：`packages/ecs/src/systems/MeshPipeline.ts` 或 `BatchManager.flush` 中维护 clip stack 并调用 setScissorRect。
-   **选择与拖拽**：`packages/ecs/src/systems/Select.ts`、`API.reparentNode`、Pointer 相关逻辑。
-   **导出**：`packages/ecs/src/API.ts` 中 export 相关（raster/svg）；`packages/ecs/src/utils/serialize/svg.ts` 中按 Frame 输出 `<g>` + clipPath。

---

## 八、参考

-   [Excalidraw – Frames (ordering)](https://docs.excalidraw.com/docs/codebase/frames)
-   tldraw: FrameShapeUtil, TLFrameShapeProps, onDragShapesIn/Out, shouldClipChild
-   Figma: [Frames](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma), [Groups vs Frames](https://www.figma.com/best-practices/groups-versus-frames/)

按上述阶段逐步实现，即可在现有架构下完整支持 Frame 的容器、裁剪、顺序、交互与导出。
