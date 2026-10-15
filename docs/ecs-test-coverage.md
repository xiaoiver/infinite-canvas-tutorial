# ECS 测试覆盖率推进

按用户可见行为和回归风险分批补齐，每轮提交独立 PR，并记录同一环境下完整 ECS
测试的前后数据。继续保留 `packages/ecs/src/**/*.ts` 的统计范围。

## 第一批：吸附与缩放

2026-10-09，以 master `c804dc35` 为基线，在 Node 20、原生 canvas/headless-gl
环境运行完整 Jest ECS 测试。基线为 190 个测试文件、902 项测试全部通过，行覆盖率
60.94%，分支覆盖率 46.92%。这是本地完整测试数据；Coveralls 的 master 数字在
合并并完成 CI 上传后更新。

本轮完成后，193 个测试文件、1052 项测试全部通过，同一统计范围内新增覆盖 379 行。

| 范围     | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| -------- | ------------------: | --------------------: |
| ECS 全包 |     60.94% → 62.29% |       46.92% → 48.45% |
| 吸附计算 |       6.96% → 99.3% |        2.02% → 97.97% |
| 缩放几何 |       84.44% → 100% |         51.72% → 100% |
| 缩放手势 |       23.01% → 100% |         12.5% → 92.3% |

新增 150 项确定性测试，覆盖：

-   吸附距离随相机缩放换算、阈值边界、脱离吸附、最近参考和等距候选稳定性。
-   隐藏、被视口剔除、缺失、无效几何，以及选区的祖先/后代过滤；父级环不造成死循环。
-   水平和垂直等距排列、辅助线位置、网格与对象吸附的各轴优先级。
-   8 个缩放锚点的固定点、旋转与翻转、等比和中心缩放、跨零后反向拖回。
-   文本缩放原点、带触摸命中余量的指针偏移、线段和折线端点的局部坐标转换。

测试直接运行生产计算逻辑，在场景 API/ECS 读写边界使用小型替身；不启动渲染器，
不使用固定延时。真实 ECS 交互测试与 Playwright 浏览器回归继续验证事件、历史、
组件访问权限和渲染结果。

## 第二批：历史与文档一致性

2026-10-09，从已合并的第一批继续，最终基于 master `b4ca6c06` 验证。
沿用第一批完整运行的 62.29% 行覆盖率基线；期间合入的 Path shader 修复未改变
其覆盖率计数，ECS 的测试集合与统计配置未变。

同一 Node 20 原生依赖环境下，195 个测试文件、1102 项测试全部通过，耗时约
8 分 43 秒。完整报告中已覆盖行净增 84 行，已覆盖分支净增 74 个。

| 范围             | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| ---------------- | ------------------: | --------------------: |
| ECS 全包         |     62.29% → 62.58% |       48.45% → 48.99% |
| `ElementsChange` |     51.05% → 55.74% |       35.70% → 42.49% |
| `API`            |     48.91% → 51.72% |       33.33% → 36.00% |
| `Snapshot`       |       94.28% → 100% |       84.21% → 94.73% |

全包函数覆盖率从 65.16% 提升到 65.48%。修复后，历史路径不再调用 `Delta.ts`
中的旧浅比较辅助函数，该文件行覆盖率从 74.19% 降至 61.90%；这些代码仍计入
完整报告，未通过排除文件提高指标。

新增 50 项行为测试：

-   本地修改、远端替换与撤销重做交错时，保留未参与本地修改的属性和远端新增节点。
-   远端删除后跳过不可见历史；远端更新和选区变化保留 redo，新文档修改清空 redo。
-   删除整棵子树、换父级、分组/解组后，检查文档、ECS 父子引用、世界坐标和选区。
-   父级内部排序及排序边界；重复 id、缺失父级、环形父级在写入前被拒绝。
-   已排队编辑取消后保留未提交修改和 redo；两个画布使用相同节点 id 仍保持隔离。
-   可选属性在 undo 后真正移除，并恢复 ECS 默认值；redo 后再次同步。
-   快照保有嵌套值的独立副本、复用未变节点，并保留删除墓碑供历史恢复。

这批测试发现并修复了差量误判：快照深拷贝后，内容相同的填充数组和设计变量
会被浅比较当作修改。比如只调整宽度，随后收到远端颜色更新，再撤销宽度，原实现
会把远端颜色一起还原。`Delta` 现在按文档值比较嵌套内容，避免记录无关字段。

`history-document.spec.ts` 使用真实 ECS 系统、公开编辑 API 和显式帧推进；仅替换
GPU 设备与渲染系统，不使用固定延时。`history-delta.spec.ts` 单独验证快照和差量。

## 第三批：选择与交互状态机

2026-10-09，基于 master `3e891000`（第二批 PR #384 已合并），继续使用相同
Node 20 原生依赖环境和全包统计范围。基线复用第二批完整报告的 62.58% 行覆盖率。

完整覆盖率运行耗时约 9 分 41 秒，执行 196 个测试文件、1136 项测试：
194 个文件 / 1134 项通过，旧的 `zindex.sendBackward` 和 `zindex.bringtofront`
两项触发 30 秒超时；保持代码和超时配置不变，随后串行定向复跑 2 项均通过（约 36 秒）。
新增的 34 项交互测试全部通过，已有及新增覆盖率门槛均满足。

该完整运行报告中，已覆盖行净增 354 行，已覆盖分支净增 229 个：

| 范围 | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| --- | ---: | ---: |
| ECS 全包 | 62.58% → 63.77% | 48.99% → 50.57% |
| `Select` | 34.64% → 45.87% | 30.50% → 41.22% |
| `RenderTransformer` | 46.97% → 50.50% | 34.39% → 41.61% |
| 旋转手势 | 70.58% → 100% | 25% → 85% |
| `EventWriter` | 58.06% → 65.94% | 50.87% → 65.78% |

全包函数覆盖率由 65.48% 提升到 66.24%。上述数字来自完整运行的报告；
不把定向复跑的局部覆盖率当作全包结果。Coveralls 的 master 数字在合并并完成 CI 后更新。

本批新增 34 项真实事件驱动测试，覆盖：

- 鼠标、触摸和手写笔无 hover 直接选中并拖动，以及一次手势对应一次撤销。
- Shift 追加/切换选区、隐藏或锁定图形过滤、框选绘制过程中实时更新选区。
- 八个缩放锚点、Shift 等比、Alt 中心缩放、触摸命中偏移与连续旋转/缩放。
- 多选旋转中的冻结选框、固定枢轴、释放和中断后恢复，以及撤销重做。
- pointercancel、pointerleave、Escape、切换工具和同帧取消；中断后旧输入不再改变图形或相机。
- 连线两端分别解绑为浮动点、重绑到另一图形，并保持对端和撤销重做一致。
- 两个画布使用相同节点 id 时的交互隔离，以及拖动中销毁画布后的事件监听清理。

测试暴露并修复了三个方面的问题：事件回调误用已失效的 ECS 临时句柄；中断手势
遗留输入点/旋转选框，切换手形工具后旧指针还会驱动相机；点击和框选能选中隐藏节点。
普通变换中断后保留最后显示的几何结果，记录为一次可撤销操作；矢量编辑保持原有回滚语义。

`ecs-selection` 复用第二批的真实 ECS world，以 DOM 事件驱动 `EventWriter`、
`CameraControl`、`Select` 和 `RenderTransformer`，只替换 GPU 设备/渲染系统。
使用显式帧推进和确定性点击时钟，并将 JSDOM 事件监听中的异常重新抛给测试，
避免错误被事件派发吞掉。主题初始化与实际设备系统保持一致。

现有 Chromium 旋转与矢量编辑中断回归共 24 项：首轮 22 项通过、2 项等待超时；
两个失败用例分别独立重复两次，4 次均通过。保留这一运行记录，后续继续消除
浏览器测试对双击和帧调度时序的依赖；本轮没有延长超时或放宽断言。

## 第四批：滤镜栅格化与渲染资源缓存

2026-10-09，基于 master `00deb2bf`（第三批 PR #385 已合并），沿用第三批完整
报告的 63.77% 行覆盖率、50.57% 分支覆盖率基线，保留全部 ECS 源文件统计。

同一 Node 20 原生依赖环境下，199 个测试文件、1205 项测试全部通过，耗时约
8 分 57 秒，所有覆盖率门槛均通过。前一批曾超时的两个排序测试本轮直接通过。
完整报告中已覆盖行净增 405 行、已覆盖分支净增 133 个：

| 范围 | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| --- | ---: | ---: |
| ECS 全包 | 63.77% → 65.23% | 50.57% → 51.57% |
| `solidShapeRasterForFilter` | 8.55% → 91.81% | 4.82% → 77.20% |
| `render-cache` | 90.32% → 100% | 68.29% → 92.68% |
| `cube-lut-cache` | 18.33% → 100% | 0% → 100% |

全包函数覆盖率由 66.24% 提升到 66.91%。源代码去重和修复使可执行行总数从
28236 变为 28222，已覆盖行从 18007 增至 18412；未排除统计文件。
这些是本地完整运行的数据，Coveralls 的 master 数字在合并并完成 CI 后更新。

新增 69 项单测，覆盖以下行为：

- 滤镜输入的真实像素：圆形/椭圆/矩形轮廓、翻转后的圆角、粗糙轮廓孔洞、
  矢量网络三角面、描边轮廓、填充与描边的独立透明度。
- 图形与渲染边界的选择、描边外扩、分数坐标与像素缩放，以及哪些填充/描边
  可以合并烘焙到滤镜纹理。
- 多行文字与路径字形的遮罩、渐变透明度、多层 CSS 渐变顺序和径向渐变。
- 渲染资源缓存的值复用、描述符修改后的失效、嵌套快照、只读布局输入、
  缓存哈希碰撞、失败分配重试，以及重复销毁后重新创建。
- LUT 的三种 GPU 格式、体素顺序、HDR 值、输入域、跨设备隔离、幂等注册、
  单个/全部释放和上传失败后的释放与重试。

测试复现并修复了多行渐变文字被逐行裁剪而消失、透明度被重复相乘、CSS 渐变
叠层顺序反转、调用方修改采样器描述符导致旧资源误复用、3D 采样器忽略 W 寻址模式、
布局输入被修改、带空附件项的管线不能复用，以及 LUT 上传失败泄漏纹理的问题。
四种滤镜栅格化入口统一通过 `DOMAdapter` 创建画布。

像素单测使用真实 `canvas`/Cairo，只替换 ECS 组件读取边界；GPU 缓存测试替换设备
分配/上传边界，验证资源身份和释放次数，不将其视为 GPU 渲染验证。另加一个快速
Chromium 用例，在真实浏览器中验证 Path2D 孔洞与描边、锥形渐变角度和多行文字透明度；
此浏览器用例不计入 Jest 覆盖率。

## 第五批：atlas、图片缓存与批次生命周期

2026-10-09，基于 master `8d4ffbba`（第四批 PR #386 已合并），沿用上一批完整
报告的 65.23% 行覆盖率、51.57% 分支覆盖率基线，继续保留全部 ECS 源文件统计。

同一 Node 20 原生依赖环境下，202 个测试文件、1273 项测试全部通过，耗时约
9 分 25 秒，所有覆盖率门槛均通过。完整报告中已覆盖行净增 226 行、已覆盖分支
净增 152 个：

| 范围 | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| --- | ---: | ---: |
| ECS 全包 | 65.23% → 65.99% | 51.57% → 52.62% |
| `GlyphManager` | 89.39% → 100% | 61.29% → 91.17% |
| 图片 URL 栅格缓存 | 65.07% → 97.70% | 32.20% → 96.87% |
| `BatchManager` | 74.05% → 98.76% | 58.62% → 93.49% |

全包函数覆盖率由 66.91% 提升到 67.93%。可执行行总数从 28222 变为 28241，
已覆盖行从 18412 增至 18638，没有排除源文件。现有 Chromium 文字/图片/混合模式
回归所选 12 项全部通过（约 1 分 54 秒）；未增加浏览器用例，也不将浏览器执行
计入 Jest 覆盖率。Coveralls 的 master 数字在合并并完成 CI 后更新。

新增 68 项单测，覆盖：

- atlas 字符去重、跨字体隔离、采样留白、无变更时避免重复上传；分配/上传失败
  保留旧 atlas，首次失败与增量失败均可重试，重复销毁与重新初始化不重复释放。
- 多行文字起点与对齐、默认缩放、组合字符，以及位图字体 kerning 开关。
- 同 URL 解码合并、订阅者去重、异常回调隔离、同步/异步失败后重试、迟到解码
  与新缓存竞争、旧位图释放，以及真实 Canvas 图片像素和透明占位。
- 图片适配参数与透明度优先读取启用的序列化填充层，保持 ECS 回退值和 DPR 尺寸策略。
- 使用实际 drawcall 类选择渲染组合、兼容批次复用、空批次构造函数变化、
  非实例化/实例化切换、隐藏 UI 的移除/清空/恢复和脏标记传递。
- 混合模式在底层时先初始化背景、普通/混合节点的执行顺序、多帧 uniform 复用、
  节点透明度只在合成时应用一次，以及调度资源的最终释放。

测试复现并修复：atlas 重建失败前已销毁旧纹理并修改缓存；重复销毁 atlas；
多行起点与位图 kerning 偏移；迟到解码覆盖新位图；同步抛错遗留解码中的记录；
停用图片层影响适配参数；空批次只按数量匹配而复用错误 renderer；以及已移除 UI
drawcall 在恢复时重新进入绘制队列。

atlas 测试只替换字形栅格输入和 GPU 分配边界，实际执行图集打包；字形像素质量
继续由已有 TinySDF/浏览器测试验证。图片测试使用真实 Cairo 像素和显式 Promise
完成顺序，不用固定延时。批次测试使用实际 renderer 类、检查和缓存逻辑，在组件
存储、GPU 提交与 render graph 调度边界使用替身；不将这些测试当作 GPU 像素验证。

## 第六批：文字、图标与特效属性同步

2026-10-09，基于 master `2a574797`（第五批 PR #387 已合并），沿用上一批完整
报告的 65.99% 行覆盖率、52.62% 分支覆盖率基线，继续保留全部 ECS 源文件统计。

同一 Node 20 原生依赖环境下，203 个测试文件、1324 项测试全部通过，耗时约
10 分 36 秒，所有覆盖率门槛均通过。完整报告中已覆盖行净增 252 行、已覆盖分支
净增 226 个：

| 范围 | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| --- | ---: | ---: |
| ECS 全包 | 65.99% → 66.88% | 52.62% → 54.18% |
| `ElementsChange` | 56.73% → 79.43% | 43.60% → 64.72% |
| `icon-font` | 59.00% → 68.11% | 43.37% → 57.83% |
| 图标子实体创建 | 81.81% → 95.45% | 63.63% → 90.90% |

全包函数覆盖率由 67.93% 提升到 68.20%。可执行行总数从 28241 变为 28244，
已覆盖行从 18638 增至 18890，没有排除源文件。这些是本地完整运行的数据；
Coveralls 的 master 数字在合并并完成 CI 后更新。

新增 51 项真实 ECS 行为测试，覆盖：

- 文字内容、字体、字距、行高、锚点、换行、行数限制、溢出方式和额外行距的
  编辑、撤销和重做；显式清空属性时立即恢复默认值。
- 实际测量行随换行、截断和溢出方式变化；编辑后的排版结果与重新加载一致。
- 改变对齐/基线时保持文本框位置；完整文档快照使用自身锚点，不重复补偿。
- 普通文字与路径文字互切，恢复方向、沿路径偏移和法线偏移后的字形布局。
- 图标的圆、线、路径几何缩放，图元类型和数量切换，多余子实体隐藏与恢复，
  子图元不会进入文档节点列表。
- 无效图标名恢复为有效图标，描边颜色/宽度与关闭描边，以及仅切换滤镜时的
  椭圆栅格占位；动态修改后的子几何与绘制属性对比重新加载结果。
- 文字装饰、阴影部分属性更新、混合模式与滤镜清空的撤销重做。

测试发现并修复：文字换行/行数限制/溢出等字段只更新文档而未同步组件；清空文字
字段后残留旧值或产生 `NaN`；加载时遗漏溢出方式和额外行距；完整快照被误当作
对齐交互而调整锚点；无效图标的矩形占位无法切换为子图元；关闭描边残留旧层；
仅修改滤镜时未更新图标椭圆占位；以及清空滤镜后仍保留组件。

`history-property-sync.spec.ts` 复用真实 ECS world、公开编辑 API、历史系统和显式
帧推进，仅替换 GPU 设备/渲染系统。文字使用实际测量与排版，图标使用本地注册的
小型 SVG 集合，不依赖网络或固定延时。断言覆盖组件、测量行、几何及文档状态，
不把这些断言视为 GPU 像素验证。

新增测试与已有文档历史测试共 85 项定向验证通过；现有 Chromium 文字像素、atlas
复用、滤镜栅格及五类图标缩放/撤销回归共 9 项全部通过（约 2 分 36 秒）。未新增
浏览器用例，浏览器执行也不计入 Jest 覆盖率。全仓库 lint、浏览器与新增单测的
TypeScript 检查均通过。

## 第七批：矢量编辑、裁剪与嵌套选择

2026-10-09，基于 master `cea98007`（第六批 PR #388 已合并），继续使用同一
Node 20 原生依赖环境与全包统计范围。基线复用第六批完整报告。

完整运行共 205 个测试文件、1381 项测试全部通过，耗时约 10 分 20 秒。
已覆盖行净增 629 行，已覆盖分支净增 360 个；原有及新增模块门槛均通过。

| 范围 | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| --- | ---: | ---: |
| ECS 全包 | 66.88% → 69.07% | 54.18% → 56.76% |
| `Select` | 45.87% → 74.15% | 41.22% → 70.21% |
| `RenderTransformer` | 50.50% → 76.70% | 41.61% → 71.09% |
| `API` | 52.59% → 53.74% | 37.12% → 38.12% |

全包函数覆盖率由 68.20% 提升到 69.68%。上述数字来自完整 ECS 运行，
Coveralls 的 master 报告需等合并后 CI 上传完成才会更新。

新增 57 项真实 ECS 事件测试，覆盖：

- 矢量顶点、曲线、切线手柄和中点插入的提交，以及单步撤销重做。
- 四类手势在 pointercancel、Escape、切换工具和编辑模式时回滚，忽略后续旧事件。
- 拖拽途中撤销重做、外部几何/样式修改及节点删除，避免旧手势覆盖最新文档。
- 三种手柄联动模式、旋转/翻转/缩放后的固定邻点，以及删除和切断的拓扑恢复。
- 裁剪内容移动、应用/Escape/外部点击退出、工具切换、无效目标与空容器。
- 裁剪期间删除蒙版或内容，以及两个画布使用相同节点 id 时的状态隔离。
- 嵌套组的 hover、框选、整体缩放、子节点移动及历史恢复，避免重复变换后代。
- 取消拖拽后恢复 hover，同时保持旧拖拽失效。

测试复用 `ecs-selection` 和 `ecs-document` 帧推进工具，经过实际 EventWriter、
Select、Transformer 和历史系统。新增的确定性双击工具控制事件时钟，不依赖
固定延时。仅替换 GPU 设备及渲染系统；这些断言验证交互状态和几何，不代表像素验证。

这批测试发现并修复了裁剪工具切换时遗留临时裁剪/锁定状态、空容器导致选择
不存在的子节点、失效裁剪目标未清理，以及 pointercancel 后 hover 持续失效的问题。
裁剪退出继续保留当前裁剪几何，沿用现有取消语义。

现有 Chromium 手柄联动、拖拽中撤销、外部样式/旋转和曲线回滚回归共 10 项通过
（约 3 分钟），未新增浏览器用例，也不将浏览器执行计入 Jest 覆盖率。
新增用例及已有选择交互共 91 项定向验证通过；全仓库 lint、新增单测及其生产
依赖的 TypeScript 检查、修改文件的格式检查均通过。

## 第八批：纹理缓存与 SVG 异步重栅格

2026-10-09，基于 master `154db720`（第七批 PR #389 已合并），继续使用同一
Node 20 原生依赖环境与全包统计范围。基线复用第七批完整覆盖率报告。

完整覆盖率运行耗时约 10 分 22 秒，共 208 个文件、1459 项测试：207 个文件、
1458 项通过，旧的 `bindings-ellipse` 测试触发 30 秒超时。新增测试全部通过，
原有及新增覆盖率门槛均满足。以下数据来自该完整报告，未用局部复跑结果替换统计。
保持代码和 30 秒时限不变，随后串行定向复跑 `bindings-ellipse` 通过：用例约 5 秒，
含 Jest 启动共约 19 秒。

| 范围 | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| --- | ---: | ---: |
| ECS 全包 | 69.07% → 69.53% | 56.76% → 57.20% |
| `TexturePool` | 64.10% → 97.80% | 51.72% → 93.33% |
| SVG 重栅格 | 24.70% → 97.91% | 12.50% → 96.15% |
| 雨滴纹理缓存 | 23.07% → 100% | 0% → 100% |

全包函数覆盖率由 69.68% 提升到 70.25%，已覆盖行净增 152 行，分支净增 76 个。
Coveralls master 的报告仍需等待合并后的 CI 上传。

新增 78 项单测，覆盖纹理池、SVG 重栅格、雨滴共享缓存及图片固有尺寸：

- 不同图片对象的 pattern 缓存隔离、同源复用、重复方式、创建失败重试和 destroy。
- 渐变与 pattern 各自最多保留 256 项，按最近使用顺序淘汰；不关闭调用方持有的图片。
- 渐变的小数参数、单位、半径关键字和导出 ID；透明线性渐变与底层颜色的合成。
- SVG 加载、Canvas 和 ImageBitmap 失败；相同任务去重、重置后旧任务的成功/失败回调。
- 请求尺寸变更、图形删除/失效、图片层删除/禁用/换源时的结果丢弃与位图释放。
- 跨图形共享 SVG 保留源图比例、晚到的小尺寸结果不降级缓存、4096 像素边长限制。
- 初始 1×1 占位无法提供比例时，按实际 SVG 尺寸栅格化；连续升级仍保留固有尺寸，
  不让 `none/scale-down` 因源位图分辨率提高而放大。
- 雨滴纹理并发请求合并、同步读取已就绪资源、失败重试、批量预加载去重及部分失败恢复。

这批修复了图片对象字符串化导致 pattern 串图、失败 pattern 绘成黑色、渐变缓存键
丢失小数/单位/关键字、线性渐变直接覆盖底层像素，以及 SVG 旧请求覆盖新请求、
按某个图形裁切后的结果污染共享源图缓存等问题。四份 SVG 导出快照仅更新渐变 ID，
已对比确认几何、颜色及其余导出内容不变。

定向单测及原生导出共 105 项通过。新增 1 个共享 SVG 的浏览器像素用例，复用已有
矩形/Path 图片回归；Chromium、WebKit 各 3 项通过，其中 WebKit 同时验证 3 倍 DPR。
TexturePool 使用原生 Canvas2D 像素和 API 边界断言；SVG 异步单测控制加载完成顺序，
在 Entity/浏览器资源边界使用小型替身，实际 ECS 和 GPU 行为由浏览器回归验证。
雨滴测试只替换解码边界，不依赖网络或固定延时。浏览器执行不计入 Jest 覆盖率。
全仓库 lint、新增/修改用例及其生产依赖的 TypeScript 检查、修改文件格式检查均通过。

## 第九批：设计变量与组继承属性同步

2026-10-09，基于 master `7cf90da4`（第八批 PR #390 已合并），继续使用相同
Node 20 原生依赖环境与完整统计范围。基线复用第八批完整覆盖率报告。

本批新增 64 项 Jest 行为测试：36 项真实 ECS/API 同步、24 项设计变量编辑与导出、
4 项继承链边界检查。测试检查实际组件与文档状态，覆盖：

-   组的填充、描边、线宽、端帽、连接样式、透明度与填充规则变化；显式空数组、
    禁用颜料、零值与子节点覆盖不被父组修改覆盖。
-   清除覆盖、移组、脱离组、非组中间节点、父子更新顺序，以及只修改父组的远端文档。
    撤销/重做和重新加载保持一致，子节点文档不写入继承值或多余版本变化。
-   继承变量在定义与亮暗主题变化后更新；主题偏好不进入文档历史。矢量图标子实体、
    粗糙填充几何与保留的虚线设置也随继承变化正确刷新。
-   字号、字体、字体变体、字距与行高在加载、定义修改和历史恢复时统一解析；
    删除数值变量后，字号、字距、行高、圆角与线宽恢复组件默认值，保留 `$token` 引用。
-   主题条目的匹配优先级、默认回退、只修改当前模式、类型转换，以及多层填充/描边
    的 resolved、preserve-token、css-var 导出；这些操作不修改原始定义和节点。

回归测试先复现 21 项组继承问题和 8 项文字/数值变量问题，再完成修复。继承刷新
现在集中在 API 的单次更新/批次完成处执行，设计变量批量刷新只在结束时统一传播一次组样式。
同时移除普通几何修改中不必要的继承图计算，修复 Path 加载时遗漏继承填充规则，
以及粗糙图形重建仍传旧 `fill` 字段导致填充丢失的问题。

Chromium 与 WebKit（iPhone 13 配置）各通过新增的 1 项像素回归，验证普通矩形和
粗糙矩形实际填充、Path（libtess）填充规则产生的孔洞、主题切换、清除覆盖与撤销重做。浏览器用例不计入 Jest 覆盖率。

完整覆盖率运行耗时 576.805 秒（约 9 分 37 秒），执行 211 个文件、1523 项测试：
210 个文件 / 1521 项通过；`api.batch.spec.ts` 的 2 项旧隔离测试仍用空对象作为
ECS 实体，在新增同步入口报错。更新该文件的组件写入替身后，定向复跑 3 项通过；
生产代码没有再修改，真实 ECS/API 的 36 项新增用例在完整运行中全部通过。
这里保留完整运行的覆盖率数据，没有将后续定向报告替换为全包覆盖率。

| 范围 | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| --- | ---: | ---: |
| ECS 全包 | 69.53% → 69.92% | 57.20% → 57.87% |
| 设计变量 | 70.53% → 96.32% | 53.27% → 88.28% |
| 组继承计算 | 88.23% → 91.17% | 76.92% → 87.17% |
| `ElementsChange` | 80.29% → 82.72% | 65.03% → 67.75% |
| `API` | 53.74% → 54.87% | 38.12% → 39.76% |

全包已覆盖行净增 122 行（19793 / 28308），函数覆盖率从 70.25% 提升到 70.76%；
设计变量模块函数覆盖率达到 100%。已有和新增覆盖率门槛均满足。全仓库 lint、
最终变更文件 lint、相关 TypeScript 检查与新增文件格式检查通过。
这些是本地 ECS 完整统计；Coveralls 需要合并后的 CI 上传才会更新。

## 第十批：粗糙图形与三维属性同步

2026-10-09，基于 master `b1c7e67c`（PR #391 / #392 已合并）。基线取该提交
成功的完整 ECS CI 报告：211 个文件、1523 项测试通过，行覆盖率 69.92%、
分支覆盖率 57.87%、函数覆盖率 70.76%。本轮继续使用 Node 20 原生依赖环境，
保留全部 ECS 源文件统计。

新增 51 项真实 ECS 行为测试，覆盖：

- 18 类粗糙参数的更新、清空、撤销重做与重新加载；零值、布尔值和虚线数组不丢失。
  曲线参数使用椭圆验证，比较实际 RoughJS 几何，不仅检查组件字段。
- 保持折线顶点、平移后粗糙线段的导出端点、dashed / zigzag-line 填充的默认间距，
  以及固定随机种子时仅改变填充不改变描边。
- 三维几何、深度、旋转、缩放与 camera3d 配置的存储同步；编辑后复用已有伴随实体，
  检查真实顶点、法线、索引、UV、材质与 Transform3D，比较文档重新加载结果。
- 11 类材质参数、整个材质对象的替换与移除，以及灯光颜色、强度、方向、位置、
  范围、锥角和类型的历史恢复；明确验证零强度和零材质系数。

修复了只改 Rough 参数未触发几何重算、preserveVertices 未传入生成器、虚线数组
误用数值组件、自动填充间距默认值错误，以及清空粗糙/三维字段仍保留旧值的问题。
三维加载与编辑共用 wire 转换函数，材质对象替换后不再遗留旧字段。

三维测试通过真实 EnsureMesh3DNodes / SyncMesh3DNodes 创建和更新伴随网格，
不启动 GPU、gizmo 或 glTF 网络加载；材质贴图断言仅验证 URL 状态，不冒充像素验证。
camera3d 仍是首次创建场景相机的配置，不是本批新增的实时相机控制接口。
所有新增 Jest 用例复用 ecs-document 显式帧推进，无固定等待。

完整运行 213 个文件、1574 项测试全部通过，耗时 645.869 秒（约 10 分 46 秒）。
现有门槛全部通过；依据同一完整报告为新转换模块和 ComputeRough 增加门槛，
并提高 ElementsChange 的门槛，逐项核对 21 个模块均满足新配置。

| 范围 | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| --- | ---: | ---: |
| ECS 全包 | 69.92% → 70.25% | 57.87% → 58.73% |
| `ElementsChange` | 82.72% → 92.03% | 67.75% → 85.10% |
| `ComputeRough` | 65.85% → 81.70% | 40.42% → 70.21% |
| `mesh3d-wire`（新模块） | 100% | 87.50% |

全包函数覆盖率从 70.76% 提升到 70.83%，行计数为 19864 / 28276。
共享三维转换减少了重复的加载/编辑代码；没有排除源文件或降低已有门槛。
这些是本地完整 ECS 数据，Coveralls master 需要合并后 CI 上传才会更新。

新增 1 项浏览器像素回归，验证粗糙参数编辑、撤销重做与重新加载；复用现有
组继承像素回归，Chromium 与 WebKit（iPhone 13 配置）各 2 项通过。
另定向验证了 Chromium 的 ECS / core miter 接缝用例，均通过；Chromium 共 4 项
耗时 50.7 秒，WebKit 共 2 项耗时 27.2 秒。浏览器执行不计入 Jest 覆盖率。
修改文件 lint、相关单测和浏览器 TypeScript 检查、新文件格式检查均通过。

## 第十一批：吸附组合交互与坐标精度

2026-10-09，基于 master `d7606f2d`（第十批 PR #393 已合并），继续使用相同
Node 20 原生依赖环境和全包统计范围，基线复用第十批完整覆盖率报告。

新增 36 项单测，使用真实 EventWriter、Select、Transformer、相机与历史系统：

- 鼠标、触摸、触控笔的吸附与逐像素脱离，0.5 / 1 / 2 倍相机缩放下的 CSS 像素阈值，
  像素网格与离网格参考组合、拖动时停用吸附、水平/垂直等距、隐藏/剔除/跨画布参考排除。
- 拖动过程中 pointercancel、Escape、切换工具后的单步历史；边、角、Shift 等比、
  节点锁定比例、Alt 中心缩放，以及顶部/左侧只吸附移动轴。
- 嵌套组缩放不重复变换或吸附自己的后代，多选边界的共同吸附和历史恢复，
  旋转边的对向中点固定，以及旋转/翻转父级下叶节点的移动与绕世界中心旋转。
- 部分相机位置、缩放、旋转和空 landmark 保留其余参数，坐标往返一致，
  只修改 zoom 时仍保持指定 viewport 锚点下的世界坐标。

完善事件工具以保留 jsdom MouseEvent 会截断的小数坐标后，测试复现了生产 Input /
InputPoint 的整数存储造成的 8 项交互偏差，以及部分相机参数的 3 项赋值错误。
指针位置与手势起点现使用 float64，避免经过相机、父级和 CSS 变换的小数被截断；
gotoLandmark 通过 createLandmark 显式读取相机默认值，不再展开 Becsy 组件的访问器对象。
修饰键通过 keyup 清理，帧和事件时钟仍显式推进，无固定延时。新增单测仅替换
GPU 设备与渲染系统，不将组件和几何断言当作 GPU 像素验证。

完整运行 214 个文件、1610 项测试，新增 36 项全部通过；213 个文件 / 1609 项通过，
旧的 `export.single.ellipse.spec.ts` 在并发构建期间超过 30 秒，完整运行耗时
809.48 秒。该导出用例在停止并发构建后原样单独复跑通过（用例 5.174 秒，
总计 16.879 秒），未修改断言或超时。下表保留这次全量报告，不以局部复跑覆盖统计。
现有 21 个模块的覆盖率门槛全部满足，没有排除源文件或降低门槛。

| 范围 | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| --- | ---: | ---: |
| ECS 全包 | 70.25% → 70.42% | 58.73% → 58.92% |
| `API` | 54.87% → 57.65% | 40.08% → 42.03% |
| `Select` | 74.17% → 74.31% | 70.12% → 70.38% |
| `CameraControl` | 52.27% → 57.57% | 48.64% → 48.64% |

全包函数覆盖率从 70.83% 提升到 70.99%；已覆盖行净增 50、分支净增 26、
函数净增 6，行计数为 19914 / 28275。API 移除一个无用局部变量，因此总行数减少 1。
这些是本地完整 ECS 报告数据；Coveralls master 在合并后由 CI 上传更新。

新增 2 项浏览器交互回归：CSS 放大画布上的半像素移动/缩放与撤销重做，以及
部分 landmark 和指定 viewport 锚点的缩放。Chromium 与 WebKit（iPhone 13 配置）
各 2 项通过；另有 5 项已有 Chromium 吸附组合回归通过。移动端用例显式添加
viewport 元数据，隔离页面默认缩放与画布 CSS 缩放。这些用例验证真实 DOM 指针
和几何状态，不是像素采样，也不计入 Jest 覆盖率。

修改文件 lint、单测及浏览器 TypeScript 检查、新文件格式检查均通过。
React 及依赖包构建通过。master React 19 的 `selection-edits` 用例出现
`Execution context was destroyed`，本地最新构建连续 3 次复跑通过；trace 未发现
实际重新导航，根因尚未确认，不能据此宣称 CI 已恢复。

## 配套：React CI 分片与诊断

2026-10-09，基于 master `251e1be5`（PR #394 已合并）。本批只调整测试与 CI，
不修改 ECS 运行时代码，也不宣称提高 Jest/Coveralls 覆盖率。

最新 PR #394 的 React 18 / 19 CI 中，选择测试已通过，英文和中文手机取点测试失败：
预期仍使用 `Math.trunc` 截断 viewport 坐标，与上一批 Input 保留小数的行为冲突。
测试现保留小数，并显式给画布设置小数 CSS 偏移，避免字体或布局偶然让它退化成
整数坐标用例；保持原有误差阈值与真实触摸事件。

成功的 PR #392 React CI 用时约 70 分钟，其中 Chromium 约 23–29 分钟，
随后串行运行的 WebKit 约 37–46 分钟。工作流现为每个 React 版本先执行单测、
构建、打包消费和类型检查，再复用构建产物启动 2 个 Chromium、3 个 WebKit 分片。
按用例均分，每台 runner 仍只有 1 个 worker；保留 WebKit 每用例独立浏览器。
React 18 / 19 各自的 367 项 Chromium 和 94 项 WebKit 用例都保留，tooling 校验
分片无遗漏、无重复且数量均衡。两个原有 `react (...)` 检查名保持不变，并要求
整个兼容矩阵成功；失败、取消和跳过均不能绕过门槛。

成功和失败的分片都上传 JSON、耗时明细及失败 trace/screenshot，保留 7 天。
React 交互测试在失败时附加最多 50 条浏览器生命周期事件，记录导航、上下文销毁、
关闭/崩溃、Vite 消息和资源错误；不依赖已经失效的页面上下文执行诊断。
旧的 React 19 选择测试上下文错误尚无稳定复现，不能把本地通过或分片视为根因修复。
实际流水线耗时需由新 PR 的 CI 测量；分片增加了并发 runner 与安装开销，构建产物
复用避免每个分片重复构建。

本地验证：21 项 tooling 检查通过；React 18 / 19 单测各 67 项通过，打包消费
检查通过（两版的 CommonJS/ESM SSR、类型和 Vite，以及 React 19 的 Next.js SSR）。
英文/中文手机取点在两版 React × 两种浏览器的 8 次执行全部通过；React 19 的
9 项选择测试分别在 Chromium 和 WebKit 通过，React 18 在两种浏览器各定向验证
2 项选择/异常恢复场景。另用 2 个临时故意失败用例验证重新导航与已关闭页面的
诊断附件及原始错误保留，验证后移除了临时用例。Actionlint、修改文件 ESLint /
Prettier 和浏览器 TypeScript 检查通过。

PR #395 的首次分片运行现已完成：包含排队与汇总检查的总耗时约 31 分 50 秒，
10 个浏览器分片中 9 个成功、1 个失败；922 项用例执行完整，921 项通过。
Chromium 分片测试阶段用时 8.9–14.0 分钟，WebKit 为 12.9–19.4 分钟；
所有浏览器 job（含安装和产物下载）在 10.1–21.3 分钟内完成。相较此前约
70 分钟的串行流水线，关键路径已缩短，但这次运行不能算全绿验收。

剩余失败仍是 React 19 的 native Escape 用例初始化时 `page.evaluate` 报执行
上下文销毁。新增附件确认当时页面未关闭、浏览器保持连接，只有初次加载时的
导航和 context-cleared 事件，没有随后导航、崩溃或 Vite 重载记录。当时本地
3 次强制 GC 诊断也均通过，尚未捕获原始协议错误，不能据此断定根因。

PR #396 再次在同一选择初始化步骤失败；ECS unit、Browser lifecycle regression、
React 18 的所有分片和 React 19 的其他分片均成功。随后本地保持原代码运行
native Escape 10 次，9 次通过、1 次在 `ready()` 初始化失败，捕获到 Chromium
`Runtime.callFunctionOn` 的原始错误 `-32000: Promise was collected`。
Playwright 1.55.1 将其改写成了同一条 execution-context/navigation 提示。

选择测试现在让页面内部记录异步初始化的完成状态，Playwright 只读取同步状态，
避免跨 CDP 等待初始化 Promise。仍逐一等待两个画布的编辑提交，保留独立的初始
取消选择与后续选择步骤；任一提交取消或拒绝都会明确失败。图层事件顺序、原生
Escape 的焦点归属、Shadow DOM 输入保护以及撤销/重做断言保持不变，也没有
增加重试或固定延迟。修改后同一用例连续执行 10 次全部通过，原始协议错误
未再次出现。React 19 的完整 9 项选择测试分别在 Chromium、WebKit 全部通过；
React 18 在两种浏览器各通过 native Escape 与失败/销毁场景，共 32 次修复后
浏览器执行全部成功。浏览器 TypeScript、修改文件 ESLint / Prettier、Markdown
lint 和 diff 检查通过。更新提交 `d82a2593` 的全部 CI 已通过，包括 React 18 / 19
的 10 个浏览器分片及汇总检查，PR #396 已合并。

这次提交的 unit 首次执行在 139 个测试文件通过后收到 runner shutdown 信号，
没有断言失败。未修改代码，重跑同一提交后 216 个 ECS 文件 / 1630 项测试，以及
5 个路径文本/SSR 文件 / 36 项测试全部通过。

最新 master `2a33faac` 的 unit 首次运行因 runner shutdown 信号中断，没有测试
断言失败；重新执行同一任务（attempt 2）后成功。

## 第十二批：glTF 缓存与异步加载

2026-10-09，基于 master `2a33faac`（React CI 分片 PR #395 已合并）。
沿用第十一批完整报告的 ECS 行覆盖率 70.42%、分支覆盖率 58.92%、函数覆盖率
70.99% 作为基线；#395 未改变 ECS 源码或 Jest 测试集合。

完整 ECS 测试 216 个文件、1630 项全部通过，耗时 835.17 秒（约 13 分 55 秒）。
已有 21 项模块门槛全部通过；增加 glTF 缓存与异步请求两项门槛，使用本次完整
报告复核 23 项均满足，没有排除源文件或降低已有门槛。

| 范围 | 行覆盖率（前 → 后） | 分支覆盖率（前 → 后） |
| --- | ---: | ---: |
| ECS 全包 | 70.42% → 70.72% | 58.92% → 59.32% |
| glTF 加载缓存 | 36% → 100% | 0% → 100% |
| glTF 异步请求 | 20% → 94.73% | 2.94% → 78.78% |
| `mesh3d-node` | 61.31% → 68.05% | 37.50% → 50.76% |

全包函数覆盖率从 70.99% 提升到 71.30%；已覆盖行净增 90、分支净增 61、函数
净增 14，行计数为 20004 / 28286。新增的两个 glTF 模块函数覆盖率均为 100%。
这些是本地完整报告；Coveralls master 的数字需等合并后由 CI 上传更新。

新增 20 项回归，只替换外部下载入口，运行真实 glTF accessor、烘焙、ECS 系统、
编辑 API 与历史。覆盖并修复：

- 同一 URL 的场景与 mesh 选项缓存隔离；并发请求共享结果，失败后可重新加载。
  清缓存后，旧请求的成功或失败不能替换、删除新请求。
- 下载中切换模型、改成普通几何体、删除后重建同名节点，以及多画布使用同名节点。
  旧模型的失败回调不再清除新模型的就绪标记，避免后续属性编辑使模型短暂消失。
- glTF 导入的颜色和纹理在帧同步、位置修改、清除材质覆盖、undo/redo 与文档重载后
  保持正确。默认材质按几何版本缓存为运行时数据，不写入文档属性。
- 自动重试系统声明 `isEntityAlive` 所需的 Camera 读取权限，避免权限异常被误判为
  实体失效。临时失败从 1 秒开始指数退避，最大间隔 30 秒；换模型不继承旧模型的
  等待时间。测试控制时钟并显式推进帧，不实际等待重试间隔。

测试边界：验证外部加载返回结果之后的烘焙与生命周期，不替代 loaders.gl 网络、
Draco 解码或 GPU 像素验证；已有 Duck 文件烘焙和三维属性同步回归一并执行。

## 覆盖率门槛与报告

`jest.ecs.config.js` 为已建立回归基线的模块设置独立门槛，`pnpm test:ecs` 会检查：

| 模块                               |   行 | 分支 | 函数 | 语句 |
| ---------------------------------- | ---: | ---: | ---: | ---: |
| `utils/gizmo-frame.ts` | 100% | 90% | 100% | 95% |
| `systems/pick3d/gizmo-pointer.ts` | 100% | 90% | 100% | 95% |
| `systems/Pick3D.ts` | 90% | 70% | 95% | 85% |
| `systems/pick3d/gizmo-gesture.ts` | 100% | 80% | 100% | 95% |
| `systems/pick3d/gizmo-session.ts` | 100% | 95% | 100% | 100% |
| `systems/EnsureExtrudeMeshes.ts` | 90% | 60% | 100% | 90% |
| `systems/EnsureMesh3DNodes.ts` | 95% | 75% | 100% | 95% |
| `systems/SyncMesh3DNodes.ts` | 90% | 80% | 100% | 90% |
| `systems/SyncExtrude3D.ts` | 95% | 90% | 100% | 95% |
| `utils/gltf/load-gltf-mesh.ts` | 100% | 100% | 100% | 100% |
| `utils/gltf/request-gltf-mesh-load.ts` | 90% | 75% | 100% | 90% |
| `utils/mesh3d-wire.ts` | 100% | 85% | 100% | 100% |
| `systems/ComputeRough.ts` | 80% | 65% | 100% | 80% |
| `utils/design-variables.ts`     | 90% | 85% | 100% | 90% |
| `utils/inherit-group-wire.ts`   | 85% | 80% | 100% | 85% |
| `resources/TexturePool.ts`         | 95% | 85% | 100% | 95% |
| `utils/fillImageSvgReraster.ts`     | 95% | 90% | 100% | 95% |
| `utils/rain-drop-texture-cache.ts` | 100% | 100% | 100% | 100% |
| `systems/Select.ts`                | 70% | 65% | 75% | 70% |
| `systems/RenderTransformer.ts`     | 65% | 60% | 75% | 65% |
| `utils/snapping.ts`                |  98% |  95% | 100% |  98% |
| `utils/transformer-resize.ts`      | 100% | 100% | 100% | 100% |
| `systems/select/resize-gesture.ts` | 100% |  90% | 100% | 100% |
| `systems/select/rotate-gesture.ts` | 100% |  85% | 100% |  95% |
| `history/Snapshot.ts`              | 100% |  90% | 100% | 100% |
| `history/ElementsChange.ts`        | 90% | 80% | 90% | 90% |
| `utils/solidShapeRasterForFilter.ts` | 90% | 75% | 100% | 90% |
| `utils/render-cache.ts`            | 100% | 85% | 100% | 100% |
| `utils/cube-lut-cache.ts`           | 100% | 100% | 100% | 100% |
| `utils/glyph/glyph-manager.ts`     | 100% | 90% | 100% | 100% |
| `utils/fill-layer-image-url-raster.ts` | 95% | 95% | 80% | 95% |
| `systems/BatchManager.ts`          | 98% | 90% | 98% | 98% |

其余模块仍计入全包统计。后续批次补齐行为测试后再增加对应门槛；不因新增代码
降低已有门槛。吸附中的大场景候选数量上限分支暂未覆盖。

完整测试及覆盖率报告：

```sh
pnpm test:ecs --maxWorkers=2
```

只验证历史与文档行为，不计算全包覆盖率：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/history-document.spec.ts \
  __tests__/ecs/history-delta.spec.ts
```

只验证选择交互，不计算全包覆盖率：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/select.interaction.spec.ts \
  __tests__/ecs/select.vector-interaction.spec.ts \
  __tests__/ecs/select.crop-hierarchy.spec.ts
```

Jest 输出 `coverage/coverage-summary.json` 和原有 LCOV 等报告。CI 的 `ecs-coverage`
artifact 保留 JSON 摘要和 LCOV 14 天，成功与失败的已完成运行均可下载。
原生依赖与 Linux 虚拟显示配置见 [运行 ECS 测试](./running-ecs-tests.md)。

只验证第四批栅格化和资源生命周期：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/filter-raster.spec.ts \
  __tests__/ecs/render-cache.spec.ts \
  __tests__/ecs/cube-lut-cache.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts filter-raster.spec.ts
```

只验证第五批 atlas、图片缓存和批次生命周期：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/glyph-manager.lifecycle.spec.ts \
  __tests__/ecs/fill-layer-image-cache.spec.ts \
  __tests__/ecs/batch.transitions.spec.ts
```

对应的现有 Chromium 回归（12 项，未新增浏览器用例）：

```sh
pnpm exec playwright test -c playwright.browser.config.ts \
  ecs-text.spec.ts image-fill.spec.ts ecs-blend-mode.spec.ts \
  --grep 'Gaegu|reuses glyphs|refresh the atlas|renders migrated|blending matches|text participates|parent clipping|WebGL1 fallback|three translucent'
```

只验证第六批属性同步，以及对应的现有 Chromium 回归：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/history-property-sync.spec.ts \
  __tests__/ecs/history-document.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts \
  icon-resize.spec.ts ecs-text.spec.ts filter-raster.spec.ts \
  --grep 'resizes from corner|Gaegu|reuses glyphs|refresh the atlas|filter rasters'
```

只验证第八批纹理缓存与 SVG 重栅格，以及对应的浏览器回归：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/texture-pool.spec.ts \
  __tests__/ecs/fill-image-svg-reraster.spec.ts \
  __tests__/ecs/rain-drop-texture-cache.spec.ts \
  __tests__/ecs/fill-layer-image-cache.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts image-fill.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts image-fill.spec.ts
```

只验证第九批设计变量与组继承，以及浏览器像素回归：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/history-inheritance-sync.spec.ts \
  __tests__/ecs/design-variable-editing.spec.ts \
  __tests__/ecs/inherit-group-wire.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts group-inheritance.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts group-inheritance.spec.ts
```

只验证第十批粗糙图形与三维属性，以及相关浏览器像素回归：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/history-rough-sync.spec.ts \
  __tests__/ecs/history-3d-sync.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts rough-properties.spec.ts group-inheritance.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts rough-properties.spec.ts group-inheritance.spec.ts
```

只验证第十一批吸附交互与坐标精度：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/select.snapping-interaction.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts interaction-precision.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts interaction-precision.spec.ts
```

只验证第十二批 glTF 加载与已有三维属性回归：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/gltf-load-cache.spec.ts \
  __tests__/ecs/gltf-loading-lifecycle.spec.ts \
  __tests__/ecs/history-3d-sync.spec.ts \
  __tests__/ecs/gltf-duck.spec.ts \
  __tests__/ecs/mesh3d-geometry.spec.ts \
  __tests__/ecs/renderer3d-schedule.spec.ts
```

## 第十三批：三维伴生网格同步与权限

2026-10-10，基于 master `da2480a4`（PR #396 已合并），沿用完整 ECS 报告的
行覆盖率 70.72%、分支覆盖率 59.32%、函数覆盖率 71.30% 为基线。

新增 `companion3d-sync.spec.ts` 的 16 项行为回归，运行真实创建、同步、边界与
删除系统，通过显式 ECS 帧推进；不模拟组件访问权限，也不分配 GPU 渲染器。
测试先让创建阶段的写入稳定，再修改变换，避免创建系统的额外同步掩盖每帧同步
系统没有执行的问题。

确认并修复的问题：

- `SyncMesh3DNodes` 的存活探测缺少 `Camera` 读取权限，访问错误被当成实体已
  删除，导致同步直接跳过；同时缺少场景归属读取和变换、材质写入权限。
- `EnsureExtrudeMeshes` 缺少场景相机读取及伴生组件写入声明；`SyncExtrude3D`
  同样缺少存活探测权限。补齐实际访问，并收窄只读取的组件权限。
- 拖拽期间写回的 `Mesh3DNode` 会再次触发创建系统，下一帧用旧位置覆盖 gizmo
  的新位置。创建系统在拖拽时只同步材质，保留 gizmo 持有的姿态，松手后恢复
  正常的源节点到网格同步。
- 替换挤出伴生网格后，旧网格只检查源节点仍有 `Extrude3D`，没有核对反向引用，
  因此无法清理。现在仅保留源节点当前引用的网格。

回归覆盖独立变换写入、连续拖拽、均匀/非均匀缩放、拖拽中的材质修改、松手后的
同步、已有模型选中、多画布隔离、挤出尺寸/深度/填充变化、空边界恢复、旧 Y-up
坐标模式、删除源节点、替换伴生网格以及伴生网格丢失后的单次重建。
原有 glTF 加载和三维历史测试继续验证导入材质、场景切换及文档属性恢复。

完整原生 ECS 测试通过：217 个文件、1646 项测试，用时约 12 分 20 秒。
整体行覆盖率从 70.72%（20004/28286）提升到 71.12%（20120/28288），
语句覆盖率从 70.70% 提升到 71.08%，分支覆盖率从 59.32% 提升到 59.79%，
函数覆盖率从 71.30% 提升到 71.46%。所有 ECS 源文件继续计入统计。

| 模块 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| --- | --- | --- | --- |
| `EnsureExtrudeMeshes.ts` | 93.33% | 64.70% | 100% |
| `EnsureMesh3DNodes.ts` | 95.00% | 78.57% | 100% |
| `SyncMesh3DNodes.ts` | 93.75% | 84.61% | 100% |
| `SyncExtrude3D.ts` | 97.36% | 91.66% | 100% |
| `utils/mesh3d-node.ts` | 81.25% | 64.61% | 83.33% |

为四个伴生系统增加覆盖率门槛，逐模块门槛从 23 项增加到 27 项；使用本次完整
报告复核全部门槛。ECS 与 device-api 的 CommonJS/ESM 构建、仓库 ESLint、
新增测试的 TypeScript 检查，以及改动文件的格式检查均通过。

只验证本批及相关三维同步回归：

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/companion3d-sync.spec.ts \
  __tests__/ecs/history-3d-sync.spec.ts \
  __tests__/ecs/gltf-loading-lifecycle.spec.ts \
  __tests__/ecs/renderer3d-schedule.spec.ts
```

这里验证的是 ECS 组件同步；`Pick3D` 的真实指针事件、拖拽后序列化文档的提交与
撤销、嵌套父级下的世界坐标到局部坐标换算，仍需下一批单独验证。

## 第十四批：gizmo 手势会话与文档提交

2026-10-10，基于 master `0e6de421`（PR #398 已合并）。先重构输入和状态提交，
将 `Pick3D` 从 633 行拆为 436 行调度代码与三个可独立验证的模块：

- `systems/pick3d/gizmo-gesture.ts`：固定起始姿态与约束平面，计算移动和局部轴
  旋转；连续旋转跨越 ±π 时累计相邻采样的角度差。
- `systems/pick3d/gizmo-ray.ts`：隔离普通相机与 linked 相机的指针射线转换。
- `systems/pick3d/gizmo-session.ts`：持有一次手势的预览、取消还原和最终文档提交。
  临时状态按画布 API 隔离；保留原有导出拖拽状态 API 的兼容调用。

真实事件回归先复现了拖拽未写回文档、松手丢失最后一段移动，以及
`pointercancel` 后没有还原的问题。现在一帧内的 down/move/up 按采样顺序处理，
先应用 release 坐标再提交一次历史；点击但未移动不修改版本或增加撤销记录。
Escape、指针取消、离开画布及切换工具恢复初始姿态，后续旧 release 不再提交。

其他修复包括：API 通过实体身份识别 held 引用；世界坐标中的模型中心通过父级
逆矩阵与自身旋转/缩放换算回局部原点；正视正交相机下的 X/Y 轴不再使用与射线
平行的固定平面；已旋转模型的操作使用局部旋转矩阵组合，而非直接累加单个
Euler 分量。奇异父级矩阵保留原姿态。

浏览器还复现了选中三维模型后 hover 读取不存在的二维 Transformer 锚点异常。
二维框的创建与命中现在共用相同的抑制条件。`Pick3D` 的预览写入明确排在
相机/边界计算和 `Select` 之后，避免新的 Transform 写权限触发隐式调度环。

新增 17 项真实 DOM 指针/ECS 帧测试与 8 项手势数学测试，覆盖提交、一次撤销、
重做、重新加载、触屏/笔事件、单帧完整手势、取消、多画布并行拖拽、源节点删除、
正交移动、旋转、父级旋转/翻转及奇异矩阵。另增加两项完整三维插件的浏览器
回归，纳入 Chromium 与 WebKit CI。

完整原生 ECS 测试通过：219 个文件、1671 项测试，用时约 13 分 48 秒。
整体行覆盖率从 71.12%（20120/28288）提升到 72.61%（20568/28326），
语句覆盖率从 71.08% 提升到 72.56%，分支覆盖率从 59.79% 提升到 61.13%，
函数覆盖率从 71.46% 提升到 72.84%。所有 ECS 源文件继续计入统计。

| 模块 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| --- | --- | --- | --- |
| `Pick3D.ts` | 91.21% | 70.93% | 96.15% |
| `pick3d/gizmo-gesture.ts` | 100% | 84.84% | 100% |
| `pick3d/gizmo-session.ts` | 100% | 97.67% | 100% |
| `pick3d/gizmo-ray.ts` | 88.88% | 33.33% | 100% |
| `utils/pick3d-bridge.ts` | 100% | 81.81% | 100% |

为 `Pick3D`、手势数学及会话模块增加门槛，逐模块门槛从 27 项增加到 30 项，
使用完整报告复核全部门槛。全量运行期间加强了正交相机测试，直接修改运行时
`Camera3D` 并断言实际投影；最终版本的 17 项生命周期测试另行运行通过。
上表保留完整运行生成的覆盖率，未合并该补充运行的数据。

Chromium 通过本批 2 项与原有 Transformer 光标 16 项浏览器回归；WebKit 通过
本批 2 项。ECS 与 device-api 的 CommonJS/ESM 构建、仓库 ESLint、浏览器与
新增测试的 TypeScript 检查、21 项 tooling 测试及改动文件格式检查均通过。
完整 Jest 运行退出码为 0，但仍报告一个 worker 未正常退出的清理警告，未将其
当成通过的清理验证；后续需独立定位未释放的资源。

PR #399 的首次远端 unit 运行在 154 个文件通过后收到 runner shutdown signal，
没有测试断言失败。master 与 PR #398 的近期中断也包含同一信号；日志没有提供
机器关停原因，因此不能据此认定远端发生 OOM。

按远端的 3 个 worker 进行本地内存诊断，72 个文件通过时采样峰值已达
11.41 GiB，随后主动停止该诊断。CI 配置现在限制为 2 个 worker，并通过
`workerIdleMemoryLimit: '256MB'` 在文件结束后回收超出 JS 堆阈值的进程，
同时释放该进程持有的原生渲染资源。该阈值约束的是 JS 堆，不是整个进程 RSS，
也不会中断正在执行的测试。覆盖率统计范围和全部 30 个门槛保持不变。
8 GiB 隔离验证中，512 MB 的 JS 堆阈值仍触发了内核 OOM 计数，因此采用更低的
256 MB 阈值；仅观察 JS 堆不足以判断原生资源占用是否安全。

本批重点为声明式 `mesh3d` 的输入、预览与提交。尚未增加 scale 手柄，也未重写
linked perspective 的 Z 轴屏幕偏移或挤出图形的三维编辑映射；GPU 资源管理仍在
`RenderGizmo3D` 中。后续分批推进，避免在生命周期修复中混入新的渲染模型。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/gizmo-gesture.spec.ts \
  __tests__/ecs/gizmo-lifecycle.spec.ts \
  __tests__/ecs/companion3d-sync.spec.ts \
  __tests__/ecs/history-3d-sync.spec.ts \
  __tests__/ecs/renderer3d-schedule.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts gizmo.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts gizmo.spec.ts
```

## 第十五批：gizmo 投影、命中与拖拽一致性

2026-10-10，基于 master `82cd42b5`（PR #399 已合并）。沿用上一批最终完整
运行的行覆盖率 73.01%、分支覆盖率 61.35%、函数覆盖率 72.99% 作为基线。

真实指针测试先复现 linked Z 轴拖动 20 个世界单位仅移动约 9.65 的问题。
原先渲染使用按对象锚点计算的 linked 投影和人为 Z 屏幕偏移，拖拽却将其当作
普通透视相机射线；相机缩放与正深度组合还会改变手柄大小和命中位置。

- `utils/gizmo-frame.ts` 统一渲染、拾取与手势的投影描述，使用逻辑 CSS 像素
  计算尺寸和 Z 偏移。非正方形画布不再按 NDC 距离错误缩放斜向 Z 轴；普通
  相机通过相机右向量的实际投影计算尺寸，覆盖倾斜、偏轴与正交场景。
- `pick3d/gizmo-pointer.ts` 替换原 `gizmo-ray.ts`。普通相机保持逆矩阵射线；
  linked 单轴拖动沿显示轴换算，平面移动和局部旋转在约束平面上反解实际投影。
  退化或无法求解的采样不写入姿态；每次手势固定起始投影，避免预览反馈改变灵敏度。
- XZ／YZ 平面共享 Z 轴屏幕偏移；同一 gizmo 内的手柄命中使用与绘制一致的优先级。
- 缩放场景进一步复现二维选中抢占：手柄落在图形二维边界内时，`Select` 重新
  选中节点会先移除 `Selected3D`，导致后续 `Pick3D` 无法开始手势。现在可见
  gizmo 手柄优先接收按下，保留原选择和文档历史。

新增 19 项投影/约束数学测试，以及 6 项真实 DOM/ECS 手势测试。覆盖画布宽高比、
缩放、相机旋转、正负深度、倾斜标准相机、局部旋转环、三个平面、不跳变按下、
退化投影和撤销。浏览器新增独立 GPU 像素定位与实际拖动测试，包含 DPR 2 和
箭头覆盖旋转环；浏览器结果不计入 Jest/Coveralls 覆盖率。

完整原生 ECS 测试通过：220 个文件、1696 项测试，用时 822.974 秒（约 13 分 43 秒）。
在 8 GiB 容器中沿用 CI 配置运行，没有 worker 异常退出警告。完整报告复核全部
32 项门槛；新模块门槛另以独立投影测试验证。

| 指标 | 前 | 后 |
| --- | ---: | ---: |
| 行覆盖率 | 73.01%（20683/28326） | 73.12%（20784/28424） |
| 语句覆盖率 | 72.99% | 73.10% |
| 分支覆盖率 | 61.35% | 61.48% |
| 函数覆盖率 | 72.99% | 73.09% |

新投影模块的行/函数覆盖率均为 100%，分支覆盖率为 95%；指针映射模块的
行/函数覆盖率均为 100%，分支覆盖率为 91.66%。Chromium 与 WebKit 各 6 项
浏览器用例通过；ECS 和 device-api 的 CommonJS/ESM 构建、仓库 ESLint、
浏览器及新增 ECS 测试的 TypeScript 检查、21 项 tooling 检查、改动的格式与
Markdown 检查均通过。WebKit 使用本地补齐的动态库运行；CI 继续通过
`playwright install --with-deps` 安装，不加入跳过浏览器测试的配置。

新增投影和指针映射两个模块门槛，逐模块门槛由 30 项增加至 32 项；已有门槛、
统计范围，以及 CI 的两个 worker / 256 MB 回收阈值保持不变。

本批没有增加 scale 手柄、挤出源图形的三维编辑映射或 GPU 资源拆分。手势期间
的相机变更、外部文档编辑冲突仍需单独定义中断策略。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/gizmo-projection.spec.ts \
  __tests__/ecs/gizmo-gesture.spec.ts \
  __tests__/ecs/gizmo-lifecycle.spec.ts \
  __tests__/ecs/renderer3d-schedule.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts gizmo.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts gizmo.spec.ts
```

## 第十六批：gizmo GPU 资源与画布生命周期

2026-10-10，基于 master `5a4116f4`（PR #400 已合并），以上一批完整运行的
行覆盖率 73.12%、分支覆盖率 61.48%、函数覆盖率 73.09% 为基线。

- `RenderGizmo3D` 保留 ECS 选择、相机和画布适配；`gizmo3d/gizmo-uniforms.ts`
  统一 legacy uniform 与 std140 数据，`gizmo3d/gizmo-resources.ts` 管理绘制和
  GPU 资源。手柄几何在同一画布内共享，uniform buffer 和 binding 按对象及手柄
  分配，避免延迟提交时多选对象的姿态、高亮和锚点被最后一个对象覆盖。
- 资源挂入画布 `GPUResource.scope`，先于缓存和设备销毁。取消选择会释放对应
  对象的 buffer/binding；几何保留供下次使用。设备、缓存或作用域任一身份变化
  都会重建资源；中途分配失败会回收已分配的部分，单次清理抛错仍继续释放其余资源。
  program、input layout 和 pipeline 的所有权留在 `RenderCache`。
- 删除全局 gizmo 单例，改用 owning World 内的系统 attachment；二维合成器按
  画布解析三维 renderer，注册从构造函数移到系统 initialize，再逐帧同步画布归属。
  未初始化的第二个 World 不会覆盖正在绘制的 renderer。

新增 24 项单元测试，验证多选延迟提交后的实际 buffer 内容、几何复用、取消选择、
部分分配失败、重复销毁、清理失败继续释放、设备/缓存/作用域替换及画布注册归属。
资源测试使用真实 `RenderCache` 和 `ResourceScope` 配合可观察的 Device；生命周期
单测控制 query 快照，真实 ECS 访问权限和调度另由浏览器及调度测试验证。

新增两项浏览器回归：同一 World 双画布独立绘制，销毁其中一个后继续编辑另一个，
退出并重建 App；并发创建第二个 World 被拒绝后，第一个 World 仍可正常绘制。
Becsy 仍不支持多个 World 同时共享组件类型，本批验证的是失败隔离和顺序重建。
Chromium 与 WebKit 各通过本批 2 项和已有 6 项 gizmo 用例。

完整原生 ECS 运行通过 223 个文件、1720 项测试，用时 747.718 秒（约 12 分 28 秒）。
在 8 GiB 容器内沿用 CI 的两个 worker / 256 MB 回收阈值运行，退出码为 0，
没有 worker 异常退出警告。使用本次完整报告复核全部门槛：新增上述四个模块，
逐模块门槛从 32 项增加到 36 项，既有门槛与统计范围保持不变。

| 指标 | 前 | 后 |
| --- | ---: | ---: |
| 行覆盖率 | 73.12%（20784/28424） | 73.55%（20920/28440） |
| 语句覆盖率 | 73.10% | 73.56% |
| 分支覆盖率 | 61.48% | 61.76% |
| 函数覆盖率 | 73.09% | 73.48% |

资源、uniform 和 renderer 注册模块的四项覆盖率均为 100%。`RenderGizmo3D`
行覆盖率为 98.48%、语句 97.46%、分支 77.5%、函数 88.88%；linked camera
与真实像素行为另有浏览器回归，这些结果不计入 Jest/Coveralls。

ECS 和 device-api 的 CommonJS/ESM 构建、仓库 ESLint、浏览器与新增 ECS 测试的
TypeScript 检查、21 项 tooling 测试及格式/Markdown 检查均通过。浏览器仍使用
WebGL；延迟提交的 buffer 测试验证数据所有权，不代替原生 WebGPU 验收。

本批未重写 MeshPipeline3D 的网格缓存，也未增加 scale 手柄、挤出编辑映射或
活动手势冲突策略。GPU 资源数量随选中对象数量增长；重复帧复用现有分配，取消
选择时释放对象专属资源。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/gizmo-resources.spec.ts \
  __tests__/ecs/gizmo-renderer-lifecycle.spec.ts \
  __tests__/ecs/mesh3d-bridge.spec.ts \
  __tests__/ecs/renderer.lifecycle.spec.ts \
  __tests__/ecs/renderer3d-schedule.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts gizmo
pnpm exec playwright test -c playwright.webkit.config.ts gizmo
```

## 第十七批：挤出矩形的 gizmo 编辑映射

2026-10-10，基于 master `f38b980a`（PR #401 已合并），以上一批完整运行的
行覆盖率 73.55%、分支覆盖率 61.76%、函数覆盖率 73.48% 为基线。

- `pick3d/gizmo-source.ts` 从会话中拆出源节点绑定，分别处理声明式网格和挤出
  矩形的运行时预览、恢复及文档补丁；会话继续独立管理指针与一次历史提交。
- `extrude3d` 保留布尔值和数值写法，新增 `{ depth, z, rotation }`。XY 位移写回
  源矩形的父局部坐标；Z 位移只改变高度偏移，保留厚度；旋转写入相对于源图形
  世界二维旋转的局部 XYZ 欧拉角。网格中心深度为 `z - depth / 2`。
- 挤出同步在手势期间保留预览，选择状态同步到伴生网格；伴生实体移除后清除
  三维选中标记，允许继续使用二维选框。二维选框和高亮不再
  抢占挤出 gizmo。拖动中关闭挤出或替换伴生网格时，从当前文档恢复源位置，
  不写回已失效的伴生实体，也不重新启用已关闭的挤出。
- 浏览器重载测试发现清空三维选择时，二维选框可能在变换计算后首次创建，
  导致当帧绘制读取缺失的 `GlobalTransform`。三个选框创建入口现在立即初始化
  变换，保留原有创建时机，兼容先绘制线条再进入编辑的二维流程。

新增 15 项真实 DOM/ECS 交互测试和 19 项配置/坐标计算测试。覆盖鼠标、触屏和笔、
提交事件次数、取消及滞后释放、撤销/重做/重新载入、正交相机、父级旋转/翻转/
非均匀缩放、局部三维旋转、欧拉角奇异点、非法输入、API 选择，以及源节点删除、
关闭挤出和伴生实体替换。数学测试比较组合矩阵，避免要求同一旋转只有一种欧拉角表示。

新增四项 Chromium/WebKit 回归，验证 XY 预览/提交及箭头像素、Escape 取消、
Z 位移保持厚度、清空后重新载入文档，以及关闭挤出后继续二维缩放。浏览器使用 WebGL，不计入 Jest 覆盖率。

完整原生 ECS 运行通过 225 个文件、1754 项测试，用时 873.117 秒（约 14 分 33 秒）。
在 8 GiB 容器中沿用 CI 的两个 worker / 256 MB 回收阈值，退出码为 0，
没有 worker 异常退出警告。完整报告满足全部 36 项既有门槛；为源绑定、父坐标
映射、挤出姿态映射与挤出配置增加四项门槛后，使用同一报告复核全部 40 项。
统计范围和既有门槛保持不变。

| 指标       |                    前 |                    后 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 73.55%（20920/28440） | 73.65%（21020/28538） |
| 语句覆盖率 |                73.56% |                73.65% |
| 分支覆盖率 |                61.76% |                61.97% |
| 函数覆盖率 |                73.48% |                73.59% |

| 模块                            | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| ------------------------------- | -------: | ---------: | ---------: |
| `pick3d/gizmo-session.ts`       |     100% |       100% |       100% |
| `pick3d/gizmo-source.ts`        |   98.18% |      72.5% |       100% |
| `utils/canvas-source-origin.ts` |     100% |     76.92% |       100% |
| `utils/extrude3d-transform.ts`  |     100% |       100% |       100% |
| `utils/extrude3d.ts`            |   93.93% |     94.73% |       100% |

Chromium 与 WebKit 各 12 项 gizmo 用例完整通过。二维缩放用例在按下、移动和
松开之间使用已有 ECS 帧推进工具，确保每个阶段被 ECS 处理后再继续，
没有增加固定延时或放宽尺寸断言。ECS 与 device-api 的 CommonJS/ESM 构建、
仓库 ESLint、浏览器与新增 ECS 测试的 TypeScript 检查、21 项 tooling 检查、
新模块/测试格式检查及 Markdown 检查均通过。

本批保留现有挤出网格基于世界 AABB 的尺寸计算，未新增精确旋转/剪切底面几何或
scale 手柄；相机变更与外部姿态编辑的通用冲突策略仍留待下一批定义。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/extrude-gizmo.spec.ts \
  __tests__/ecs/extrude-transform.spec.ts \
  __tests__/ecs/gizmo-lifecycle.spec.ts \
  __tests__/ecs/companion3d-sync.spec.ts \
  __tests__/ecs/history-3d-sync.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts gizmo
pnpm exec playwright test -c playwright.webkit.config.ts gizmo
```

## 第十八批：三维同步去重与活动手势中断

2026-10-10，基于 master `f688d545`（PR #402 已合并），以上一批完整运行的
行覆盖率 73.65%、分支覆盖率 61.97%、函数覆盖率 73.59% 为基线。

- `utils/sync3d.ts` 比较派生值后再写入 `Transform3D` / `Material3D`，源位置
  与 Z 值按 float32 存储精度比较，避免小数转换导致每帧重复写入。
- 参数化网格按 CPU 位置数组和几何配置缓存。位置、旋转和材质编辑复用这些数据，
  几何配置变化独立触发重建；弱引用键不依赖 Becsy 的实体包装对象。
- 相同的 gizmo hover 状态不再重复写 `Selected3D`，相同三维选择状态不再
  请求二维选框刷新。测试通过 ECS 的 `changed.trackWrites` 观察真实写入，
  验证稳定后的五个连续帧没有伴生变换、材质或几何写入。
- `pick3d/gizmo-context.ts` 比较视口、实际拾取投影及源/祖先文档空间属性。
  相机移除、视图或画布尺寸变化、外部姿态/几何编辑及撤销会中断当前手势，
  从当前文档恢复，忽略旧释放事件。名称和材质等无关编辑允许与拖动合并，
  其他画布的变化不会中断当前手势。
- 画布归属通过 `isSame` 比较实体身份。`Pick3D` 在使用时读取相机组件，
  避免中断检查重新绑定组件后继续访问失效的组件视图。

新增 32 项网格/挤出手势回归、7 项同步写入量/缓存/刷新测试，以及四项浏览器
中断后重新拖动测试。Chromium 与 WebKit 各 16 项 gizmo 用例全部通过，
包括既有投影像素、撤销重做和多画布生命周期检查。浏览器使用 WebGL，
不计入 Jest 覆盖率。

完整原生 ECS 运行通过 226 个文件、1793 项测试，用时 877.092 秒（约 14 分 37 秒），
退出码为 0，没有 worker 异常退出警告。沿用 CI 的两个 worker / 256 MB 回收阈值和 8 GiB 容器限制。全部 40 项原有门槛
保持不变，新增中断上下文和同步工具两项门槛，完整报告满足全部 42 项。
统计范围仍包含所有 ECS 源文件。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 73.65% | 73.69%（21069/28590） |
| 语句覆盖率 | 73.65% | 73.68%（22065/29944） |
| 分支覆盖率 | 61.97% |  62.15%（8730/14045） |
| 函数覆盖率 | 73.59% |   73.66%（2819/3827） |

| 模块                              | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| --------------------------------- | -------: | ---------: | ---------: |
| `systems/pick3d/gizmo-context.ts` |     100% |     88.46% |       100% |
| `systems/pick3d/gizmo-session.ts` |     100% |       100% |       100% |
| `systems/pick3d/gizmo-source.ts`  |   96.82% |     72.54% |       100% |
| `utils/sync3d.ts`                 |     100% |       100% |       100% |
| `systems/SyncExtrude3D.ts`        |   97.14% |     91.66% |       100% |
| `systems/SyncMesh3DNodes.ts`      |   93.75% |     84.61% |       100% |

ECS CommonJS/ESM 构建、仓库 ESLint、浏览器与新增 ECS 测试的 TypeScript 检查、
格式检查、22 项 tooling 检查和 Markdown 检查均通过。

### WebKit CI 分片

复查 [PR #402 的 WebKit other 任务](https://github.com/xiaoiver/infinite-canvas-tutorial/actions/runs/38034060919/job/114160741914)
发现，该组超过 25 分钟任务上限后被取消，导致汇总门禁失败；取消前已完成的用例
均通过。本批将非 Lottie WebKit 测试拆成三个独立单 worker 分片，Lottie 继续独立
运行。保留原有超时、浏览器隔离、测试断言及必需门禁；失败、取消、跳过仍会让
门禁失败。tooling 检查实际 Playwright 测试发现结果，确保各组覆盖完整且没有重复。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/gizmo-invalidation.spec.ts \
  __tests__/ecs/companion3d-sync.spec.ts \
  __tests__/ecs/gizmo-lifecycle.spec.ts \
  __tests__/ecs/extrude-gizmo.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts gizmo
pnpm exec playwright test -c playwright.webkit.config.ts gizmo
pnpm test:tooling
```

## 第十九批：三维网格 GPU 缓存与资源所有权

2026-10-11，基于 master `2356d25d`（PR #404 已合并），以上一批完整运行的
行覆盖率 73.69%、分支覆盖率 62.15%、函数覆盖率 73.66% 为基线。

- 抽出 `mesh3d/mesh-gpu-cache.ts`：位姿和材质编辑复用网格缓冲，仅 `Mesh3D`
  写入使几何缓存失效。多次写入合并为下一次绘制的一次上传，未绘制帧保留更新标记。
- 缓存检查移到伴生同步和 `Pick3D` 之后、最终绘制之前，真实 ECS 回归验证
  `entity.write(Mesh3D)` 后原地修改位置数组在当帧上传。
- 每个画布独立拥有网格缓存、模型和场景 uniform；实体以 ID 去重，避免同一
  挤出伴生的 held 包装对象重复绘制。共享 device 的两个画布也有独立 uniform。
- 删除、待删除、清空几何、移除材质和跨画布移动均会回收旧网格缓冲，即使后续
  不再绘制。更换 device、RenderCache 或资源 scope 会释放并重建对应画布资源。
- 资源挂入画布 scope，在 RenderCache 和 device 之前释放；失败分配会回滚，
  保留旧完整缓存供重试。销毁异常不会阻止同一资源组剩余资源的释放，晚到的纹理
  加载不会在已销毁的画布上重新分配资源。

新增 36 项 ECS 回归，覆盖实际调度、buffer 内容、UV 回退、有/无索引、分配失败、
重复销毁和多画布隔离。新增两项浏览器回归统计真实 WebGL 网格上传并检查材质像素，
像素检查前取消选择以排除绿色 gizmo 手柄。连续位姿/材质编辑没有几何上传，切换
球体只上传一套新几何。Chromium 与 WebKit 各 18 项相关用例通过，包括原有的
投影像素、撤销重做、中断和多画布生命周期测试；浏览器测试不计入 Jest 覆盖率。

完整原生 ECS 运行通过 229 个文件、1829 项测试，
用时 781.665 秒。沿用 CI 的两个 worker / 256 MB 回收阈值及 8 GiB 容器限制。
原有 42 项门槛和全量 ECS 源文件统计范围保持不变；新增网格缓存四项 100% 门槛
及 `MeshPipeline3D` 门槛，完整报告满足全部 44 个模块门槛。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 73.69% | 73.82%（21105/28588） |
| 语句覆盖率 | 73.68% | 73.82%（22114/29955） |
| 分支覆盖率 | 62.15% |  62.28%（8754/14055） |
| 函数覆盖率 | 73.66% |   73.77%（2835/3843） |

| 模块                               | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| ---------------------------------- | -------: | ---------: | ---------: |
| `systems/mesh3d/mesh-gpu-cache.ts` |     100% |       100% |       100% |
| `systems/MeshPipeline3D.ts`        |   87.87% |      73.1% |     89.13% |

ECS CommonJS/ESM 构建、仓库与修改文件 ESLint、浏览器和新增 ECS 测试 TypeScript、
格式检查、22 项 tooling 检查和 Markdown 检查均通过。每帧仍更新场景/模型 uniform
并创建 draw binding，后续继续按独立批次优化这些开销。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/mesh-gpu-cache.spec.ts \
  __tests__/ecs/mesh3d-gpu-sync.spec.ts \
  __tests__/ecs/mesh3d-renderer-lifecycle.spec.ts \
  __tests__/ecs/renderer3d-schedule.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts 'gizmo|mesh-gpu-cache'
pnpm exec playwright test -c playwright.webkit.config.ts 'gizmo|mesh-gpu-cache'
pnpm test:tooling
```

## 第二十批：三维模型 uniform 与图层空闲帧优化

2026-10-11，基于 master `c909ba85`（PR #405 已合并），以上一批完整运行的
行覆盖率 73.82%、分支覆盖率 62.28%、函数覆盖率 73.77% 为基线。

- 抽出 `mesh3d/mesh-model-uniforms.ts`，每个模型缓冲拥有独立缓存。位姿不变
  时复用模型/法线矩阵；空闲帧和仅相机变化时不再上传模型 uniform。
- 材质及纹理就绪状态单独比较，无需重算法线矩阵。保存数值快照，识别变换和
  颜色数组的原地修改；比较使用原始精度，避免 Float32 舍入导致反复上传。
- 零缩放时重置法线矩阵，避免保留旧逆矩阵；上传失败保留脏标记供下一次重试。
  每个网格的独立模型缓冲继续支持延迟提交时的内容隔离。
- `Pick3D` 跟踪网格成员、几何、名称、归属和来源变化，跳过空闲帧的图层扫描；
  选择成员单独跟踪，悬停/拖动标记写入不重建图层。API 保留 held 实体，并按
  ECS 身份比较，确保后续从图层面板选择时引用仍有效。

新增 11 项 ECS 行为测试，覆盖原地修改、浮点值、奇异矩阵、纹理状态、失败重试、
延迟提交隔离，以及真实 ECS 的图层改名、撤销重做、多画布归属、删除、重建和
图层选择。扩展原有实际 GPU 调度测试，检查空闲帧和相机变化没有模型上传。
Chromium 与 WebKit 各 18 项相关回归通过；现有两项 mesh/extrusion 浏览器测试
增加真实模型 UBO 上传及图层扫描计数，并验证改名后选择和实际材质像素。
这些浏览器测试使用 WebGL，不计入 Jest 覆盖率。

完整原生 ECS 运行通过 231 个文件、1840 项测试，
用时 850.545 秒，沿用 CI 的两个 worker / 256 MB 回收阈值及 8 GiB 容器限制。
新增模型 uniform 模块四项 100% 门槛；原有 44 项门槛与全量 ECS 源文件统计范围
保持不变，完整报告满足全部 45 个模块门槛。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 73.82% | 73.91%（21168/28639） |
| 语句覆盖率 | 73.82% | 73.91%（22183/30011） |
| 分支覆盖率 | 62.28% |  62.38%（8784/14080） |
| 函数覆盖率 | 73.77% |   73.96%（2846/3848） |

| 模块                                    | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| --------------------------------------- | -------: | ---------: | ---------: |
| `systems/mesh3d/mesh-model-uniforms.ts` |     100% |       100% |       100% |
| `systems/mesh3d/mesh-gpu-cache.ts`      |     100% |       100% |       100% |
| `systems/MeshPipeline3D.ts`             |   86.66% |        75% |     88.88% |
| `systems/Pick3D.ts`                     |   90.44% |     75.89% |     96.55% |

ECS CommonJS/ESM 构建、仓库与修改文件 ESLint、浏览器和新增 ECS 测试 TypeScript、
修改代码的格式检查、22 项 tooling 检查和 Markdown 检查均通过。
场景 uniform、draw binding 和选中时的悬停命中检测仍按原流程执行；相关 ECS
变化发生时，图层列表仍会整体重建。本批没有把这些路径改成逐实体增量计算。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/mesh-model-uniforms.spec.ts \
  __tests__/ecs/mesh3d-layers.spec.ts \
  __tests__/ecs/mesh3d-gpu-sync.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts 'gizmo|mesh-gpu-cache'
pnpm exec playwright test -c playwright.webkit.config.ts 'gizmo|mesh-gpu-cache'
pnpm test:tooling
```

## 第二十一批：动态布局下的三维手势取消与恢复

2026-10-12，基于 master `bc411ff0`（PR #406 已合并），以上一批完整运行的
行覆盖率 73.91%、分支覆盖率 62.38%、函数覆盖率 73.96% 为基线。

- 抽出 `pick3d/gizmo-source-frame.ts`，保存源节点与祖先的局部变换和尺寸快照。
  Yoga 只更新 ECS 几何时也能识别布局变化；手势自己的预览写入会更新快照，
  不会把正常拖动或延迟的世界矩阵传播当作外部变化。
- 取消时按坐标轴撤销仍属于预览的值，保留外部布局改动；新的文档坐标优先。
  布局未变时按 Escape，恢复拖拽前的计算坐标，而非可能过时的文档坐标。
- 指针会话管理预览期间，`SyncMesh3DNodes` 不再重复回写源节点，避免覆盖刚
  算出的布局；直接操作伴生网格的集成保留反向同步。结束时释放预览归属。
- 修复 Yoga 对 `Mesh3DNode` 缺少写权限的问题，确保 flex 容器中的声明式三维
  网格可以完成实际布局。浏览器类型检查解析 Yoga 源码，兼容现有 CommonJS
  构建对 Yoga export-map 子路径的解析限制。

新增 19 项 ECS 行为测试：真实指针流覆盖两种三维源的计算位置、尺寸、祖先移动、
Escape、晚到松手、重新拖拽/撤销及跨画布隔离；独立快照测试覆盖默认坐标、单轴
外部修改、文档坐标移除、缺失组件和无效祖先。旧实现的新布局回归先复现失败。

新增 4 项真实 Yoga 浏览器回归，在 mesh 和挤出矩形拖动期间修改 padding 或
flex-grow，验证文档几何字段不变、计算布局被保留、旧手势不产生撤销记录，且
重新拖拽后 Escape 回到计算位置。Chromium 与 WebKit 各 22 项相关回归通过。
浏览器测试使用 WebGL，不计入 Jest 覆盖率，也不作为原生 WebGPU 验证。

完整原生 ECS 运行通过 232 个文件、1859 项测试，
用时 780.622 秒，沿用 CI 的两个 worker / 256 MB 回收阈值及 8 GiB 容器限制。
新快照模块四项覆盖率均为 100%，并新增对应门槛；原有 45 项门槛和全量 ECS
源文件统计范围不变，完整报告满足全部 46 个模块门槛。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 73.91% | 73.95%（21208/28677） |
| 语句覆盖率 | 73.91% | 73.95%（22222/30049） |
| 分支覆盖率 | 62.38% |  62.47%（8808/14098） |
| 函数覆盖率 | 73.96% |      74%（2853/3855） |

| 模块                                   | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| -------------------------------------- | -------: | ---------: | ---------: |
| `systems/pick3d/gizmo-source-frame.ts` |     100% |       100% |       100% |
| `systems/pick3d/gizmo-session.ts`      |     100% |       100% |       100% |
| `systems/pick3d/gizmo-source.ts`       |   97.01% |     76.74% |       100% |
| `systems/SyncMesh3DNodes.ts`           |   93.93% |     85.71% |       100% |

ECS 与 Yoga CommonJS/ESM 构建、仓库及修改文件 ESLint、浏览器与新增 ECS 测试
TypeScript、修改代码格式、Markdown 检查和 22 项 tooling 检查均通过。
本批采用布局变化时取消手势的策略，未实现拖动中的约束重算或自动重新定位。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/gizmo-source-frame.spec.ts \
  __tests__/ecs/gizmo-invalidation.spec.ts \
  __tests__/ecs/gizmo-lifecycle.spec.ts \
  __tests__/ecs/extrude-gizmo.spec.ts \
  __tests__/ecs/companion3d-sync.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts 'gizmo|mesh-gpu-cache'
pnpm exec playwright test -c playwright.webkit.config.ts 'gizmo|mesh-gpu-cache'
pnpm test:tooling
```

## 第二十二批：三维场景 uniform 与网格绑定缓存

2026-10-12，基于 master `3b491496`（PR #407 已合并），以上一批完整运行的
行覆盖率 73.95%、分支覆盖率 62.47%、函数覆盖率 74% 为基线。

- 抽出 `mesh3d/mesh-scene-uniforms.ts`，按画布保存相机和灯光的数值快照。
  复用渲染、拾取和 gizmo 共用的相机计算；相机或联动二维视图变化才重算矩阵，
  灯光变化独立重新打包，无变化帧跳过场景 UBO 上传。
- 抽出 `mesh3d/mesh-draw-bindings.ts`，绑定随网格 GPU 分配保存。位姿、材质
  数值、相机和灯光编辑复用绑定，纹理就绪或移除、几何重建和资源更换时更新。
  分配失败保留旧绑定供重试，场景上传失败也可在输入未变时重试。
- 绑定先于其引用的缓冲和纹理释放。每个画布和网格仍使用独立 UBO，避免延迟
  提交时串用数据。灯光逐个读取，避免保留被下一次 ECS 读取复用的组件对象。
  保持八盏非环境灯的上限、默认照明和自定义场景的方向补光规则。

新增 37 项 ECS 行为测试，覆盖相机模式与视口比例、原地数组修改、灯光
增删与跨画布归属、三种纹理槽位的异步加载、绑定分配失败、几何重建和释放顺序。
真实 ECS 调度验证网格/挤出图形的空闲帧、相机编辑、材质编辑以及多个灯光组件。
旧实现先复现连续三次绘制创建三份绑定，缓存后复用一份且不重复上传场景数据。

扩展已有浏览器用例，统计实际场景/模型上传与网格绑定创建，并检查关灯和删除
灯光后的画布像素。Chromium 与 WebKit 各 22 项相关回归通过，包含已有的手势、
跨画布销毁和 Yoga 布局场景。浏览器使用 WebGL，不计入 Jest 覆盖率，也不作为
原生 WebGPU 验证。本批没有新增浏览器用例数量。

完整原生 ECS 运行通过 234 个文件、1896 项测试，
用时 774.554 秒，沿用 CI 的两个 worker / 256 MB 回收阈值及 8 GiB 容器限制。
两个新缓存模块的行、语句、分支和函数覆盖率均为 100%，并增加对应门槛；原有
46 个模块门槛和全量 ECS 源文件统计范围不变，完整报告满足全部 48 个模块门槛。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 73.95% | 74.05%（21256/28704） |
| 语句覆盖率 | 73.95% | 74.05%（22278/30084） |
| 分支覆盖率 | 62.47% |  62.54%（8815/14094） |
| 函数覆盖率 |    74% |   74.11%（2863/3863） |

| 模块                                    | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
| --------------------------------------- | -------: | ---------: | ---------: |
| `systems/mesh3d/mesh-scene-uniforms.ts` |     100% |       100% |       100% |
| `systems/mesh3d/mesh-draw-bindings.ts`  |     100% |       100% |       100% |
| `systems/mesh3d/mesh-gpu-cache.ts`      |     100% |       100% |       100% |
| `systems/MeshPipeline3D.ts`             |   91.09% |      77.1% |     90.24% |

ECS CommonJS/ESM 构建、仓库及修改文件 ESLint、浏览器与修改 ECS 测试 TypeScript、
修改代码格式、Markdown 检查和 22 项 tooling 检查均通过。
缓存仍按绘制读取相机和灯光数值以识别原地修改；选中时 gizmo 的 uniform 更新、
悬停命中检测及 WebGL 1 的 legacy uniform 设置仍按原流程执行。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/mesh-scene-uniforms.spec.ts \
  __tests__/ecs/mesh-draw-bindings.spec.ts \
  __tests__/ecs/mesh3d-renderer-lifecycle.spec.ts \
  __tests__/ecs/mesh3d-gpu-sync.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts 'gizmo|mesh-gpu-cache'
pnpm exec playwright test -c playwright.webkit.config.ts 'gizmo|mesh-gpu-cache'
pnpm test:tooling
```

## 第二十三批：图片解码与失败恢复

2026-10-12，基于 master `96c541a7`（PR #408 已合并），以上一批完整运行的
行覆盖率 74.05%、分支覆盖率 62.54%、函数覆盖率 74.11% 为基线。

- 修复没有全局 `File` 构造器时普通 Blob 加载抛出异常的问题。
- HEIC 转 PNG 的转换和位图解码都纳入回退范围；失败或输出为空时，尝试一次
  JPEG。JPEG 失败正常拒绝，后续独立调用仍能重新解码。
- HEIC URL 和 object URL 在读取响应前检查 HTTP 状态；未知格式的普通解码
  失败后，如果辅助 HEIC 请求或签名探测也失败，保留最初的解码错误。已确认
  HEIC 后的转换错误正常向上传播。Blob 签名探测只读取文件头。
- 保留懒加载的 SSR 导入边界；返回位图和输入 object URL 仍由调用方持有。
  同步更新中英文 lesson-010 的实际 API 示例和失败处理说明。

新增 61 项 ECS 行为测试，通过公开加载 API 覆盖 MIME、扩展名、文件签名、
URL/Blob/File/base64 输入、AVIF 排除、并发懒加载、失败重试、第一帧选择和资源
归属。四项修复先在旧实现上复现失败，再验证修复结果。

新增 3 项真实 HEIC 浏览器回归，使用原创的 533 字节双色样本，验证五种输入、
缺少 File 时的 PNG、PNG 转换/解码失败后的真实 JPEG 输出，以及 HTTP 失败后
再次请求成功。Chromium 与 WebKit 各 6 项相关回归通过，包含已有 image-fill
用例；这些浏览器结果不计入 Jest 覆盖率。

样本还暴露出现有 heic2any/libheif 的色彩偏差：左侧源 RGB `(220,60,30)` 被
解为约 `(233,52,18)`。浏览器测试明确使用当前解码结果验证不同输入和回退路径
的一致性，未将其作为色彩准确性验证，也未扩大容差掩盖偏差。样本生成方法、
原始颜色及对照解码结果已记录；解码库色彩、HDR 和 Live Photo 视频仍需后续完善。

完整原生 ECS 运行通过 235 个文件、1957 项测试，
用时 864.883 秒，沿用 CI 的两个 worker / 256 MB 回收阈值及 8 GiB 容器限制。
图片解码模块的行覆盖率从 3.22% 提高到 98.94%，分支覆盖率从 0%
提高到 97.72%，函数覆盖率为 100%。新增门槛为行/语句 98%、
分支 95%、函数 100%；原有 48 项门槛和全量 ECS 源文件统计范围不变，完整报告
满足全部 49 个模块门槛。保留私有 data URL 解析器的防御分支，不为满分改动接口。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 74.05% | 74.36%（21347/28706） |
| 语句覆盖率 | 74.05% | 74.36%（22375/30087） |
| 分支覆盖率 | 62.54% |  62.85%（8858/14093） |
| 函数覆盖率 | 74.11% |   74.39%（2874/3863） |

ECS CommonJS/ESM 构建、仓库及修改文件 ESLint、浏览器与新增 ECS 测试 TypeScript、
修改代码格式、Markdown 检查和 22 项 tooling 检查均通过。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/load-image-bitmap.spec.ts \
  __tests__/ecs/rain-drop-texture-cache.spec.ts \
  __tests__/ecs/fill-layer-image-cache.spec.ts \
  __tests__/ecs/mesh3d-renderer-lifecycle.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts 'image-decoding|image-fill'
pnpm exec playwright test -c playwright.webkit.config.ts 'image-decoding|image-fill'
pnpm test:tooling
```

## 第二十四批：HEIC 色彩与透明度

2026-10-12，基于 master `646c0622`（PR #409 已合并），以上一批完整运行的
行覆盖率 74.36%、分支覆盖率 62.85%、函数覆盖率 74.39% 为基线。

旧 heic2any 的显示实现固定使用 `1.164 * (Y - 16)` 的有限范围转换，并把
alpha 写成 255。原双色样本的红色 `(220,60,30)` 被解为 `(233,52,18)`；
灰阶样本的 16 被截为 0、235 被截为 255，半透明和全透明区域也变为不透明。

-   将依赖替换为固定版本 heic-to 1.6.6（libheif 1.23.6），使用 libheif 的
    RGBA 输出。新解码结果为 `(219,60,30)`，与 Pillow 的参考结果一致。
-   保留按需导入、后台 worker、PNG/JPEG 一次回退、HTTP 错误处理、独立重试
    和调用方对位图/object URL 的所有权。普通图片仍走 loaders.gl。
-   使用新依赖自带的类型，移除旧声明和数组返回值处理。更新中英文文档，明确
    已验证的是完整范围 SDR 样本，JPEG 回退仍有损且不保留透明度。

已有 3 项浏览器回归改为直接比较源颜色，PNG 路径 RGB 容差从 8 收紧到 3，
JPEG 回退容差收紧到 6，普通 PNG 要求完全一致。这 3 项断言先在旧实现上失败。
新增 3 项回归使用灰阶/alpha 和双图容器样本，验证灰阶范围、透明度、第一帧
选择、损坏文件后恢复及并发请求隔离；原始双色 HEIC 文件保持不变。

Chromium 和 WebKit 各 9 项相关回归通过（含 image-fill）。额外构建并静态
服务同一 fixture，打包后 Chromium 和 WebKit 各 6 项解码回归通过。生产构建
保留独立的 HEIC 懒加载文件，约 3.15 MB，Vite 报告 gzip 约 774 KB；新版代码
比旧库更大，仅遇到 HEIC 时加载。浏览器测试不计入 Jest 覆盖率。

ECS 加载器保留 60 项单测；旧库的两项 Blob/数组返回值模拟改为一项 Blob
行为验证，多图第一帧语义由真实 HEIC 浏览器回归覆盖，因此单测总数减少 1 项。
完整原生 ECS 运行通过 235 个文件、1956 项测试，
用时 847.638 秒，沿用 CI 的两个 worker / 256 MB 回收阈值及 8 GiB 容器限制。
图片解码模块行覆盖率为 98.92%、分支 97.5%、函数 100%；
原有全部 49 项模块门槛及全量 ECS 源文件统计范围不变，完整报告满足全部门槛。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 74.36% | 74.36%（21345/28704） |
| 语句覆盖率 | 74.36% | 74.36%（22373/30085） |
| 分支覆盖率 | 62.85% |  62.84%（8854/14089） |
| 函数覆盖率 | 74.39% |   74.39%（2874/3863） |

ECS CommonJS/ESM 构建、仓库及修改文件 ESLint、浏览器与修改 ECS 测试 TypeScript、
格式/Markdown 检查和 22 项 tooling 检查均通过。依赖审计按仓库原有忽略规则通过。
任意 ICC 配置、广色域、HDR 色调映射和 Live Photo 视频不在本批验证范围内。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/load-image-bitmap.spec.ts \
  __tests__/ecs/rain-drop-texture-cache.spec.ts \
  __tests__/ecs/fill-layer-image-cache.spec.ts \
  __tests__/ecs/mesh3d-renderer-lifecycle.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts 'image-decoding|image-fill'
pnpm exec playwright test -c playwright.webkit.config.ts 'image-decoding|image-fill'
pnpm test:tooling
pnpm audit --audit-level=low
```

## 第二十五批：动画导出失败恢复与资源释放

2026-10-12，基于 master `773abad0`（PR #410 已合并），以上一批完整运行的
行覆盖率 74.36%、分支覆盖率 62.84%、函数覆盖率 74.39% 为基线。

`animationExportCodec` 原来的行覆盖率只有 5.12%，分支覆盖率为 0%。检查发现，
WebM 成功后仍保留捕获轨道，渲染或尺寸检查失败时录制器可能继续运行，PNG
绘制异常还会逃逸到图片事件回调外，使导出一直等待。GIF 则没有等待帧回调就读取
快照，且允许写入与第一帧尺寸不同的后续帧。

-   共享 PNG 解码与绘制流程，将绘制移到可传播异常的异步调用链中。
-   WebM 在成功、提前停止及任意录制错误后统一收尾：停止录制器和全部捕获轨道，
    取消待执行的帧回调，移除图片与录制器事件处理器。清理异常不会覆盖原始错误。
-   两种格式都释放内部临时画布，保留调用方的源画布；拒绝空画布、尺寸改变和
    非法帧数。WebM 额外拒绝空录制或提前停止后的不完整数据。
-   GIF 读取每帧前等待浏览器帧回调；WebM 最后一帧请求后等待一次绘制机会再停止。
    中英文 lesson-010 同步说明失败处理和时间戳限制。

新增 77 项 ECS 行为测试，覆盖 MIME 协商、GIF 质量与延迟、帧顺序、编码/绘制
异常、事件竞态、失败后重试以及资源归属。最初四项回归在旧实现上均失败，再在
修复后通过；其余测试补充异常路径和边界条件。保留未触发的防御分支，不为满分
暴露内部方法或修改统计范围。

新增 4 项浏览器测试：Chromium 实际播放 GIF/WebM 的红绿蓝三种颜色（WebM 每种颜色
保持多个捕获周期），验证正常导出和失败后重试、视频尺寸及捕获轨道结束。WebKit
实际播放两个 GIF 用例；本地 WebKit 没有 MediaRecorder，两个 WebM 用例验证
不支持时的拒绝路径，并记录能力注解。支持 WebM 的环境会自动执行完整播放断言。
GIF 通过浏览器合成后的截图采样，避免 drawImage 只读取动图首帧。
Chromium 与 WebKit 各 4 项通过，不计入 Jest 覆盖率。这些 fixture 使用 Canvas 2D，
未声称验证 WebGPU 读回或逐帧无损的视频编码。

完整原生 ECS 运行通过 236 个文件、2033 项测试，
用时 860.396 秒，沿用 CI 的两个 worker / 256 MB 回收阈值及 8 GiB 容器限制。
动画导出模块行覆盖率提高到 98.61%、语句 97.56%、
分支 94.33%、函数 100%。新增门槛为行 98%、语句 97%、
分支 94%、函数 100%；保留原有 49 项门槛及全量 ECS 源文件统计范围，全部 50 项通过。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 74.36% | 74.76%（21480/28731） |
| 语句覆盖率 | 74.36% | 74.78%（22526/30123） |
| 分支覆盖率 | 62.84% |  63.09%（8902/14108） |
| 函数覆盖率 | 74.39% |   74.96%（2898/3866） |

ECS CommonJS/ESM 构建、仓库及修改文件 ESLint、浏览器与新增 ECS 测试 TypeScript、
格式/Markdown 检查和 22 项 tooling 检查均通过。

WebM 时间戳仍使用 MediaRecorder 的实时捕获时钟，尚不保证成品精确 FPS 或时长；
GIF 延迟受文件格式 10 毫秒精度及浏览器最短显示时间限制。后续若要求确定的视频
时序，需要单独评估 WebCodecs 编码和封装，而非用当前浏览器回调数推断帧率。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/animation-export-codec.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts animation-export
pnpm exec playwright test -c playwright.webkit.config.ts animation-export
pnpm test:ecs
pnpm test:tooling
```

## 第二十六批：复合路径填充与实时三角化选项

2026-10-12，基于 master `b8c1340e`（PR #411 已合并），以上一批完整运行的
行覆盖率 74.76%、分支覆盖率 63.09%、函数覆盖率 74.96% 为基线。

默认 Earcut 分支原来只按轮廓方向和输入顺序猜测孔洞，没有应用 `fillRule`。
同方向的 `evenodd` 孔洞被填满，重叠轮廓未按奇偶规则扣除，不同填充规则的
同一路径也可能被分到同一个绘制批次。另发现实时修改 `tessellationMethod`
只更新文档数据，没有同步到 Path 组件。

-   提取 `buildPathFillMesh`，保留单轮廓 `nonzero` 的 Earcut 快速路径；
    复合路径、`evenodd` 及已有的自接触回退交给 libtess，按整条路径解析绕数。
-   填充规则和三角化选项参与 Mesh 合批校验。Rough 继续使用原有三角化流程，
    保留笔触重叠时的透明度累积；VectorNetwork 的填充流程保持不变。
-   同步实时三角化选项，清除该属性时恢复默认值，标记几何需要重建。
    撤销、重做和重新加载保持组件与文档一致。
-   同步中英文 lesson-013，并补充 ECS patch changeset。

新增 62 项 ECS 测试：61 项使用真实 Earcut/libtess 验证三角形面积、孔洞、
重叠与重复轮廓、方向和顺序、空输入、自接触、合批约束及旧缓冲释放；
另 1 项通过真实文档 API 验证三角化选项及历史同步。初始 4 项几何回归中
3 项在旧实现上失败，分离轮廓用例原本通过；新增的组件同步回归也先在旧实现失败。

9 项浏览器回归将真实 GPU 输出、滤镜使用的 Canvas 填充遮罩与原生 Path2D
逐像素比较，覆盖嵌套孔洞、镜像、重叠区域透明度、不同规则并存、实时规则和
三角化选项切换。只跳过原生边缘抗锯齿区域，内部孔洞和三角形接缝仍参与比较，
每例比较超过 10000 个像素，通道容差为 2。Chromium 与 WebKit 各 9 项通过；
这些浏览器测试不计入 Jest 覆盖率，遮罩检查也不代表整条 GPU 滤镜链已覆盖。

同时处理 #411 的 WebKit CI 初始化超时：blend-mode 测试绕过了仓库已有的
WebKit 进程隔离 fixture，本批改为复用它。7 项 WebKit 混合模式回归通过，
保留原来的像素断言和超时配置。

完整原生 ECS 运行通过 237 个文件、2095 项测试，
用时 982.388 秒，沿用 CI 的两个 worker / 256 MB 回收阈值及 8 GiB 容器限制。
新路径填充模块行、语句、分支和函数覆盖率均为 100%，为四项指标增加 100% 门槛。
保留原有 50 项模块门槛和全量 ECS 源文件统计范围，全部 51 项通过。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 74.76% | 74.87%（21519/28739） |
| 语句覆盖率 | 74.78% | 74.89%（22567/30133） |
| 分支覆盖率 | 63.09% |   63.3%（8937/14118） |
| 函数覆盖率 | 74.96% |   75.05%（2903/3868） |

ECS CommonJS/ESM 构建、仓库及修改文件 ESLint、浏览器与修改 ECS 测试 TypeScript、
格式/Markdown 检查和 22 项 tooling 检查均通过。

一般自相交的单轮廓 `nonzero` 仍应显式选择 libtess，本批没有自动识别所有自交。
复合路径改用 libtess 可能增加三角化成本；已有几何缓存继续生效，但本批没有
声称性能提升，也未覆盖完整 WebGPU 渲染链。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/path-fill-mesh.spec.ts \
  __tests__/ecs/history-inheritance-sync.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts ecs-path-fill
pnpm exec playwright test -c playwright.webkit.config.ts 'ecs-path-fill|ecs-blend-mode'
pnpm test:ecs
pnpm test:tooling
```

## 第二十七批：多层填充滤镜与纹理生命周期

2026-10-12，基于 master `75a74a0c`（PR #412 已合并），以上一批完整运行的
行覆盖率 74.87%、分支覆盖率 63.3%、函数覆盖率 75.05% 为基线。

多层填充逐层执行同一条滤镜链时，后一次初始化会释放前一层的输出，导致矩形
出现黑块或丢失底层，Path 还可能中断渲染。多层纯色填充也缺少滤镜所需的
纹理初始化。另发现移除滤镜后仍保留两张离屏纹理，以及 RenderTarget 和滤镜链
重复销毁同一张附属纹理。

-   提取 `createComposedFillTexture`：按填充顺序合成未过滤的纹理，再执行一次
    图形滤镜；正常完成和中途失败均释放已经生成的中间层纹理。
-   SDF 与 Mesh 统一使用这个流程，保留层透明度、混合模式和最终图形透明度。
    移除光栅滤镜时释放滤镜链，不依赖后续是否继续使用图片填充。
-   补齐 Mesh 填充纹理的所有权管理，区分自己创建的纹理、滤镜链输出和借用的
    `FillTexture`。离屏纹理由其 RenderTarget 释放，避免重复销毁。
-   同步中英文 lesson-030，并为 ECS 和滤镜插件添加 patch changeset。

新增 42 项 ECS 单测：8 项覆盖合成顺序、尺寸、无效输入、失败清理与重试；
34 项覆盖已有滤镜路由的自身/祖先优先级、空值、祖先深度与环、图标子节点及
描边几何限制。实体读写边界使用替身，滤镜解析与路由执行真实实现。
两个模块的行、语句、分支、函数覆盖率均达到 100%，并增加对应门槛。

新增 11 项真实 GPU 浏览器回归，覆盖矩形与 Path 的纯色/渐变多层填充、滤镜
先后顺序、恒等滤镜下的半透明合成、实时移除/添加滤镜、单层切换、删除、孔洞及
几何更新；同时监测重复销毁和绑定已销毁纹理。4 项最初的多层填充用例和 2 项
纹理释放用例均先在旧实现上失败。颜色与独立 Canvas 2D 结果或手算结果比较，
通道容差最多为 3。

Chromium 与 WebKit 各通过 11 项新用例及 10 项已有混合模式/图片填充回归。
浏览器测试不计入 Jest/Coveralls 覆盖率。

完整原生 ECS 运行通过 239 个文件、2137 项测试，
用时 1008.884 秒，沿用 CI 的两个 worker / 256 MB 回收阈值及 8 GiB 容器限制。
保留原有 51 项模块门槛和全量 ECS 源文件统计范围，全部 53 项门槛通过。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 74.87% | 75.02%（21569/28750） |
| 语句覆盖率 | 74.89% | 75.03%（22622/30148） |
| 分支覆盖率 |  63.3% |  63.41%（8962/14133） |
| 函数覆盖率 | 75.05% |   75.14%（2908/3870） |

ECS 及滤镜插件 CommonJS/ESM 构建、仓库及修改文件 ESLint、浏览器与新增 ECS
测试 TypeScript、格式/Markdown 检查和 22 项 tooling 检查均通过。

本批没有验证完整 WebGPU 渲染链、所有非恒等滤镜的半透明颜色约定、超出原始
几何的模糊边缘，或动画导出中的滤镜输入复用；这些继续作为后续渲染任务。
没有更改依赖版本或发布包。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/composed-fill-texture.spec.ts \
  __tests__/ecs/filter-entity.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts 'ecs-filter-chain|ecs-blend-mode|image-fill'
pnpm exec playwright test -c playwright.webkit.config.ts 'ecs-filter-chain|ecs-blend-mode|image-fill'
pnpm test:ecs
pnpm test:tooling
```

## 第二十八批：半透明颜色滤镜与 WebGL1 参数

2026-10-12，基于 master `b5544903`（PR #413 已合并且 CI 全部通过），以上一批
完整运行的行覆盖率 75.02%、分支覆盖率 63.41%、函数覆盖率 75.14% 为基线。

图形填充纹理保存非预乘 RGBA，全画布滤镜接收预乘 RGBA；原来的颜色滤镜统一
按后者处理，导致填充透明度越低，亮度、噪点等调整越弱。全画布滤镜还可能在
RGB 已乘 alpha 后才被渲染目标截断，留下超过 alpha 的颜色，影响后续滤镜。

-   为亮度、对比度、色相/饱和度、噪点和两种网点 shader 共用颜色转换与截断
    函数；图形滤镜通过编译宏声明非预乘输入，全画布保留预乘输入和输出。
    在非预乘空间完成颜色调整及截断，保持 alpha，透明像素归零。
-   为上述图形颜色滤镜同步 WebGL1 普通 uniform，复用写入 uniform buffer 的
    数值。每个 pass 绘制前更新，避免连续亮度/对比度复用 shader program 时
    都使用最后一组参数。
-   std140 标量块至少分配 16 字节，修复 WebKit 因噪点滤镜缓冲区过小而拒绝
    绘制的问题。新增浏览器 GPU 错误检查。
-   明确 ECS 图形滤镜纹理接口的颜色约定，更新中英文 lesson-030 和滤镜插件
    patch changeset；没有修改公共函数签名或新增渲染 pass。

新增 44 项原生 WebGL1 GPU 测试，使用真实 ECS、滤镜插件、shader 编译和像素读回，
覆盖矩形/Path、图形/全画布、正负调整、连续同类及共享 program 的不同滤镜、
半透明颜色强度和预乘结果的合法范围。使用已有的显式帧推进工具，不添加固定延时。
原生输入使用纯色通道，避免 Cairo 的预乘转换误差被高对比度放大，通道容差为 2。

新增 9 项浏览器回归，覆盖手算颜色结果、逐 pass 截断、透明背景、渐变/多层填充
与图形透明度、色相/噪点/网点强度，以及强制 WebGL1 的实时参数切换。颜色通道
容差为 3；噪点/网点在同一浏览器内对比不透明与半透明输入，避免跨 GPU 随机数
差异。初始矩形和 Path 亮度用例均先在旧实现失败，WebKit 回归随后定位了缓冲区
对齐问题。

全量回归曾暴露五边形旧快照测试的帧时序问题：截图缺少选框和锚点，单独重跑通过。
该测试改用已有的显式帧推进工具，并断言完成绘制后已切回选择工具且选中新节点；
保留原快照和像素容差，使用 finally 确保清理。

Chromium 与 WebKit 各通过 9 项新回归及 11 项已有多层填充/纹理生命周期回归。
浏览器测试不计入 Jest/Coveralls；本轮全包覆盖增长来自原生 ECS GPU 测试触达的
渲染和滤镜调用路径，滤镜插件源码仍在原有 ECS 统计范围之外。

完整原生 ECS 运行通过 240 个文件、2181 项测试，
用时 1239.149 秒，沿用 CI 的两个 worker / 256 MB 回收阈值；本地容器限制为 8 GiB。
全量 ECS 源文件统计范围与原有 53 项模块门槛不变，全部通过。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 75.02% | 75.45%（21692/28750） |
| 语句覆盖率 | 75.03% | 75.44%（22746/30148） |
| 分支覆盖率 | 63.41% |  63.64%（8995/14133） |
| 函数覆盖率 | 75.14% |   75.65%（2928/3870） |

ECS/滤镜插件 CommonJS/ESM 构建、仓库及修改文件 ESLint、浏览器与新增 ECS 测试
TypeScript、格式/Markdown 检查和 22 项 tooling 检查均通过。

本轮没有处理模糊的预乘采样、纹理留边和几何裁切，也没有验证完整 WebGPU 管线。
WebGL1 uniform 修复限定于本轮覆盖的颜色滤镜，其他效果仍需逐项验证。
后续优先将模糊采样、纹理尺寸、UV 和绘制边界作为一组渲染行为处理。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/filter-alpha.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts 'filter-alpha|ecs-filter-chain'
pnpm exec playwright test -c playwright.webkit.config.ts 'filter-alpha|ecs-filter-chain'
pnpm test:ecs
pnpm test:tooling
```

## 第二十九批：模糊的透明采样、留边与轮廓捕获

2026-10-12，基于 master `a2508869`（PR #414 已合并且 CI 全部通过），以上一批
完整运行的行覆盖率 75.45%、分支覆盖率 63.64%、函数覆盖率 75.65% 为基线。

原来图形滤镜对非预乘 RGBA 直接插值，透明黑色会污染模糊边缘的 RGB。即使纹理
已经模糊，SDF 的轮廓遮罩和 Path 原来的三角形仍会裁掉超出几何的部分，Path 的
孔洞内也无法显示扩散后的像素。

- 为 SDF 和普通 Path/VectorNetwork 填充共用纹理捕获函数，沿用原来的 shader
  和几何得到轮廓、圆角、孔洞和 SDF 纯色描边，再进入带透明留边的滤镜链。
  图层透明度进入捕获纹理，图形透明度只在最终绘制时应用一次。
- 模糊 pass 与最终放大采样都先对相邻 texel 预乘再插值；累计每个 pass 的采样
  范围作为留边。最终使用扩大后的四边形绘制，只扩大渲染包围盒，保持选择几何。
  修改半径、删除滤镜或删除图形时释放相应捕获纹理和几何缓冲区。
- 每个模糊 pass 绘制前同步 WebGL1 uniform，连续模糊使用各自的核；`blur(0px)`
  不进入栅格滤镜链，避免无填充描边被切换到裁切后的填充纹理。为滤镜后端添加
  可选的留边查询，旧后端默认返回零。
- 真实浏览器回归定位了空心 SDF 对角线上的零导数：除以零会留下错误的描边
  像素并被模糊扩散。修复除数，并在捕获时对描边覆盖率做预乘插值，避免抗锯齿
  边缘混入黑色。覆盖无填充的居中、内侧及外侧纯色描边，以及退回零强度的行为。

新增 25 项原生 GPU 回归与 2 项采样范围测试，覆盖三类图形的半透明边缘、连续
模糊、clamp 开关、零强度、实时修改/删除、视口外边缘、孔洞、叠层透明度和描边。
新增 16 项浏览器回归，另覆盖渐变填充、放大采样、强制 WebGL1、圆角及纹理释放。
继续使用显式帧推进、真实 shader 编译和像素读回，不增加固定延时。

原生 GPU 的多层输入使用纯色；现有 Node canvas 适配器不会随包装对象的宽高属性
修改而调整底层画布尺寸，因此渐变的尺寸变化改由真实浏览器验证，未放宽既有测试的颜色容差。
浏览器测试不计入 Jest/Coveralls，滤镜插件源码仍在原有 ECS 统计范围之外。

Chromium 的 16 项新用例与 20 项已有滤镜回归均通过；其中一个已有用例在与构建
同时运行时超时，停止并行构建后原样复核通过，没有修改超时或断言。
最终代码上的 WebKit 36 项回归全部通过，定向原生回归 36 项全部通过。

完整原生 ECS 运行通过 241 个文件、2208 项测试，用时 1052.254 秒，沿用 CI 的
两个 worker / 256 MB 回收阈值，本地容器限制为 8 GiB。全量 ECS 源文件统计范围
及原有 53 项模块门槛不变，全部通过；验证期间源码和测试的哈希保持一致。

| 指标       |     前 |                    后 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 75.45% | 75.95%（21924/28864） |
| 语句覆盖率 | 75.44% | 75.93%（22980/30263） |
| 分支覆盖率 | 63.64% |  64.23%（9119/14197） |
| 函数覆盖率 | 75.65% |   76.12%（2956/3883） |

ECS/滤镜插件 CommonJS/ESM 构建、仓库及修改文件 ESLint、浏览器和新增 ECS 测试
TypeScript、Markdown/新增文件格式检查，以及 22 项 tooling 检查均通过。

本批的扩展几何不覆盖文本、独立 Path 描边、手绘填充、线框/模板绘制或外部
`FillTexture` 输入；这些路径沿用已有实现。完整 WebGPU 管线尚未验证。
中英文 lesson-030 和 ECS/滤镜插件 patch changeset 同步说明了行为及范围，没有发布包。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/filter-blur.spec.ts __tests__/ecs/filter-kawase-blur.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts 'filter-blur|filter-alpha|ecs-filter-chain'
pnpm exec playwright test -c playwright.webkit.config.ts 'filter-blur|filter-alpha|ecs-filter-chain'
pnpm test:ecs
pnpm test:tooling
```

### CI 跟进：Chromium 分片与超时报告

2026-10-13，PR #415 合并后复查浏览器门禁，
[Chromium shard-2](https://github.com/xiaoiver/infinite-canvas-tutorial/actions/runs/38281226862/job/114918729091)
的 GitHub 注解明确记录超过 25 分钟任务上限，导致该分片取消、汇总门禁失败。
本地定向滤镜回归通过并不代表完整浏览器 CI 已通过。

- Chromium 从两个分片拆成四个，当前实际发现的 501 项测试分为
  132、122、122、125 项。继续使用单 worker、串行文件分组、零重试和原有断言。
  WebKit 保留 Lottie 独立组及三个其他分片。
- Playwright 设置 22 分钟全局时限，GitHub 任务仍为 25 分钟，为初始化、
  报告输出和 artifact 上传留出空间。超时仍以失败退出，不会放行汇总门禁。
  master 的一次 WebKit other-2 测试步骤实际用了 20 分 27 秒，因此不能把
  测试进程时限压到 20 分钟。
- timing reporter 在每项测试开始、结束时原子写入 JSON，记录已完成用例和
  当前活动用例。Playwright 全局超时可能不发送最后一个用例的结束回调，
  报告会保留并列出未完成用例，不将其视作完成或通过。
- tooling 实际发现所有 Chromium/WebKit 测试，验证分片完整、无重复且非空；
  通过一个受控挂起的真实 Playwright 子进程，验证超时失败、部分进度、
  JSON 报告和摘要输出。现有失败、取消和跳过状态的门禁检查保留。
- 首次新分片运行还暴露了填色测试的输入时序问题：再次打开 Spectrum 弹层后，
  可见的输入框尚未完成打开及聚焦更新，trace 显示填入绿色后已回到旧红色。
  测试现在等待弹层 `opened` / `closed` 状态并通过真实点击聚焦后再输入，
  同时检查输入值；保留文档颜色、像素、区域结构及撤销重做断言。

本地 Chromium 第三分片 122 项测试全部通过，用时 1029.282 秒；
调整后的填色用例连续运行 5 次通过。完整浏览器矩阵由 PR CI 再次验证。
25 项 tooling 检查、仓库 ESLint 和浏览器 TypeScript 检查通过。
本次只调整 CI 与诊断工具，不改变 ECS 实现、覆盖率统计范围或门槛；
后续继续文本与独立描边的空间滤镜。

```sh
pnpm test:tooling
pnpm exec playwright test -c playwright.browser.config.ts --shard=3/4 \
  --global-timeout=1320000 --reporter=list,json,./scripts/browser-timing-reporter.mjs
pnpm exec playwright test -c playwright.browser.config.ts --shard=4/4 \
  --global-timeout=1320000 --reporter=list,json,./scripts/browser-timing-reporter.mjs
```

## 第三十批：路径控制点与矢量钢笔行为

本批直接补 ECS 行为覆盖，新增 3 个文件、87 项测试，不修改生产实现。
基线取自 master `ef879525` 的 Coveralls 报告（build 82323877）：
行覆盖率为 75.96%（21930/28870），分支覆盖率为 64.25%（9129/14207）。
Coveralls 展示的 72.101% 合并计算行和分支，不能直接与 Jest 行覆盖率比较。

- 路径命令 37 项：相对坐标、重复命令、平滑曲线的控制点反射及重置、子路径关闭、
  圆弧端点和参数保留、控制点索引、辅助线连接，以及序列化后坐标一致性。
- 矢量钢笔 38 项：直线和曲线提交、预览与最终几何一致、闭合区域、交叉点拆分、
  从已有锚点续画和分支、重复边、缩放下的吸附范围、旋转及翻转后的世界坐标、
  已有填充保留、逐边撤销重做、多画布隔离、取消及销毁清理。
  续画期间的远端版本/几何更新、锁定、隐藏、删除、选择变化和撤销均验证不会被
  迟到的 pointerup 覆盖；父级变为不可逆变换时也不会提交错误几何。
- 控制点拖拽 12 项：通过真实事件和 ECS 系统移动三次/二次曲线控制点、端点及圆弧
  端点，同时覆盖旋转和翻转。每次拖拽检查目标位置、其他锚点位置、命令类型和
  一步撤销重做；圆弧另外验证半径、轴角度和两个标记不变。

交互测试复用显式帧推进工具，运行实际事件监听、场景组件、选择和历史系统；
不分配 GPU。Node 缺少原生 Path2D，控制点拖拽套件仅替换路径主体的拾取 provider，
控制圆命中、坐标转换和编辑行为保持真实；主体像素命中仍由浏览器回归负责。
路径编辑会重新归一化局部坐标，SVG 序列化保留两位小数，因此在视口坐标中比较
所有控制点，容差为 0.01 像素，不断言重算前后的局部坐标相同。

新增 `path-edit` 和 `DrawVectorNetwork` 两项模块覆盖率门槛，合计 55 项；
原有 53 项门槛及全部 ECS 源文件的统计范围保持不变，没有增加忽略覆盖率的注释。
路径解析器不会产生的防御分支保留，不通过伪造解析器返回值提高覆盖率。

完整原生 ECS 验证通过 **245 个文件、2314 项测试**，用时 1134.496 秒，
沿用 CI 的两个 worker 和 256 MB worker 回收阈值，本地容器限制为 8 GiB。
全部 55 项模块门槛通过，运行前后的源码、测试及快照基线哈希一致。

| 指标       |   基线 |          本批完整结果 |
| ---------- | -----: | --------------------: |
| 行覆盖率   | 75.96% | 77.54%（22386/28870） |
| 语句覆盖率 | 75.93% | 77.52%（23466/30269） |
| 分支覆盖率 | 64.25% |  65.96%（9371/14207） |
| 函数覆盖率 | 76.13% |   77.08%（2994/3884） |

在统计分母不变的情况下，新增覆盖 456 行、480 条语句、242 个分支和 37 个函数。
按 Coveralls 的行与分支合并口径，本地结果折算为 73.721%，基线为 72.101%；
这不是已更新的线上 master 数值，最终以合并后的 CI 上传报告为准。

| 模块              | 行覆盖率前 → 后 | 分支覆盖率前 → 后 |
| ----------------- | --------------: | ----------------: |
| DrawVectorNetwork |   11.57% → 100% |    0.55% → 94.97% |
| path-edit         |  3.44% → 97.70% |       0% → 94.28% |
| Select            | 75.01% → 77.06% |   71.06% → 72.72% |
| RenderTransformer | 77.81% → 84.96% |   72.33% → 77.23% |

仓库 ESLint、新增 ECS 测试及 React 浏览器 TypeScript、新增文件格式检查、
Markdown/case 检查及 diff 检查均通过。未修改生产代码，无需新增包发布。

### 同批 CI 跟进：面板移除期间的异步观测

PR #424 的 React 18 Chromium 分片在面板切换 API、移除后等待编辑完成时出现
`locator.evaluate: Execution context was destroyed`。失败 trace 的错误位于
异步 evaluate，未记录该步骤发生新的导航。
测试改为在页面内记录异步步骤完成/异常，外部轮询状态；仍执行一次原操作，
等待取消编辑完成后再接回面板。保留左右画布选择及撤销栈断言，并增加取消结果和
面板重新挂载检查，不增加用例重试或延时，不改 ECS 编辑实现。

故障用例在 React 18 Chromium 连续 10 次通过；React 19 Chromium、React 18
及 React 19 WebKit 各连续 3 次通过，共 19 次。未运行完整 React 浏览器矩阵，
该矩阵由 PR CI 继续验证。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/path-edit.spec.ts __tests__/ecs/draw.vector-network.spec.ts \
  __tests__/ecs/select.path-interaction.spec.ts
pnpm test:ecs
pnpm exec playwright test -c playwright.react.config.ts selection-edits.spec.ts \
  -g 'accepted selections stay' --repeat-each=10
```

## 第三十一批：动画状态、画布隔离与插值

本批新增 3 个 ECS 文件、92 项测试，并修复这些行为测试暴露的问题。
基线为合并 PR #425 后的 master `343fc021`，Coveralls build 82345846：
行覆盖率 77.54%（22386/28870），分支覆盖率 65.96%（9371/14207），
行与分支合并口径为 73.721%。该线上数据与上一批完整本地报告一致。

-   动画控制器 55 项：显式时钟下的暂停/恢复、seek、取消、结束、速率、延迟、
    fill 模式、重复及反向、关键帧编辑、缓动、颜色和虚线插值、渐变及路径形变。
    使用真实控制器和解析器，断言采样值及状态，不替换待测算法。
-   动画系统 24 项：共享 world 的双画布、嵌套节点、独立播放头和场景时长、
    编辑后恢复、长时间暂停、循环溢出、空轨道、变换原点、绘制层及路径坐标。
    使用实际 ECS 组件和帧推进，仅固定时钟并复用不分配 GPU 的文档测试环境。
-   API 13 项：动画新增/删除、选项和关键帧增删改、序列化隔离、轨道列表、
    通过节点/id/entity 启动动画，以及缺失目标和越界索引。有效编辑检查一步撤销
    重做，无效编辑检查不会写入历史。

修复内容：

1. `AnimationSystem` 按实体所属画布采样和计时，避免首个画布的播放头及其他
   画布的轨道时长影响当前画布。离开编辑模式时，只恢复由编辑器暂停的控制器；
   调用方预先暂停的控制器保持暂停，已取消的控制器不会重启。
2. 颜色与图层透明度在一次更新中写入，保留其他绘制层及其启用状态。
   描边在纯色和渐变之间切换时同步更新层类型。
3. 线性渐变色标数量相同时插值对应位置，数量不同时按两端位置并集采样，
   保留硬边需要的重复位置，避免非均匀色标被均匀重采样。
4. 路径绕向及起点对齐仅用于双方均为单个闭合轮廓的情况，避免开放路径端点
   被重排，导致中间帧塌缩。
5. 越界删除关键帧提前返回，避免无变化的删除操作产生撤销记录。

新增 5 项真实像素回归，在 Chromium 和 WebKit 各通过一次：双画布位置、
颜色与透明度同时生效、不均匀渐变色标、渐变硬边，以及开放路径形变后的端点。
这些浏览器用例已纳入两种浏览器的 CI 测试发现，但不计入 Jest/Coveralls。

新增 `animation/Animation.ts` 和 `systems/Animation.ts` 两项模块门槛，
合计 57 项，保留全部 ECS 源文件的统计范围和原有 55 项门槛。
没有增加覆盖率忽略标记，也没有把浏览器测试结果混入 Jest 分子。

完整原生 ECS 回归通过 **248 个文件、2406 项测试**，用时 994.768 秒。
沿用 CI 的两个 worker 和 256 MB worker 回收阈值，容器限制为 8 GiB。
全部 57 项模块覆盖率门槛通过，运行前后 800 个源码、测试及快照输入哈希一致。
按 Coveralls 的行与分支合并口径，本地完整结果折算为 **75.330%**，
基线为 73.721%；线上新数值仍需本 PR 合并后的 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 77.54%（22386/28870） | 79.01%（22812/28869） |
| 语句覆盖率 | 77.52%（23466/30269） | 78.96%（23906/30275） |
| 分支覆盖率 |  65.96%（9371/14207） |  67.84%（9656/14232） |
| 函数覆盖率 |   77.08%（2994/3884） |   78.75%（3062/3888） |

| 模块                     |  行覆盖率前 → 后 | 分支覆盖率前 → 后 |
| ------------------------ | ---------------: | ----------------: |
| `animation/Animation.ts` |  46.82% → 96.80% |   40.00% → 91.92% |
| `systems/Animation.ts`   | 22.29% → 100.00% |    1.19% → 96.90% |
| `API.ts`                 |  61.23% → 66.57% |   45.58% → 49.52% |

本批涉及生产修复，统计分母随实现精简及新增分支变化；表中比例按各自实际分母
计算，不把删除代码产生的比例变化当作新增测试覆盖。
中英文 lesson-036 同步更新播放头隔离、恢复规则、绘制层及渐变/路径插值说明，
并修正路径形变代码片段。包含 ECS patch changeset，未发布包。

仓库 ESLint、ECS 新测试和浏览器 TypeScript、ECS CJS/ESM 构建、
26 项 tooling 检查、Markdown/case 和 diff 检查均通过。
完整浏览器矩阵仍由 PR CI 执行；本地只验证此次新增的 5 项像素行为。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/animation-controller.spec.ts __tests__/ecs/animation-system.spec.ts \
  __tests__/ecs/api.animation.spec.ts __tests__/ecs/animation.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts animation-state.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts animation-state.spec.ts
pnpm test:ecs
pnpm test:tooling
pnpm --filter @infinite-canvas-tutorial/ecs build
```

## 第三十二批：渐变解析、坐标与网格布局

本批新增 3 个 ECS 测试文件、124 项行为测试，并修复测试暴露的问题。
基线为合并 PR #426 后的 master `1492d119`，Coveralls build 82346355：
行覆盖率 79.01%（22812/28869），分支覆盖率 67.84%（9656/14232），
行与分支合并口径为 75.330%。线上数据与上一批完整本地报告一致。

-   解析 58 项：线性方向和角度、色标间距与硬边、颜色和单位、图层顺序、
    失败后的解析恢复、调用方数据隔离、径向位置及大小写。
-   坐标与栅格 28 项：带偏移边界的线性端点、圆形径向尺寸、边界外中心、
    锥形中心坐标、预乘透明度、真实 Canvas 像素和空尺寸输入。
-   网格 38 项：控制点与缺省位置、可选参数序列化、无效语法、逻辑点数、
    vec3/vec2/标量对齐、十个点的 shader 字段偏移、缺省填充及输入不变性。
    保留 92 个 float 的有效数据与 96 个 float 的缓冲容量约定。

回归测试先复现，再修复以下行为：

1. 渐变识别限定为函数开头，并支持不区分大小写的函数和方向/形状/尺寸/位置
   关键字；避免图片 URL 中包含 `linear` 等单词就被误识别为渐变。
2. `top center` / `bottom center` 不再被第二个 `center` 覆盖纵轴位置。
3. 径向渐变的边距离使用绝对值，中心位于边界外时也不会产生负半径。
4. 普通填充将 `ConicGradient.angle` 的角度值转为 Canvas 要求的弧度，
   与滤镜输入保持一致。原有缓存单测的单位断言同步修正，并保留缓存复用检查。
5. 可变点数模式保留显式 `points(10)`，与 shader 的十个槽位一致；固定
   3×3 网格模式仍使用九个点。

新增 4 项浏览器像素回归，Chromium 和 WebKit 各通过一次：90°、22.5°、
−45° 的锥形渐变在普通填充、滤镜输入、原生 Canvas 及缓存复用后逐字节一致，
另验证大写径向渐变与边界外中心。所有测试画布显式启用 `willReadFrequently`，
避免多次读回触发栅格后端切换，使恰好位于硬边上的像素比较发生变化。
这组测试使用真实 Canvas 2D，不覆盖完整 WebGPU 管线，也不计入 Jest 覆盖率。

定向 Jest 146 项测试通过。新增 `gradient.ts` 和 `mesh-gradient-padding.ts`
两项模块门槛，合计 59 项；保留全部 ECS 源文件的统计范围和原有门槛，未增加
覆盖率忽略标记。

完整原生 ECS 回归通过 **251 个文件、2530 项测试**，用时 972.087 秒。
沿用 CI 的两个 worker 和 256 MB worker 回收阈值，容器限制为 8 GiB。
全部 59 项模块覆盖率门槛通过，运行前后 803 个源码、测试及快照输入哈希一致。
按 Coveralls 的行与分支合并口径，本地完整结果折算为 **76.148%**，
基线为 75.330%；线上新数值仍需本 PR 合并后的 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 79.01%（22812/28869） | 79.76%（23031/28872） |
| 语句覆盖率 | 78.96%（23906/30275） | 79.69%（24130/30278） |
| 分支覆盖率 |  67.84%（9656/14232） |  68.80%（9795/14236） |
| 函数覆盖率 |   78.75%（3062/3888） |   79.14%（3077/3888） |

| 模块                             |  行覆盖率前 → 后 | 分支覆盖率前 → 后 |
| -------------------------------- | ---------------: | ----------------: |
| `utils/gradient.ts`              |  55.31% → 96.55% |   41.33% → 94.32% |
| `utils/mesh-gradient-padding.ts` | 18.75% → 100.00% |   0.00% → 100.00% |
| `resources/TexturePool.ts`       |  97.80% → 97.80% |   93.33% → 93.33% |

本批实现调整改变了统计分母，比例按各自完整报告计算。
中英文 lesson-017 同步说明关键字、位置、半径、锥形角度及网格布局约定，并明确
椭圆、重复渐变和锥形 `from … at …` 语法仍未实现。包含 ECS patch changeset，
未发布包。

同时加固 PR #426 中偶发失败的 React 粘贴测试：失败 trace 已显示文本完成插入和
选中，未记录页面重新加载，而合并后 master 的 React 矩阵通过。测试现将异步操作
和完成结果保存在页面内，外部仅轮询同步状态；仍在 `paste()` 完成时读取结果，
保留撤销/重做、跨画布隔离与异常断言，不增加重试或固定等待。
React 19 的文本、SVG、节点粘贴各重复十次，共 30 次通过；React 18 各重复三次，共 9 次通过。
trace 没有保留底层 CDP 错误，本批未将具体浏览器内部原因为已证实结论。

仓库 ESLint、新增 ECS、浏览器与 React TypeScript、ECS CJS/ESM 构建、26 项 tooling
检查、Markdown/case、新增文件格式及 diff 检查均通过。完整浏览器矩阵由 PR CI
执行，本地验证本批新增的 4 项像素行为。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/gradient-parser.spec.ts __tests__/ecs/gradient-geometry.spec.ts \
  __tests__/ecs/mesh-gradient.spec.ts __tests__/ecs/texture-pool.spec.ts \
  __tests__/ecs/gradient-premult.spec.ts
pnpm exec playwright test -c playwright.browser.config.ts gradient-geometry.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts gradient-geometry.spec.ts
pnpm test:ecs
pnpm test:tooling
pnpm --filter @infinite-canvas-tutorial/ecs build
```

## 第三十三批：多选对齐、等间距分布与编辑提交

本批基线为合并 PR #427 后的 master `e0a1f757`，Coveralls build 82346726。
线上合并口径 76.148% 与上一批本地完整报告一致；行覆盖率为 79.76%
（23031/28872），分支覆盖率为 68.80%（9795/14236）。

新增 `api.selection-layout.spec.ts`，包含 38 项真实 ECS 行为测试，使用既有
`createDocumentWorld` 和显式帧推进，不模拟节点写入或历史系统：

-   六种对齐与水平/竖直分布，逐项检查位置、尺寸以及一次撤销/重做。
-   非等比缩放、旋转、翻转、带变换的父级、重复 ID、父子同时选中。
-   不等尺寸、负间距与末节点未覆盖整个选区的布局。
-   椭圆、线段、折线、路径、普通文字、路径文字与 Flex 节点，平移不改变几何属性。
-   几何包围盒与描边边界的区别，锁定/删除/缺失节点、不足两个有效节点、幂等操作。
-   排队取消、读取最新几何、不可逆父变换、相同 ID 在两画布中的隔离。

首组 15 项中有 7 项在旧实现失败：缩放后的对齐重写尺寸，旋转/翻转精度和父级
变换下的几何发生变化，重复 ID 算错间距，父子同时选中时子节点被移动两次。
现在两种操作共用稳定的节点筛选，世界平移量只通过父变换的线性逆矩阵换算为
局部位置增量，不再复用 resize 的 OBB 分解与尺寸写回，也不重新生成路径点。
等间距的计算取整个选区的最大端点，保留重叠场景中的负间距。

属性面板改用 `api.edit()`，捕获点击时的画布和节点 ID，在写入阶段检查最新状态。
两个 API 返回是否发生移动；无变化或节点失效时，面板取消本次提交，避免顺带
捕获其他尚未记录的修改。已接受的操作在面板复用/移除后仍属于原画布，已移除
控件无法继续提交新的操作。

新增 11 项浏览器交互回归：八种按钮、排队期间复用面板、先删除再对齐，以及
无变化对齐不捕获未记录的填充修改。Chromium 的 React 18/19 各通过 11 项，WebKit（iPhone 13 配置、React 19）通过 11 项。
这些交互测试不计入 Jest/Coveralls 覆盖率。

定向原生回归 4 个文件、68 项测试通过；新增 API 模块门槛，合计 60 项。
仍统计所有 ECS 源文件，没有忽略未覆盖路径或降低旧门槛。

完整原生 ECS 回归通过 **252 个文件、2568 项测试**，用时 1088.617 秒。
沿用 CI 的两个 worker 和 256 MB worker 回收阈值，容器限制为 8 GiB。
该次 Jest 进程仅因新增 API 行门槛预设为 74%、实测为 73.60% 而退出非零；
将此项校准为 73% 后，使用 Jest 自身的 CoverageReporter 对同一完整 coverage-final
重验，60 项模块门槛全部通过，原有 59 项门槛及源码统计范围不变。校准只改变配置，
其余 803 个输入哈希一致，代码与测试未改变。
按 Coveralls 的行与分支合并口径，本地完整结果折算为 **76.584%**，
基线为 76.148%；线上新数值仍需本 PR 合并后的 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 79.76%（23031/28872） | 80.13%（23101/28827） |
| 语句覆盖率 | 79.69%（24130/30278） | 80.06%（24216/30245） |
| 分支覆盖率 |  68.80%（9795/14236） |  69.37%（9851/14200） |
| 函数覆盖率 |   79.14%（3077/3888） |   79.39%（3086/3887） |

| 模块                | 行覆盖率前 → 后 | 分支覆盖率前 → 后 |
| ------------------- | --------------: | ----------------: |
| `API.ts`            | 66.57% → 73.60% |   49.52% → 56.68% |
| `systems/Select.ts` | 77.06% → 77.06% |   72.72% → 72.72% |

本批合并重复筛选和两个方向的间距计算，并移除了平移中的 resize 转换；实现简化
改变统计分母，表格按各自完整报告计算。中英文 lesson-021 补充方法、坐标语义、
节点过滤、取消和历史约定。包含 ECS/WebComponents patch changeset，未发布包。

仓库 ESLint、新增 ECS/React TypeScript、ECS 和 WebComponents CJS/ESM 构建、
26 项 tooling、Markdown/case/格式与 diff 检查通过。完整浏览器矩阵交由 PR CI。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/api.selection-layout.spec.ts __tests__/ecs/api.integration.spec.ts \
  __tests__/ecs/api.edit.spec.ts __tests__/ecs/select.crop-hierarchy.spec.ts
pnpm exec playwright test -c playwright.react.config.ts selection-layout.spec.ts
pnpm exec playwright test -c playwright.react-webkit.config.ts selection-layout.spec.ts
pnpm test:ecs
pnpm test:tooling
```

## 第三十四批：实体几何反序列化与折线描边缓存

以 #428 合并后的 `master`（`a9b345c5`）为基线。Coveralls build 82348194
已确认这一基线的线上覆盖率为 **76.584%**；本轮继续使用完整 ECS 统计范围，
没有增加排除项，也没有降低原有 60 项模块门槛。

新增 **51 项原生 Jest 回归**，使用真实实体、帧推进、属性同步和历史系统：

-   矩形、椭圆、直线、折线、Path、Brush 及 rough 变体的缺省位置、几何归一化、
    重复推导和文档重载；向量网络的顶点归一化；保留显式零尺寸、变换和笔刷半径。
-   折线无描边/空描边、描边添加和移除、宽度和对齐修改、清除属性、撤销/重做、
    重载一致性、多子路径更新、实体删除及祖先 Group 包围盒刷新。
-   重复端点、重复转角、全部重合、水平/垂直、共线、反向折返及零宽偏移。
    断言保留点序/数量且不修改输入；空闲帧和重命名不重建顶点缓存。

测试暴露并修复：

1. 无 `Stroke` 的折线在 `ComputePoints` 无条件读取组件而报错；现在保留原始顶点。
2. 描边更新未使偏移缓存失效，且 `ComputeBounds` 未监听计算后的顶点更新。
   现在监听描边的添加/修改/移除，并更新形状和祖先 Group 的边界。
3. 重复采样点产生零向量除法及错误转角偏移。现在对连续重复顶点计算一次偏移，
   再恢复原来的点序和数量；没有有效线段时保留有限坐标。
4. `rough-rect` 缺省位置未进入矩形边界推导；现在与普通矩形一致。
5. 清除 `strokeAlignment` 把 `undefined` 写入 ECS 枚举；现在恢复 `center` 默认值。

`ComputePoints` 新增四项 100% 门槛，受保护模块总数为 61。定向原生回归
覆盖新用例、历史属性同步、rough 同步及 SVG 内外描边导出。

完整原生 ECS 回归 **254 个文件、2619 项测试**全部通过，
Jest 进程成功退出，61 项模块门槛全部通过。沿用 CI 的两个 worker、256 MB worker
回收阈值及 8 GiB 容器；用时 956.276 秒，完整统计 427 个 ECS 源文件。
运行前后 1260 个源码/测试/配置/快照输入哈希一致。

按 Coveralls 的行与分支合计口径，本地结果由 **76.584%** 提升至
**76.816%**；新线上数值需本 PR 合并后的 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 80.13%（23101/28827） | 80.35%（23172/28838） |
| 语句覆盖率 | 80.06%（24216/30245） | 80.27%（24290/30259） |
| 分支覆盖率 |  69.37%（9851/14200） |  69.64%（9901/14217） |
| 函数覆盖率 |   79.39%（3086/3887） |   79.71%（3101/3890） |

| 模块                          |  行覆盖率前 → 后 | 分支覆盖率前 → 后 |
| ----------------------------- | ---------------: | ----------------: |
| `systems/ComputePoints.ts`    | 54.23% → 100.00% |  23.52% → 100.00% |
| `utils/deserialize/entity.ts` |  65.57% → 66.76% |   62.96% → 63.97% |
| `systems/ComputeBounds.ts`    |  92.99% → 94.26% |   88.54% → 90.62% |
| `history/ElementsChange.ts`   |  93.91% → 93.91% |   87.77% → 87.81% |

仓库 ESLint、新增用例 TypeScript、ECS CJS/ESM 构建、26 项 tooling、Markdown/case/格式及 diff 检查通过。

中英文 lesson-012 同步说明描边更新及退化采样点的行为，附 ECS patch changeset。
未发布包。本批没有增加浏览器测试；Jest 结果包含原有原生渲染及 SVG 导出回归。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/compute-points.spec.ts __tests__/ecs/deserialize.entity-geometry.spec.ts \
  __tests__/ecs/history-property-sync.spec.ts __tests__/ecs/history-rough-sync.spec.ts \
  __tests__/ecs/export.stroke-alignment.inner.spec.ts \
  __tests__/ecs/export.stroke-alignment.outer.spec.ts
pnpm test:ecs
pnpm test:tooling
```

## 第三十五批：绑定曲线控制点与边标签生命周期

以 #429 合并后的 `master`（`60257852`）为基线。Coveralls build 82348534
已确认线上覆盖率为 **76.816%**。本轮继续覆盖所有 ECS 源文件，保留原有
61 项模块门槛，并为实体反序列化模块增加门槛。

新增 **80 项原生 Jest 行为回归**：

-   绑定端点与自由端点的解析、缺失/非有限端点、普通及 rough 线型的端点读取，
    正交、圆角、二次与三次路由输出，以及临时路由状态清理。
-   二次/三次曲线的独立端点位移、共享平移、单端和无绑定、过时自由端坐标、
    旋转/镜像/非等比缩放、多段路径回退及尾部直线。
-   曲线载入、节点移动、撤销/重做和文档重载；子标签先于父边出现时的初始化，
    六种边类型、位置限制、有符号法线偏移、标签属性编辑和清除。

这些回归暴露并修复了四类问题：

1. 二次贝塞尔的共享控制点重复累加两端位移，导致整条曲线平移时形状改变。
   现在采用两端位移的平均值；三次控制点继续跟随各自相邻端点。
2. 载入文档时，单段可编辑绑定曲线被自动路由覆盖，控制点丢失。现在沿用
   绑定更新时的控制点保持规则，先计算端点位移，再恢复局部布局及变换。
3. 边标签只读取 `M/L/Q/C` 端点，遗漏 `H/V`、`S/T` 和 `A`。
   现在先归一化简写命令并读取弧终点；仍使用命令端点折线作为弧长近似。
4. 修改 `edgeLabelPosition` / `edgeLabelOffset` 没有同步 ECS 标签组件和布局。
   现在立即更新，清除偏移恢复零，清除位置移除自动定位组件，支持撤销/重做。

标签同步仅由文本节点的标签属性变更触发，避免普通绘制系统访问未声明权限的
文本组件。定向原生回归 **5 个文件、133 项测试通过**，包含矢量网络绘制及
裁剪/层级选择回归。

完整回归期间还发现旧 `locked.deselect` 快照依赖 `sleep(300/500)`：
锁定操作的后续渲染尚未完成便截图，残留选框。改用共享 `createECSInteraction`
推进确定的帧数，并实际高亮图形，检查锁定、取消选择和取消高亮状态。
保持原始快照，使用 `finally` 释放画布；锁定及取消选择 3 项定向回归通过。

完整原生 ECS 回归 **257 个文件、2699 项测试**全部通过，
Jest 进程成功退出，62 项模块门槛全部通过。沿用 CI 的两个 worker、256 MB worker
回收阈值及 8 GiB 容器；用时约 972.3 秒，完整统计 427 个 ECS 源文件。
运行前后 1093 个源码/测试/配置/快照输入哈希一致。

按 Coveralls 的行与分支合计口径，本地结果由 **76.816%** 提升至
**77.952%**；新线上数值需本 PR 合并后的 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 80.35%（23172/28838） | 81.34%（23479/28865） |
| 语句覆盖率 | 80.27%（24290/30259） | 81.23%（24604/30286） |
| 分支覆盖率 |  69.64%（9901/14217） | 71.08%（10126/14245） |
| 函数覆盖率 |   79.71%（3101/3890） |   80.33%（3126/3891） |

| 模块                          | 行覆盖率前 → 后 | 分支覆盖率前 → 后 |
| ----------------------------- | --------------: | ----------------: |
| `utils/deserialize/entity.ts` | 66.76% → 94.59% |   63.97% → 89.74% |
| `history/ElementsChange.ts`   | 93.91% → 94.04% |   87.81% → 88.11% |
| `systems/RenderBindings.ts`   | 16.25% → 77.50% |    0.00% → 60.34% |

仓库 ESLint、新增用例 TypeScript、ECS CJS/ESM 构建、26 项 tooling、Markdown/case/格式及 diff 检查通过。

### 同批 CI 跟进：主题测试初始化的 Promise 观测

PR #429 的 React 18/19 Chromium 分片在公共 `ready()` 中失败。CI 附件确认无
额外导航、刷新或崩溃；本地开启 CDP 协议日志后，30 次运行中复现 1 次，
原始错误为 `Promise was collected`，被 Playwright 改写成
`Execution context was destroyed`。

沿用已有选择面板用例的做法，在页面内记录初始化的完成/异常，外部同步轮询
状态，并断言两个画布的编辑均已提交；保留主题、变量、撤销及重载断言。
不增加测试重试、固定延时或扩大超时，也不改生产编辑队列。

修复后 React 19 Chromium 连续 30 项、React 18 Chromium 6 项、React 19
WebKit（iPhone 13 配置）6 项全部通过，共 42 次运行；React 浏览器 TypeScript 和
该用例 ESLint 检查通过。完整 React 浏览器矩阵仍由 PR CI 验证。

中英文 lesson-031 同步曲线保持、二次控制点平均位移和标签属性行为，并明确
曲线标签仍采用弦近似。包含 ECS patch changeset；本批没有增加浏览器用例，
完整 Jest 回归包含现有原生渲染及导出测试。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/edge-bezier-preserve.spec.ts __tests__/ecs/edge-geometry.spec.ts \
  __tests__/ecs/edge-label-lifecycle.spec.ts __tests__/ecs/draw.vector-network.spec.ts \
  __tests__/ecs/select.crop-hierarchy.spec.ts
pnpm test:ecs
pnpm test:tooling
```

## 第三十六批：SVG 图案、手绘几何与文本填充

以 #430 合并后的 `master`（`4b4061fe`）为基线。Coveralls build 82349178
已确认线上覆盖率为 **77.952%**。完整统计继续包含全部 ECS 源文件，保留原有
62 项模块门槛，并为 SVG 导出增加 80% 语句/行、65% 分支、85% 函数门槛。

新增 **46 项原生 Jest 行为回归**：

-   图案填充/描边的四种重复方式、原始图片尺寸、局部坐标、变换及透明度，
    节点间定义 ID 隔离、节点内复用、首个启用图层、内外描边和解码失败。
-   手绘图形的独立图层/节点透明度及零值、填充排线宽度、五种几何的平移，
    实际透明度像素和 SVG 导入再导出的像素一致性。
-   文本的渐变、多重渐变、图片和图案定义，以及元数据、可见性和圆角边界。

修复了图案被误判为拉伸图片、图案尺寸及原点错误、重复定义引用冲突，
以及写入文字内容时删除外层填充定义的问题。手绘线段和路径不再重复扣除位置，
椭圆从宽高推导局部中心和半径，避免缺少旧圆心字段时产生 `NaN`。
手绘填充/描边保留各自透明度，排线宽度使用 `roughFillWeight`。

同时纠正已有手绘线段测试中的世界坐标输入，并通过真实 ECS 文档载入后的
`ComputedRough` 端点对照，验证导出与画布采用相同局部坐标。最终定向原生回归
**4 个文件、69 项测试通过**。

新增 7 项真实浏览器回归，在 Chromium 和 WebKit 分别通过，共 **14 次验证**：
四种图案重复方式逐像素对照 Canvas2D，三种文本填充验证实际可见像素。
Node 端的 SVG 解码器不能绘制嵌入的位图，因此该项像素验证交由浏览器执行；
Node 端保留真实图片解码、DOM 定义引用、手绘透明度和导入再导出验证。
浏览器用例不计入 Jest/Coveralls 覆盖率，已经纳入现有 Chromium/WebKit CI 矩阵。

完整原生 ECS 回归 **260 个文件、2745 项测试**全部通过，
Jest 进程成功退出，63 项模块门槛全部通过。沿用 CI 的两个 worker、256 MB worker
回收阈值及 8 GiB 容器；用时约 1128.0 秒，完整统计 427 个 ECS 源文件。
运行前后 1097 个源码/测试/配置/快照输入哈希一致。

按 Coveralls 的行与分支合计口径，本地结果由 **77.952%** 提升至
**78.467%**；新线上数值需本 PR 合并后的 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 81.34%（23479/28865） | 81.82%（23632/28882） |
| 语句覆盖率 | 81.23%（24604/30286） | 81.70%（24759/30304） |
| 分支覆盖率 | 71.08%（10126/14245） | 71.66%（10213/14251） |
| 函数覆盖率 |   80.33%（3126/3891） |   80.62%（3138/3892） |

| 模块                      | 行覆盖率前 → 后 | 分支覆盖率前 → 后 |
| ------------------------- | --------------: | ----------------: |
| `utils/serialize/svg.ts`  | 77.23% → 89.53% |   61.78% → 73.12% |
| `systems/ComputeRough.ts` | 84.14% → 95.06% |   72.34% → 93.61% |

仓库 ESLint、新增用例 TypeScript、ECS CJS/ESM 构建、26 项 tooling、Markdown/case、
新增内容格式及 diff 检查通过。

中英文 lesson-010 同步说明图案、手绘和文本导出行为，附 ECS patch changeset。
`exportFillGradientOrPattern` / `exportStrokeGradientOrPattern` 现在返回 Promise，
直接调用这两个底层 helper 时需要 `await`。主导出函数原本就是异步接口。
本批未发布包；SVG 图案导入、手绘参数重建及多图层合成导出仍不属于此次支持范围。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/export.pattern.spec.ts __tests__/ecs/export.rough.spec.ts \
  __tests__/ecs/export.presentation.spec.ts __tests__/ecs/history-rough-sync.spec.ts
pnpm test:browser svg-export.spec.ts
pnpm test:browser:webkit svg-export.spec.ts
pnpm test:ecs
pnpm test:tooling
```

## 第三十七批：Canvas2D 栅格导出的几何与绘制顺序

以 #431 合并后的 `master`（`7d60606a`）为基线；Coveralls 已确认线上覆盖率
**78.467%**。本批继续保留全部 ECS 源文件参与覆盖率统计，并提高 `API.ts`
的语句、分支、函数和行门槛。

新增 14 项原生 Canvas2D 像素回归，覆盖矩形描边、椭圆与折线的路径隔离，
SVG 路径的 H/V/Z、二次曲线、弧线及 `evenodd` 填充，线段局部坐标，
节点与填充/描边独立透明度，圆角及圆角图片裁剪，异步图片与同级节点的
绘制顺序，以及解码失败后继续复用画布。修复了这些路径中真实可见的
丢失、重绘和错序问题；子节点递归绘制现在等待前一节点完成。

完整原生 ECS 回归 **261 个文件、2759 项测试**全部通过，用时约 1256.0 秒。
统计覆盖全部 **427 个 ECS 源文件**；运行期间 1098 个源码、测试、配置及快照
输入哈希一致。覆盖率汇总后，按实际结果进一步提高 API 模块门槛至
**80% 语句、64% 分支、81% 函数、80% 行**；63 项最终模块门槛均已对完整报告
逐项核对通过。

按 Coveralls 的行与分支合计口径，本地结果由 **78.467%** 提升至
**78.895%**（约 +0.428 个百分点）；新线上数值需本 PR 合并后的 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 81.82%（23632/28882） | 82.18%（23724/28868） |
| 语句覆盖率 | 81.70%（24759/30304） | 82.04%（24857/30297） |
| 分支覆盖率 | 71.66%（10213/14251） | 72.23%（10286/14240） |
| 函数覆盖率 |   80.62%（3138/3892） |   80.77%（3143/3891） |

`API.ts` 的行覆盖率从 **73.60%（1015/1379）** 升至
**81.09%（1107/1365）**，分支从 **56.68%（513/905）** 升至
**65.54%（586/894）**。语句达到 **81.23%（1186/1460）**，函数达到
**82.27%（246/299）**。

定向原生回归 **6 个文件、74 项测试通过**。ECS CJS/ESM 构建、新测试类型检查、
仓库 ESLint、26 项 tooling、Markdown/case、格式及 diff 检查均通过。
中英文 lesson-010 同步说明 Canvas2D helper 的支持范围和图层顺序；附 ECS
patch changeset。本批不发布包。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/api.render-to-canvas.spec.ts \
  __tests__/ecs/api.integration.spec.ts __tests__/ecs/api.edit.spec.ts \
  __tests__/ecs/api.batch.spec.ts __tests__/ecs/api.selection-layout.spec.ts \
  __tests__/ecs/api.text-resize.spec.ts
pnpm test:ecs
pnpm test:tooling
```

## 第三十八批：Iconify 图标正文与注册生命周期

以 #432 合并后的 `master`（`b5d6f3b9`）为基线，上一轮本地按 Coveralls 口径的
全包覆盖率为 **78.895%**。本批覆盖率仍统计全部 ECS 源文件，并为
`utils/icon-font.ts` 增加语句、分支、函数和行门槛。

修复了 Iconify SVG 正文的单引号属性和显式闭合图形标签被忽略的问题。
新增回归验证嵌套 `<g>` 展示属性、路径/矩形/圆的实际 ECS 子实体，
线与椭圆混合时的 AABB 缩放，以及图标集的别名、缺失缓存、热更新和注销。
主题变量解析与显式零描边宽度也有行为断言。中英文 lesson-038 同步说明
所支持的 SVG 标签写法；附 ECS patch changeset。本批不发布包。

完整回归初跑时 `draw.hexagon` 快照缺少选中锚点，单独复跑通过，说明固定
延时下截取了未完成的交互帧。沿用已有三角形、五边形用例的逐帧交互工具，
在截图前断言新节点已选中，再推进变换框绘制所需的帧；不修改快照。

最终完整原生 ECS 回归 **262 个文件、2764 项测试**全部通过，用时约 1253.7 秒。
统计覆盖全部 **427 个 ECS 源文件**，运行前后 1099 个源码、测试、配置及
快照输入哈希一致。新增图标模块 **73% 语句、63% 分支、95% 函数、73% 行**
门槛，64 项模块门槛全部通过。仓库 ESLint、ECS CJS/ESM 构建、新增/改动用例
TypeScript、26 项 tooling、Markdown/case、格式及 diff 检查通过。

按 Coveralls 的行与分支合计口径，本地全包由 **78.895%** 提升至
**79.012%**（约 +0.117 个百分点）；线上数值仍需 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 82.18%（23724/28868） | 82.27%（23750/28866） |
| 语句覆盖率 | 82.04%（24857/30297） | 82.13%（24883/30295） |
| 分支覆盖率 | 72.23%（10286/14240） | 72.39%（10308/14239） |
| 函数覆盖率 |   80.77%（3143/3891） |   80.82%（3145/3891） |

`utils/icon-font.ts` 的行覆盖率由 **68.11%（314/461）** 升至
**74.07%（340/459）**，分支由 **58.79%（244/415）** 升至
**64.25%（266/414）**；函数达到 **97.22%（35/36）**。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/iconify-body-primitives.spec.ts \
  __tests__/ecs/iconify-registration-lifecycle.spec.ts \
  __tests__/ecs/iconify-icon-viewbox-override.spec.ts
pnpm test:ecs
```

## 第三十九批：连接约束与非有限端点

以 #433 合并后的 `master`（`89ccf5d1`）为基线。上一批本地按 Coveralls
行与分支合计口径的全包覆盖率为 **79.012%**；继续统计全部 ECS 源文件，
并为 `utils/binding/connection.ts` 增加模块门槛。

新增连接几何回归，覆盖两端独立的固定锚点与像素偏移、旋转节点、边界投射，
以及连接到自由端点时的正交浮动锚点。无效的归一化端点坐标现在退回图形边界；
无效像素偏移被忽略，避免 `NaN` 或 `Infinity` 传播到路径世界坐标。
对直接调用的连接点函数也验证同样的非有限值兜底。
中英文 lesson-031 同步说明这些行为，并附 ECS patch changeset；本批不发布包。

新增 **10 项**原生 Jest 回归；与既有 edge 几何测试一起定向运行时，
3 个文件、54 项测试通过。完整原生 ECS 回归 **263 个文件、2774 项测试**
全部通过，用时约 1241.4 秒。统计覆盖全部 **427 个 ECS 源文件**；
运行前后 1100 个源码、测试、配置及快照输入哈希一致。
连接模块新增 **55% 语句、52% 分支、75% 函数、55% 行**门槛，
65 项模块门槛均通过。仓库 ESLint、新测试 TypeScript、ECS CJS/ESM
构建、26 项 tooling、Markdown/case 和 diff 检查均通过。

按 Coveralls 的行与分支合计口径，本地全包由 **79.012%** 提升至
**79.041%**（约 +0.029 个百分点）；线上数值仍需 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 82.27%（23750/28866） | 82.29%（23758/28868） |
| 语句覆盖率 | 82.13%（24883/30295） | 82.15%（24891/30297） |
| 分支覆盖率 | 72.39%（10308/14239） | 72.44%（10322/14249） |
| 函数覆盖率 |   80.82%（3145/3891） |   80.85%（3146/3891） |

`utils/binding/connection.ts` 的行覆盖率由 **52.12%（86/165）** 升至
**55.68%（93/167）**，分支由 **47.61%（70/147）** 升至
**52.86%（83/157）**；函数由 11/16 升至 12/16。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/edge-connection-constraints.spec.ts \
  __tests__/ecs/edge-geometry.spec.ts \
  __tests__/ecs/edge-terminal-points.spec.ts
pnpm test:ecs
```

## 第四十批：箭头预览的单轴移动与绑定生命周期

以 #434 合并后的 `master`（`536e2342`）为基线。上一轮本地按 Coveralls
行与分支合计口径的全包覆盖率为 **79.041%**；继续统计全部 ECS 源文件，
并为 `systems/DrawArrowConnect.ts` 增加模块门槛。

修复画箭头时仅当指针的 X 和 Y 同时变化才刷新预览的问题。先用真实指针事件
复现水平移动后预览端点停在原处，再验证水平、竖直移动都能更新同一条临时边。
新增回归还覆盖两端绑定图形、图形与空白端点混合、重复点击起点、完成后替换
临时边及撤销/重做、Escape 和切换工具取消时清除预览。
中英文 lesson-031 同步说明预览与取消行为，并附 ECS patch changeset；本批不发布包。

新增 **6 项**真实指针交互回归；与原有箭头渲染快照一起定向运行时，
2 个文件、7 项测试通过。完整原生 ECS 回归 **264 个文件、2780 项测试**
全部通过，用时约 1178.6 秒。统计覆盖全部 **427 个 ECS 源文件**；
运行前后 1101 个源码、测试、配置及快照输入哈希一致。
箭头连接模块新增 **92% 语句、71% 分支、100% 函数、92% 行**门槛，
66 项模块门槛均通过。仓库 ESLint、新测试 TypeScript、ECS CJS/ESM
构建、26 项 tooling、Markdown/case、格式及 diff 检查均通过。

按 Coveralls 的行与分支合计口径，本地全包由 **79.041%** 提升至
**79.389%**（约 +0.348 个百分点）；线上数值仍需 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 82.29%（23758/28868） | 82.63%（23854/28868） |
| 语句覆盖率 | 82.15%（24891/30297） | 82.48%（24989/30297） |
| 分支覆盖率 | 72.44%（10322/14249） | 72.81%（10376/14249） |
| 函数覆盖率 |   80.85%（3146/3891） |   81.03%（3153/3891） |

`systems/DrawArrowConnect.ts` 的行覆盖率由 **47.36%（90/190）** 升至
**92.10%（175/190）**，分支由 **30.47%（32/105）** 升至
**71.42%（75/105）**；14 个函数全部覆盖。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/draw-arrow-connect.interaction.spec.ts \
  __tests__/ecs/draw.arrow.spec.ts
pnpm test:ecs
```

## 第四十一批：相机地标动画插值与纯缩放

以 #435 合并后的 `master`（`a4a513b1`）为基线。上一轮本地按 Coveralls
行与分支合计口径的全包覆盖率为 **79.389%**；继续统计全部 ECS 源文件，
并提高 `API.ts` 的模块门槛。

修复 `gotoLandmark` 每帧从当前相机重新插值、使动画曲线依赖帧率的问题；
现在始终从动画启动时的状态插值。提前结束也同时检查位置与缩放／旋转，
避免只改变缩放时首帧直接跳到终点。新增受控帧时钟回归，覆盖线性轨迹、
纯缩放、动画中途重启，以及立即切换时取消旧动画和回调行为。
英、中、韩三版 lesson-004 同步修正示例，并附 ECS patch changeset；本批不发布包。

新增 **4 项**原生 Jest 回归。完整原生 ECS 回归 **265 个文件、2784 项测试**
全部通过，用时约 1253.2 秒。统计覆盖全部 **427 个 ECS 源文件**；
运行前后 1102 个源码、测试、配置及快照输入哈希一致。
`API.ts` 门槛提高到 **82% 语句、66% 分支、82% 函数、82% 行**，
66 项模块门槛均通过。仓库 ESLint、新测试 TypeScript、ECS CJS/ESM
构建、26 项 tooling、Markdown/case、格式及 diff 检查均通过。

按 Coveralls 的行与分支合计口径，本地全包由 **79.389%** 提升至
**79.472%**（约 +0.083 个百分点）；线上数值仍需 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 82.63%（23854/28868） | 82.72%（23882/28869） |
| 语句覆盖率 | 82.48%（24989/30297） | 82.56%（25017/30298） |
| 分支覆盖率 | 72.81%（10376/14249） | 72.87%（10383/14247） |
| 函数覆盖率 |   81.03%（3153/3891） |   81.05%（3154/3891） |

`API.ts` 的行覆盖率由 **81.17%（1108/1365）** 升至
**83.16%（1136/1366）**，分支由 **65.54%（586/894）** 升至
**66.47%（593/892）**；函数由 247/299 升至 248/299。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/api.camera-landmark.spec.ts
pnpm test:ecs
```

## 第四十二批：旋转画布的滚轮、双指平移与 Shift 旋转

以 #436 合并后的 `master`（`c7280886`）为基线。上一轮本地按 Coveralls
行与分支合计口径的全包覆盖率为 **79.472%**；继续统计全部 ECS 源文件，
并为 `systems/CameraControl.ts` 增加模块门槛。

修复旋转画布时将滚轮与双指位移直接当作世界坐标、造成平移方向偏离的问题。
双指移动现在让画布跟随触点，捏合缩放与平移同帧发生时也能在更新后的相机
变换上连续应用。另修复 Shift 拖拽旋转时跨帧持有 ECS 输入向量引用导致的
组件访问异常。新增回归覆盖真实滚轮事件、缩放锚点和边界、手形工具拖拽及
Shift 旋转；双指输入通过受控 ECS Input 状态测试，未替代 iOS 浏览器验收。
英、中、韩三版 lesson-004 同步说明，并附 ECS patch changeset；本批不发布包。

新增 **10 项**原生 Jest 回归。完整原生 ECS 回归 **266 个文件、2794 项测试**
全部通过，用时约 1298.9 秒。统计覆盖全部 **427 个 ECS 源文件**；
运行前后 1103 个源码、测试、配置及快照输入哈希一致。
相机控制模块新增 **95% 语句、85% 分支、90% 函数、95% 行**门槛，
67 项模块门槛均通过。仓库 ESLint、新测试 TypeScript、ECS CJS/ESM
构建、26 项 tooling、Markdown/case、格式及 diff 检查均通过。

按 Coveralls 的行与分支合计口径，本地全包由 **79.472%** 提升至
**79.705%**（约 +0.233 个百分点）；线上数值仍需 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 82.72%（23882/28869） | 83.00%（23966/28872） |
| 语句覆盖率 | 82.56%（25017/30298） | 82.83%（25101/30301） |
| 分支覆盖率 | 72.87%（10383/14247） | 73.01%（10402/14247） |
| 函数覆盖率 |   81.05%（3154/3891） |   81.24%（3162/3892） |

`systems/CameraControl.ts` 的行覆盖率由 **57.57%（76/132）** 升至
**96.29%（130/135）**，分支由 **48.64%（18/37）** 升至
**86.48%（32/37）**；函数由 9/14 升至 14/15。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/camera-control-pan.interaction.spec.ts
pnpm test:ecs
```

## 第四十三批：剪贴板读取与图形粘贴校验

以 #437 合并后的 `master`（`3785fe3d`）为基线。上一轮本地按 Coveralls
行与分支合计口径的全包覆盖率为 **79.705%**；继续统计全部 ECS 源文件。

修复浏览器只有 `readText()` 而没有 `read()` 时，菜单粘贴会遍历 `undefined`
并报错的问题。`read()` 拒绝时也可尝试读取纯文本；无法读取时保留权限错误。
粘贴解析现在检查 JSON 数组中的节点标识和层级字段，避免任意数组进入图形
克隆路径。新增 9 项原生 Jest 回归，涵盖纯文本降级、富文本／图片读取、
不可读项目、权限拒绝、图形数组校验和 HTML 与纯文本的优先级。
英、中两版 lesson-024 同步说明，并附 ECS patch changeset；本批不发布包。

完整原生 ECS 回归 **267 个文件、2803 项测试**全部通过，用时约
1320.8 秒。统计覆盖全部 **427 个 ECS 源文件**；运行前后 1104 个源码、
测试、配置及快照输入哈希一致。`utils/clipboard.ts` 新增 **50% 语句、
50% 分支、70% 函数、50% 行**模块门槛，68 项模块门槛均通过。
仓库 ESLint、新测试 TypeScript、ECS CJS/ESM 构建、26 项 tooling、
Markdown/case、格式及 diff 检查均通过。

按 Coveralls 的行与分支合计口径，本地全包由 **79.705%** 提升至
**79.927%**（约 +0.222 个百分点）；线上数值仍需 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 83.00%（23966/28872） | 83.24%（24034/28873） |
| 语句覆盖率 | 82.83%（25101/30301） | 83.05%（25169/30304） |
| 分支覆盖率 | 73.01%（10402/14247） | 73.21%（10440/14259） |
| 函数覆盖率 |   81.24%（3162/3892） |   81.42%（3170/3893） |

`utils/clipboard.ts` 的行覆盖率由 **8.78%（13/148）** 升至
**54.36%（81/149）**，分支由 **1.61%（1/62）** 升至
**52.70%（39/74）**；函数由 0/10 升至 8/11。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/clipboard.spec.ts
pnpm test:ecs
```

## 第四十四批：笔刷输入、暂存与提交

以 #438 合并后的 `master`（`f936d9b2`）为基线。上一轮本地按 Coveralls
行与分支合计口径的全包覆盖率为 **79.927%**；继续统计全部 ECS 源文件。

新增 6 项真实 ECS 交互测试，覆盖手写笔压力写入与一次撤销／重做、鼠标
合并事件的快慢笔触宽度、同帧按下／移动／松开的末端坐标、Escape 与工具
切换取消、`pointercancel` 后恢复，以及两个画布的笔刷状态隔离。测试使用
受控事件时间戳和显式帧推进，不用固定延时；保留已有笔刷压感计算单测。
本批只新增测试和覆盖率门槛，不修改笔刷生产代码，也不发布包。

完整原生 ECS 回归 **268 个文件、2809 项测试**全部通过，用时约
1208.1 秒。统计覆盖全部 **427 个 ECS 源文件**；运行前后 1105 个源码、
测试、配置及快照输入哈希一致。`systems/DrawBrush.ts` 新增 **90% 语句、
85% 分支、75% 函数、95% 行**模块门槛，69 项模块门槛均通过。
仓库 ESLint、新测试 TypeScript、Markdown/case、格式及 diff 检查均通过。

按 Coveralls 的行与分支合计口径，本地全包由 **79.927%** 提升至
**80.126%**（约 +0.199 个百分点）；线上数值仍需 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 83.24%（24034/28873） | 83.42%（24088/28873） |
| 语句覆盖率 | 83.05%（25169/30304） | 83.25%（25229/30304） |
| 分支覆盖率 | 73.21%（10440/14259） | 73.44%（10472/14259） |
| 函数覆盖率 |   81.42%（3170/3893） |   81.58%（3176/3893） |

`systems/DrawBrush.ts` 的行覆盖率由 **30.66%（23/75）** 升至
**97.33%（73/75）**，分支由 **6.06%（2/33）** 升至
**87.87%（29/33）**；函数由 5/14 升至 11/14。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/draw-brush.interaction.spec.ts
pnpm test:ecs
```

## 第四十五批：图形绘制取消与同帧提交

以 #439 合并后的 `master`（`8b0f97c9`）为基线，继续统计全部 ECS 源文件。
新增 15 项真实 ECS 交互测试，覆盖矩形撤销／重做、`pointercancel` 与 Escape
取消、切换工具时丢弃旧预览、同帧按下／移动／松开、反向拖拽、关闭尺寸标签，以及
线段、多边形、椭圆、粗糙图形与 iconfont 的提交。测试沿用受控事件时间戳和显式
帧推进，不用固定延时。

测试发现并修复了旧预览在取消后仍可提交、Escape 隐藏预览时触发 ECS 组件权限
错误，以及同帧松手时摄像机控制已清除按下坐标导致图形丢失的问题。`DrawRect`
现在保存每次按下的起点，在松手时用最终位置结算；工具变化和取消会清除对应预览
与绘制状态。

`systems/DrawRect.ts` 新增 **60% 语句、70% 分支、80% 函数、60% 行**
模块门槛。完整原生 ECS 回归 **269 个文件、2824 项测试**全部通过，用时约
2176.2 秒。统计覆盖全部 **427 个 ECS 源文件**；运行后 1106 个源码、
测试、配置及快照输入哈希一致。全部 70 项模块门槛通过。ECS CJS/ESM
构建、TypeScript、ESLint、26 项 tooling、Markdown lint、改动代码格式及
diff 检查通过。

按 Coveralls 的行与分支合计口径，本地全包由 **80.126%** 提升至
**80.238%**（约 +0.112 个百分点）；线上数值仍需 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 83.42%（24088/28873） | 83.48%（24120/28892） |
| 语句覆盖率 | 83.25%（25229/30304） | 83.30%（25261/30322） |
| 分支覆盖率 | 73.44%（10472/14259） | 73.66%（10514/14272） |
| 函数覆盖率 |   81.58%（3176/3893） |   81.58%（3176/3893） |

`systems/DrawRect.ts` 的行覆盖率由 **54.70%（122/223）** 升至
**63.63%（154/242）**，分支由 **61.01%（108/177）** 升至
**78.94%（150/190）**；函数保持 16/20。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/draw-rect.interaction.spec.ts
pnpm test:ecs
```

## 第四十六批：SVG 导出命令与选区

以 #440 合并后的 `master`（`ecfb8c65`）为基线，继续统计全部 ECS 源文件。
新增 5 项真实 ECS 行为测试，覆盖选区导出的边界、padding、重复节点去重、
裁剪父节点与 CSS 变量保留；整画布的线格、点格和关闭网格；以及通过
`API.export()` 交付 `Screenshot`、清理请求并再次导出。测试显式推进 ECS
帧，不用固定延时。只新增测试和覆盖率门槛，不修改生产代码。

`systems/ExportSVG.ts` 新增 **90% 语句、70% 分支、90% 函数、90% 行**
模块门槛。完整原生 ECS 回归 **270 个文件、2829 项测试**全部通过，用时约
1156.8 秒。统计覆盖全部 **427 个 ECS 源文件**；运行前后 1107 个源码、
测试、配置及快照输入哈希一致。全部 71 项模块门槛通过。新测试 TypeScript、
ESLint、26 项 tooling、Markdown lint、改动代码格式及 diff 检查通过。

按 Coveralls 的行与分支合计口径，本地全包由 **80.238%** 提升至
**80.461%**（约 +0.222 个百分点）；线上数值仍需 CI 上传确认。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 83.48%（24120/28892） | 83.79%（24210/28892） |
| 语句覆盖率 | 83.30%（25261/30322） | 83.60%（25351/30322） |
| 分支覆盖率 | 73.66%（10514/14272） | 73.71%（10520/14272） |
| 函数覆盖率 |   81.58%（3176/3893） |   81.63%（3178/3893） |

`systems/ExportSVG.ts` 的行覆盖率由 **37.22%（51/137）** 升至
**100%（137/137）**，分支由 **62.50%（5/8）** 升至 **75%（6/8）**，
函数由 9/11 升至 11/11。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/export-svg.interaction.spec.ts
pnpm test:ecs
```

## 第四十七批：Iconify 图元解析边界

以 #441 合并后的 `master`（`79952c99`）为基线，继续统计全部 ECS 源文件。
新增 8 项解析行为测试，覆盖嵌套 `<g>` 样式继承、成对和自闭合图形标签、
不支持的外层标签、圆角矩形半径裁剪及 viewBox 偏移、多个图形的并集边界，
以及空内容或无效图形。移除栈式解析器之后重复的扁平自闭合标签回退分支；
现有 iconfont 渲染和 SVG 导出测试继续通过。

`utils/icon-font.ts` 的模块门槛由 **73% 语句、63% 分支、95% 函数、73% 行**
提高到 **85% 语句、75% 分支、95% 函数、85% 行**。完整原生 ECS 回归
**271 个文件、2837 项测试**全部通过，用时约 1164.5 秒，统计范围仍为
**427 个 ECS 源文件**。运行前后 1108 个源码、测试和配置输入中，只有在
报告生成后提高的覆盖率门槛配置发生变化；新门槛已用该完整报告逐项校验。
ECS CJS/ESM 构建、26 项 tooling、TypeScript、ESLint、改动测试和 changeset
格式及 diff 检查通过。

按 Coveralls 的行与分支合计口径，本地全包由 **80.461%** 提升至
**80.736%**（约 +0.275 个百分点）；线上数值仍需 CI 上传确认。
这一增幅同时来自新增测试命中的路径和删除未覆盖的重复分支，不能全部归因于
新增测试。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 83.79%（24210/28892） | 84.00%（24219/28830） |
| 语句覆盖率 | 83.60%（25351/30322） | 83.80%（25360/30260） |
| 分支覆盖率 | 73.71%（10520/14272） | 74.10%（10532/14213） |
| 函数覆盖率 |   81.63%（3178/3893） |   81.63%（3178/3893） |

`utils/icon-font.ts` 的行覆盖率由 **74.07%（340/459）** 升至
**87.90%（349/397）**，分支由 **64.25%（266/414）** 升至
**78.30%（278/355）**；函数保持 35/36。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/iconify-body-parser.spec.ts
pnpm test:ecs
```

## 第四十八批：自环连接方向与提示点

以 #442 合并后的 `master`（`ca8ed907`）为基线，继续统计全部 ECS 源文件。
新增 10 项边几何行为测试，覆盖自环向东、向西、向北、向南的实际路径、
居中外部提示点、节点内部提示点、显式控制点、固定端点、缺失节点和无效边界。
测试先复现并修复两处路由问题：east/west 控制点落在相反方向；居中提示点
使两个控制点重合，导致自环折叠。

`utils/binding/connection.ts` 的模块门槛由 **55% 语句、52% 分支、75% 函数、
55% 行**提高到 **90% 语句、90% 分支、95% 函数、90% 行**。完整原生
ECS 回归 **272 个文件、2847 项测试**全部通过，用时约 1088.4 秒，
统计范围仍为 **427 个 ECS 源文件**。运行前后 1109 个源码、测试、配置及
快照输入哈希一致；全部 71 项模块门槛通过。ECS CJS/ESM 构建、
TypeScript、ESLint、26 项 tooling、Markdown lint、改动测试和 changeset
格式及 diff 检查通过。

按 Coveralls 的行与分支合计口径，本地全包由 **80.736%** 提升至
**81.031%**（约 +0.295 个百分点）；线上数值仍需 CI 上传确认。
完整报告新增覆盖 63 行、64 个分支，统计分母未变。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 84.00%（24219/28830） | 84.22%（24282/28830） |
| 语句覆盖率 | 83.80%（25360/30260） | 84.01%（25424/30260） |
| 分支覆盖率 | 74.10%（10532/14213） | 74.55%（10596/14213） |
| 函数覆盖率 |   81.63%（3178/3893） |   81.83%（3186/3893） |

`utils/binding/connection.ts` 的行覆盖率由 **55.68%（93/167）** 升至
**93.41%（156/167）**，分支由 **52.86%（83/157）** 升至
**93.63%（147/157）**，函数由 12/16 升至 16/16。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/edge-loop-routing.spec.ts
pnpm test:ecs
```

## 第四十九批：字素安全换行与 bitmap 字体行高

以 #443 合并后的 `master`（`a377206a`）为基线，继续统计全部 ECS 源文件。
新增 10 项文本测量行为测试，覆盖 emoji 与组合字符的省略号截断、
bitmap 字体的字素换行、字距、字偶距与缩放，以及中日韩禁则标点、
字体名数组、文本对齐和基线。测试复现并修复了截断留下半个 emoji 或拆开
组合字符、bitmap 行高重复缩放、字体名数组被原地修改的问题。换行和禁则处理
现在统一按字素簇移动字符。

为 `systems/ComputeTextMetrics.ts` 新增 **85% 语句、70% 分支、90% 函数、
85% 行**模块门槛。完整原生 ECS 回归 **273 个文件、2857 项测试**全部
通过，用时约 1075.2 秒，统计范围仍为 **427 个 ECS 源文件**。运行前后
1110 个源码、测试、配置及快照输入哈希一致；全部 72 项模块门槛通过。
ECS CJS/ESM 构建、TypeScript、ESLint、26 项 tooling、Markdown lint、
改动测试和 changeset 格式及 diff 检查通过。

按 Coveralls 的行与分支合计口径，本地全包由 **81.031%** 提升至
**81.321%**（约 +0.291 个百分点）；线上数值仍需 CI 上传确认。
完整报告新增覆盖 88 行、42 个分支；测量模块的新增逻辑也使全包统计分母
各增加 3 行和 3 个分支。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 84.22%（24282/28830） | 84.52%（24370/28833） |
| 语句覆盖率 | 84.01%（25424/30260） | 84.31%（25516/30262） |
| 分支覆盖率 | 74.55%（10596/14213） | 74.83%（10638/14216） |
| 函数覆盖率 |   81.83%（3186/3893） |   82.22%（3201/3893） |

`systems/ComputeTextMetrics.ts` 的行覆盖率由 **62.41%（176/282）** 升至
**92.63%（264/285）**，分支由 **60.37%（96/159）** 升至
**85.18%（138/162）**，函数由 19/37 升至 34/37。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/text-metrics-boundaries.spec.ts
pnpm test:ecs
```

## 第五十批：剪贴板复制与粘贴边界

以 #444 合并后的 `master`（`07dc973d`）为基线，继续统计全部 ECS 源文件。
新增 14 项剪贴板行为测试，覆盖 Async Clipboard API、ClipboardEvent 和
`execCommand` 的复制回退，读取权限错误、HTML 图片粘贴、合成粘贴事件及
图片 MIME 类型识别。测试复现并修复了模块加载后才出现 Clipboard API 时
复制仍使用旧路径的问题，以及合成粘贴事件把图片文件追加到调用方数组的问题。

将 `utils/clipboard.ts` 的模块门槛提高到 **90% 语句、80% 分支、95% 函数、
90% 行**。完整原生 ECS 回归 **273 个文件、2871 项测试**全部通过，
用时约 1151.4 秒，统计范围仍为 **427 个 ECS 源文件**。运行前后 824 个
ECS 源码、测试、配置及快照输入哈希一致；全部 72 项模块门槛通过。
ECS CJS/ESM 构建、TypeScript、ESLint、26 项 tooling、Markdown lint、
改动测试和 changeset 格式及 diff 检查通过。

按 Coveralls 的行与分支合计口径，本地全包由 **81.321%** 提升至
**81.521%**（约 +0.199 个百分点）；线上数值仍需 CI 上传确认。
完整报告新增覆盖 62 行、23 个分支；剪贴板模块的分支分母减少 1 个。

| 指标       |                  基线 |          本批完整结果 |
| ---------- | --------------------: | --------------------: |
| 行覆盖率   | 84.52%（24370/28833） | 84.73%（24432/28833） |
| 语句覆盖率 | 84.31%（25516/30262） | 84.52%（25580/30262） |
| 分支覆盖率 | 74.83%（10638/14216） | 74.99%（10661/14215） |
| 函数覆盖率 |   82.22%（3201/3893） |   82.30%（3204/3893） |

`utils/clipboard.ts` 的行覆盖率由 **54.36%（81/149）** 升至
**95.97%（143/149）**，分支由 **52.70%（39/74）** 升至
**84.93%（62/73）**，函数由 8/11 升至 11/11。

```sh
pnpm exec jest -c jest.ecs.config.js --runInBand --runTestsByPath \
  __tests__/ecs/clipboard.spec.ts
pnpm test:ecs
```

## 后续顺序

属性同步、交互拆分、三维 gizmo 编辑、同步去重及 GPU 缓存已建立回归基线。后续优先：

1. **继续补 ECS 低覆盖行为**：按完整报告的未覆盖行和分支排序，优先补 API/Select 的剩余编辑边界，以及网格管线中的可独立验证行为；每轮补真实输入与撤销、取消、资源失效断言，并单独报告全包提升。
2. **资源和渲染剩余路径**：文本/独立描边的空间滤镜、完整 WebGPU 管线及动画导出输入复用；路径后续关注大规模复合轮廓的三角化成本。动画导出的后续方向是确定的视频时间戳和 WebGPU 读回验证。
   纯计算用单测，像素和浏览器能力用真实渲染回归。
3. **三维交互后续**：检查选中时 gizmo 的 uniform 上传与悬停命中开销，为进一步缓存建立失效条件和真实交互回归。

每轮同时关注行、分支、函数覆盖率与测试耗时。新增浏览器用例不会自动计入当前
Jest/Coveralls 报告；核心算法应尽量有快速、可独立执行的行为测试。
