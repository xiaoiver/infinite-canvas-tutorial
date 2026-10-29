---
title: Design to Code 导出细节参考
outline: deep
---

# Design to Code 导出细节参考

本页整理导出规则和边界。返回[第 38 课](/zh/guide/lesson-038#design-to-code)查看 API 与可交互示例。

## 概念映射

| `.ic` 概念                                          | 代码产物                                              |
| --------------------------------------------------- | ----------------------------------------------------- |
| `rect`/`g` + `display: flex`                        | `<div>` + flex 工具类（`flex items-center …`）        |
| Flex 方向、对齐、尺寸、间距和内边距                 | Tailwind flex 工具类 / CSS                            |
| `cornerRadius` / `fills` / `strokes` / `dropShadow` | `rounded-* / bg-* / border / shadow-*`                |
| 带图片填充的 `rect`                                 | `<img src>` 与 `object-fit` / `object-position`       |
| 单层 CSS 渐变填充的 `rect`                          | CSS `background-image`                                |
| `ellipse`                                           | CSS `border-radius: 50%`                              |
| 带纯色填充与描边的叶子 `path`                       | 保留矢量轮廓的内联 SVG `<path>`                       |
| 带纯色描边的叶子 `line` / `polyline`                | 保留开放线段的内联 SVG `<path>`                       |
| `rect` / `ellipse` + `clipMode: clip`               | 在裁剪元素上使用 CSS `overflow: hidden`               |
| `rotation` / `scaleX` / `scaleY`                    | 围绕局部左上角的 CSS `transform`                      |
| 节点级 `blendMode`                                  | CSS `mix-blend-mode`                                  |
| `visibility: hidden` / `visible`                    | CSS 可见性，保留布局空间                              |
| `text` + `content`                                  | 文本节点；已定义的 `$token` → 当前文本值              |
| 文本装饰的线条、样式、颜色与粗细                    | CSS `text-decoration`                                 |
| `fontVariant` / `fontKerning`                       | CSS `font-variant` / `font-kerning`                   |
| `wordWrap` / `wordWrapWidth`                        | `white-space`、`overflow-wrap` 与 `max-width`         |
| `maxLines` / `textOverflow`                         | CSS 多行省略（`ellipsis`）或按行高裁剪（`clip`）      |
| `iconfont`（lucide）                                | `lucide-react` `<Search />`                           |
| `iconfont`（其他族）                                | `@iconify/react` `<Icon icon="family:name" />`        |
| `$color.bg` 变量                                    | `bg-[var(--color-bg)]`（css-var）/ 字面量（resolved） |
| `reusable` 根                                       | 一个 React 组件定义                                   |
| `ref` + `descendants` 覆盖                          | 组件实例 + props                                      |
| `name`                                              | 组件名 / prop 名 / class 名                           |

## 组件属性

在 `componentStructure: 'preserve'`（默认，也是 Pencil 的卖点）下，每个 `reusable` 根会成为一个组件，每个 `ref` 成为一次实例调用。各实例上出现过的可覆盖属性（`content`、`fills`、包括 `fontVariant` 和 `fontKerning` 的排版属性、文本装饰、`opacity`、`visibility`、`cornerRadius`、显式 `width` / `height`、`minWidth` / `maxWidth` / `minHeight` / `maxHeight`、`padding`、`margin`、flex 间距、`flexDirection`、`alignItems`、`justifyContent`、`flexWrap`、`alignSelf`、`flexGrow`、`flexShrink`、`flexBasis`、`strokeWidth`、`strokes` 和投影字段）会被提升为 props，默认值取自模板。

`.ic` 中数值型 `lineHeight` 表示像素高度，因此 React 导出会补 `px`，不会将其当成无单位的行高倍率。布尔型 `fontKerning` 会转为 CSS 的 `normal` 或 `none`。

四边间距数组会转为 CSS 简写字符串，文本装饰字段会合并为一个参数，投影字段会合并为一个 `boxShadow` prop。装饰线粗细为 0 时导出 `none`，与画布语义一致。

## 文本

未显式设置 `lineHeight` 时，文本导出使用无单位的 `1.2` 行高，使浏览器的 flex 间距接近画布的文本测量结果；显式设置的数值行高仍以像素导出。`white-space: pre` 会保留显式换行。开启 `wordWrap` 且 `wordWrapWidth` 为正数时，会使用 `pre-wrap`、`overflow-wrap: anywhere`，并把该宽度作为最大宽度。正数 `maxLines` 会为默认的 `ellipsis` 添加 CSS 多行省略，为 `clip` 添加按行高裁剪。已开启换行的可复用文本如果只修改换行宽度，会生成组件 prop；切换换行开关或修改截断配置则会展开实例，以匹配编辑后的布局。当前画布测量尚未应用 `whiteSpace` 属性；自定义 `textOverflow` 标记字符串尚无对应的标准 CSS 实现。

## 图片与填充

对于可复用图片，仅修改图片 URL 时，实例的 `fills` 覆盖会绑定到组件的 `<img src>` 参数。修改填充类型、适配方式、位置或填充透明度时，实例会展开，使生成的元素与样式对应编辑结果。没有子节点的单层图片会在 `<img>` 上合并填充透明度与节点整体透明度。单层图片填充的椭圆会导出为圆角 `<img>`。带子节点的图片填充矩形和椭圆会使用定位容器，将装饰性 `<img>` 放在子节点后方；容器承担节点整体透明度，图片承担填充透明度、适配方式和位置。

矩形只有一层启用的 CSS 线性、径向或锥形渐变填充时，会导出为 CSS `background-image`。实例仅修改渐变值时会生成组件参数。

矩形和椭圆的多层纯色、受支持的渐变、图片或图案填充会按绘制顺序导出为叠加的背景；单层图案也会导出为 CSS 背景。画布的 `conic-gradient(circle at …)` 语法会转换为 CSS 的 `conic-gradient(at …)`。

图片层支持 `fill`、`contain`、`cover`、`none`、`scale-down` 和定位，并让子元素处于涂料上方。图案会保留原始平铺尺寸及重复模式。

需要独立透明度、`scale-down` 或受支持 2D 图案变换时，代码生成器会在子元素下方创建独立裁剪的装饰层；有 CSS 对应模式的图层混合仍限定在填充栈内。尺寸明确的矩形和椭圆支持图案的 `matrix`、`translate`、`scale`、`rotate`、`skewX` 和 `skewY` 变换；画布也会解码 URL 图案并应用变换。

可复用实例修改填充栈或图案时会展开。其他渐变格式、不支持的图案变换语法，以及 `linearBurn`、`linearDodge` 等没有 CSS 对应模式的混合效果仍需单独处理。

单层纯色填充的透明度会通过 CSS `color-mix` 导出，不会连同子元素一起变淡。节点整体透明度仍使用独立的 CSS `opacity`。可复用实例修改半透明填充时会展开，以保留生成样式中的填充透明度。

## 变换与布局

节点旋转（弧度）与 `scaleX` / `scaleY` 会导出为以 `0 0` 为原点的 CSS `rotate(...) scale(...)`，顺序与画布局部变换一致。实例修改变换后会展开，以包含修改后的几何效果。

非 flex 容器中的子节点会把画布局部 `x` / `y` 导出为相对于容器的 CSS `left` / `top`；flex 子节点仍按正常 flex 流布局。Yoga 默认的 `flexShrink` 为 `0`，因此节点未指定其他值时，导出会设置 `flex-shrink: 0`。非 flex 容器里的复用组件实例会增加定位包装元素，修改实例内部子节点的位置时则展开实例以保留编辑。多个顶层节点都有明确尺寸时，导出代码还会创建相对定位的外框，保留它们之间的间距，包括旋转和翻转后的边界。尺寸无法测量的顶层节点仍按普通文档流排列。

节点级 `visibility` 会导出为 CSS `visibility`，隐藏节点仍占据布局空间。默认的 `inherited` 状态对应 CSS 继承。复用组件实例及其子节点修改可见性时，会生成组件参数。

## 矢量图形

有有效 `d` 数据的 Path 会导出为内联 SVG。Path 带子节点时，SVG 会放在定位容器的底层，同时保留子节点的局部坐标和矢量轮廓。

由纯色、线性或径向渐变、图片构成的多层填充，会按画布顺序导出为独立 SVG path，并保留各层透明度。具有 CSS 对应模式的混合效果会应用在隔离的 SVG 分组中，仅与下方填充层混合。

上述涂料类型的多层描边会保留各层涂料、透明度、线形／三角形／菱形端点标记、填充规则、宽度、端帽、连接、斜接限制和虚线参数。Path、Line 和 Polyline 会共用描边几何，按画布顺序逐层导出，并支持有 CSS 对应模式的描边层混合。

闭合 Path 的内侧或外侧对齐会对每一层应用裁剪或遮罩；开放路径仍按居中描边导出。渐变和图片涂料会跟随 Path 视口。

Path 图片填充支持 `fill`、`contain`、`cover`、`none`、`scale-down`，也支持中间百分比定位。常见的 `fill`／`contain`／`cover` 对齐使用 SVG 图案；其他适配和定位会导出裁剪的 SVG `foreignObject`，并由 CSS `object-fit`／`object-position` 控制。

图片描边在 `fill`、`contain`、`cover` 且各轴定位为 0%、50%、100% 时仍使用 SVG 图案。单层图片描边采用其他适配方式或定位时，会通过定位的 HTML 图片和 SVG 几何遮罩导出，在 Chromium 和 WebKit 中保留端帽、连接、端点标记及内外侧对齐。

采用这些适配方式或定位的多层图片描边也会与 SVG 描边层一起保留画布绘制顺序、受 CSS 支持的混合模式、透明度和端点标记。导出代码中的图片应使用持久 URL 或 data URL。

投影会跟随 SVG 图形轮廓，不会给 Path 的子节点重复加阴影。复用实例修改 Path 的填描、几何、标记、描边对齐或投影时会展开实例，确保 SVG 对应编辑结果。

`linearBurn` 与 `linearDodge` 等没有 CSS 对应模式的混合效果、锥形与网格渐变及其他滤镜仍需单独实现。

没有子节点的 Line 与 Polyline 复用同一套 SVG 导出：局部端点或点列表会转换为无填充的开放路径。SVG 视口会跟随几何的局部原点，并让零宽或零高的轴居中，因此偏移的 Path、细水平线和竖线也能正常显示。描边支持单层启用的纯色、线性渐变、径向渐变或图片涂料。线形、三角形和菱形箭头会使用局部 SVG 标记，并跟随描边涂料。复用实例修改线段几何、描边或标记时也会展开。其他线条效果仍需单独实现。

矩形和椭圆的 `clipMode: clip` 会在导出的 HTML 和 React 代码中裁剪子内容。圆角矩形保留圆角，椭圆使用 `border-radius: 50%`。复用实例修改裁剪模式时会展开实例以保留该修改。`erase` 和 `soft` 蒙版无法直接映射为 CSS `overflow`，暂不作为裁剪导出。

## 混合模式

节点级 `blendMode` 会导出为 CSS `mix-blend-mode`；实例修改它时也会生成组件参数。`light` 对应 CSS 的 `lighten`；没有 CSS 等价物的模式与 SVG 导出一致，按 `normal` 处理。填充层自身的 `blendMode` 用于该节点内部的多层填充合成，不会作为节点级 `mix-blend-mode` 导出。

## 实际界面示例

第 38 课的示例将运营数据面板、SaaS 定价页和移动端结账页加载到 **IC 编辑器画布**中。三份设计都包含嵌套 flex 布局与语义化颜色变量；结账页采用 390 × 844 的窄屏画板。你可以在画布中选中、修改节点，再从画布当前文档通过 `API.exportCode` 更新、复制或下载代码；选择 HTML/CSS 后，点击 **HTML 预览** 可在沙箱窗口中按画板尺寸查看生成的页面。切换示例会载入另一份可编辑设计。

这些示例在调用 `API.exportCode` 时按节点 ID 传入 `semanticElements`，让部分画布矩形和文字在两种导出结果中变成 HTML 页面区域、标题与 `<button type="button">` 控件。这份映射属于示例的导出配置；按钮行为和导航仍需在应用中接入。

定价页使用一个 `reusable` 套餐卡片模板和三个 `ref` 实例。编辑器会展开实例以便渲染和编辑；此示例会把文字、颜色、排版与文本装饰、透明度、显式尺寸与尺寸约束、间距、Flex 对齐与子项尺寸、纯色描边和投影修改还原为实例覆盖项，供 React 与 `.ic` 下载使用。Growth 卡片展示了强调色描边。数值型 `flexBasis` 和尺寸约束在 HTML/CSS 和 React 样式中按像素输出。若卡片结构或不支持的属性被修改，导出会使用展开后的节点，让结果继续与画布一致。

这三个示例的 React 导出也会在 React 19 与 Tailwind CSS 4 环境中运行浏览器测试，并将关键文字位置与 HTML 预览对照，防止生成器改动破坏实际渲染。

下载 `.ic` 文件后，可在[在线应用](https://app.infinitecanvas.cc/)中通过 **Import from… > .ic** 继续编辑设计。下载 HTML 文件后可直接用浏览器打开。选择 **下载 React 工程** 可从当前画布获取包含 Vite、React 19 和 Tailwind CSS 4 的 ZIP。解压后执行 `pnpm install` 和 `pnpm dev` 即可运行，导出的组件位于 `src/App.tsx`；设计使用 Inter 时，工程会在构建时打包字体文件。当前画布使用的临时 `blob:` 图片会复制到 `public/assets`，代码改用本地路径；data URL 继续内联，远程 URL 保持原样。工程中的 `src/responsive.css` 为这三个示例提供窄屏布局，`src/App.tsx` 仍保留画板尺寸。也可以只下载 `.tsx` 文件，放入现有项目。目前生成的是展示层代码；导航、结账动作、支付及实时数据仍需在应用中接入。
