# 2D LOD 设计与分阶段计划

状态：提案，尚未实现。本文只描述方案，不修改渲染行为，也不承诺性能提升倍数。

代码基线：`master` / `51ccb7d826828ab2a3e573e13a4daab58f54cfe0`。范围是 `packages/ecs` 的 2D 渲染管线，不回改教学章节 `lesson_*`，不涉及 3D 网格 LOD。外部产品演示仅提供问题背景，不能作为其内部实现的证据。

## 目标与边界

项目已经有 viewport culling。缩小画布时，大量对象同时落在视口内，裁剪本身不能降低这些对象的绘制成本。LOD 根据对象在屏幕上可辨认的细节，选择更便宜的表示。

本计划分开解决三种成本：

1. 语义 LOD：避免绘制不可读的文字及部分微小细节。
2. 几何 LOD：减少复杂路径的顶点与三角形。
3. 子树代理：减少大量可见后代的遍历、批次提交及绘制成本。

第一期不重写裁剪、不迁移渲染后端、不新增第三方依赖，不直接启用全场景子树纹理缓存。默认保持现有画面；实验能力通过运行时开关启用，能够立即关闭。

## 已有基础

| 文件 | 已有行为 | LOD 接入方式 |
| --- | --- | --- |
| [ViewportCulling.ts](../packages/ecs/src/systems/ViewportCulling.ts) | 每个相机维护 RBush，使用世界渲染包围盒查询视口并增删 `Culled` | 复用候选实体和包围盒，不把低细节状态写成 `Culled` |
| [Culling.ts](../packages/ecs/src/plugins/Culling.ts) | 裁剪在 bounds writers、`ComputeCamera` 后，`Last` 前调度 | LOD 放在裁剪之后、`MeshPipeline` 之前 |
| [MeshPipeline.ts](../packages/ecs/src/systems/MeshPipeline.ts) | 收集实体及 `Culled` 变化，消费 `pendingRenderables`，执行批次和 render graph | 监听 LOD 跨档变化，更新绘制队列 |
| [BatchManager.ts](../packages/ecs/src/systems/BatchManager.ts) | `getDrawcallCtors` 选择绘制通道，缓存普通/实例化 drawcall，支持 ctor 变化后重建 | 选择 LOD variant，维护缓存生命周期 |
| [ComputePoints.ts](../packages/ecs/src/systems/ComputePoints.ts) | 几何变化时计算 Path/Polyline 的点，不以相机缩放决定采样 | 后续另建渲染专用几何档位，保留原始数据 |
| [render-cache.ts](../packages/ecs/src/utils/render-cache.ts) | 缓存 program、pipeline、bindings、input layout、sampler | 复用 GPU 对象；这不是已有的子树位图缓存 |

`MeshPipeline.updateSvgFillRasterZoom` 已有 SVG 填充的分辨率 bucket：放大时刷新纹理，缩小时保留较大 bitmap。它可提供分档思路，但不是通用场景 LOD。

`Renderable.batchable` 默认关闭，已有实例化机制不等于所有对象都已自动合批。应先测量实际场景的 drawcall 与 CPU 分布，再决定下一阶段。

## 第一阶段：可关闭的文字语义 LOD

先实现一个边界明确的垂直切片：普通 2D 文字在不可读时切换成每行一个低成本条形代理。保留行数、行宽、位置与原有顺序，不使用一个大矩形覆盖整个文本区域。

### 运行时模型

拟新增 `ComputedLOD` 和 `ComputeLOD`，具体注册位置沿 ECS plugin 约定。状态只属于渲染运行时，不进入 SerializedNode、撤销历史或协作同步。

初期仅需要 `full` / `text-proxy` 两档；后续再扩充，不提前为所有图形建立复杂通用协议。状态应按实体及其所属相机隔离，重挂到其他相机时重新计算。

决策依据是投影后的字体高度，以 CSS px 为单位，不是单独判断 `zoom < 某值`。对嵌套变换、旋转、非均匀缩放，使用相机和世界变换投影文字局部坐标轴；遇到不支持或退化变换时回退 full。DPR 只影响采样/纹理预算，不改变语义阈值。

初始实验参数：低于 6 CSS px 进入代理，高于 8 CSS px 恢复 full。两条阈值形成滞回区，避免滚轮缩放在边界附近反复重建。这些数字是待测参数，不是已验证标准。零缩放、非有限输入及异常 bounds 必须安全回退。

### 更新与调度

`ComputeLOD` 在 `ComputeCamera`、bounds/visibility 更新与 `ViewportCulling` 完成后运行，在 `MeshPipeline` 之前输出状态。需要显式查询读写关系，避免 ECS 调度循环。

以下变化触发重新判定：

- 相机缩放或投影改变；仅平移且可见集合不变时不必重算屏幕尺寸。
- 字体、文本、文字 metrics、世界变换或 bounds 改变。
- 实体新增、重新进入视口、从隐藏恢复、迁移相机。
- 选中、悬停、编辑状态改变，以及运行时 LOD 开关改变。

只在档位实际改变时写状态和提交重建。相机变化可以线性检查可见候选，但不能每帧无条件重建所有实体。裁剪进入/退出必须同时处理：离开视口不绘制，返回时按当前相机重新判定，而不是复用过期档位。

`MeshPipeline` 将 LOD 变化合并到现有 pending 队列。消费时继续优先检查 `ToBeDeleted` 和 `Culled`，防止同帧删除、隐藏及 LOD 更新导致实体复活。恢复 full 或关闭功能时必须重新加入完整绘制通道。

### 代理、缓存与正确性

拟新增独立文字代理 drawcall，复用现有文字 metrics 和排序信息，不修改源实体的 Text、Font、Visibility 或样式组件。

`BatchManager` 已检查缓存 ctor 是否匹配，但同一 ctor 的不同 LOD 材质/几何策略还需要 variant key 和 `validate` 规则。初期只保留当前档位资源，跨档释放或移出旧通道；是否同时缓存两档必须依据测量决定，并设显存上限。不能每次缩放创建新资源而不销毁。

第一期仅对能够准确表达布局、颜色和透明度的普通文字启用代理。复杂装饰、渐变、滤镜、特殊混合、裁剪依赖或不支持的文字类型先回退 full。不能省略作为裁剪写入来源的图元或改变透明绘制顺序。

### 保持交互与导出

LOD 不等于不可见。不要复用 `Culled`、删除 Renderable 或改写 ComputedVisibility：Select、snapping、HTML 与名称标签等逻辑也会消费这些状态。

命中、框选、吸附、编辑使用原始实体和几何。selected、hovered、正在文本编辑的实体强制 full，交互状态切换必须主动触发更新，不能等下一次缩放才恢复。必要的控制点和编辑 UI 不参与 LOD。代理不新增可选中的文档节点。

导出必须显式使用 full render intent，不能受交互相机档位影响。特别检查 `MeshPipeline` 的局部 raster export：它有独立的批次添加路径。全图/局部截图、动画导出与 SVG 导出保持原始精度，完成或失败后不能污染屏幕批次与档位。

## 第二阶段：几何 LOD

第一阶段收益确认后，再为复杂 Path、Polyline、VectorNetwork 和 Brush 建立渲染专用分档数据。Circle/Rect 已有 SDF 路径，不应为了“支持 LOD”无差别简化。

- 缓存 key 包含几何 revision、scale bucket、误差预算及影响几何的 stroke 参数。
- 屏幕误差可从 0.5–1 CSS px 起测，通过局部到屏幕变换换算，而非只除以 zoom。
- 不覆盖原始 Path、ComputedPoints；bounds、拾取、编辑与导出继续使用准确数据。
- 闭合、孔洞、fill rule、自交、虚线、拐角和笔刷压力需要独立验证。普通折线简化不能直接用于所有填充路径。
- 几何只在跨档或内容改变时重建，闲置缓存有淘汰与销毁策略。

## 第三阶段：稳定子树代理

如果瓶颈仍是大量可见对象的 CPU 提交，再为稳定 frame/group 尝试 render-to-texture proxy。一个代理必须真正替代后代的绘制提交；仅在原图上覆盖纹理不构成优化。

需要先解决后代内容与字体/图片异步完成的失效、clip/opacity/blend 隔离语义、绘制顺序、分辨率 bucket、LRU 和显存预算。涉及与外部对象混合的子树不能随意合并。活跃编辑子树使用 full；缓存未准备好时继续原始渲染，构建任务分帧调度，销毁画布时取消。

现有 render graph 和 partial raster export 可作为参考，不代表可直接用作子树缓存。该阶段单独设计、单独 PR，不纳入第一阶段。

## 验证与验收

先保存 LOD 关闭的基线，使用相同硬件、画布大小、DPR、缩放轨迹和固定场景内容比较。包含文字密集场景、复杂 SVG、混合透明/裁剪场景，以及 1 千、1 万节点的缩小全览。不能用总节点数代替实际可见节点数。

记录 CPU 帧时间 p50/p95、drawcall、顶点/三角形、geometry upload、纹理/缓存内存和跨档尖峰；GPU 时间仅在后端支持可靠计时时记录。暂不承诺固定倍数或机器相关的绝对 FPS。

第一阶段验收：

- 单元测试覆盖尺寸投影、DPR 不变性、滞回、异常输入和 forced-full。
- ECS 测试覆盖相机/文字/可见性/交互触发、同帧删除、裁剪重入、多画布及状态隔离。
- 浏览器回归覆盖连续缩放、反复跨档、选择/悬停/文本编辑、恢复 full、透明顺序及功能关闭后的画面一致性。
- 全图与局部导出不含代理；导出失败后屏幕仍正确。
- 不在同档缩放时重复创建几何；多轮缩放及销毁后资源数量不持续增长。
- 文字密集场景能测到实际绘制工作减少，且 full 模式没有明显回归；若瓶颈不在文字，记录结果并调整后续范围，不掩盖负收益。

实现测试沿用 `__tests__/ecs` 和 `__tests__/browser`。测试环境说明见 [running-ecs-tests.md](./running-ecs-tests.md)。本设计 PR 只校验文档和源码引用，不把未来验收项描述成已通过测试。

## 交付顺序

1. 基线与诊断计数，确认热点。
2. 独立 PR 实现文字 LOD 垂直切片、运行时开关及测试。
3. 按测量结果逐类增加细节/几何策略，避免一次替换全部渲染。
4. 仅在确有 CPU 提交瓶颈时推进子树代理。

默认阈值、代理颜色/视觉表现、开关的公开 API 形态及是否默认启用，留给实现 PR 的截图和基准结果评审，不在本设计中视作已经决定。
