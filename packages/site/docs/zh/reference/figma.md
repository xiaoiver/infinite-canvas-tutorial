---
outline: deep
---

# Figma

该插件可将 Figma 文件导入画布场景图，也能将场景导出回 Figma。`.ic` 的
`SerializedNode` 模型本身就与 Figma 对齐（多层 `fills` / `strokes`、图层
`blendMode`、`opacity`、内 / 外阴影、`filter`，以及组件 / 实例），因此该插件主要是
节点树映射，而非新增数据模型。

## 导入与导出是非对称的

Figma 的 `.fig` 二进制格式是私有的，且 **Figma REST API 对文档内容是只读的**。因此：

-   **导入（Figma → `.ic`）** 推荐上传本地 `.fig`（Figma **File → Save local copy**
    导出）；也可在无界面环境下用 REST API + 个人访问令牌拉取云端文件。
-   **导出（`.ic` → Figma）** 无法通过 REST 完成。插件会生成一份 JSON 负载，由配套的
    “Infinite Canvas Import” Figma 插件通过 Figma Plugin API 重放。

## 从 `.fig` 文件导入（推荐）

`.fig` 是 ZIP 包，内含 Kiwi 编码的 `canvas.fig` 与 `images/*` 等资源。包内通过
[openfig-core](https://github.com/OpenFig-org/openfig-core) 解析，再由
`fig-to-figma.ts` 转成与 REST 响应同形的节点树，最后走统一的 `figma-to-ic` 映射。

```ts
import { parseFigFileToSerializedNodes } from '@infinite-canvas-tutorial/figma';

const bytes = new Uint8Array(await (await fetch('/design.fig')).arrayBuffer());
const doc = parseFigFileToSerializedNodes(bytes);
api.importIcDocument(doc);
```

在应用中可使用顶部导航栏 **Import from… → Figma (.fig)** 打开文件选择器。

`fig-to-figma` 转换要点：

-   **多层填充顺序**：`.fig` 的 `fillPaints` 按 Figma 面板自上而下排列；`.ic` 自下而上叠放，导入时会 `reverse()`。
-   **渐变**：`stops` → `gradientStops`；paint `transform` 经 `resolveGradientGeometry` 转为
    `gradientHandlePositions`（线性 / 径向方向与 Figma 一致）。
-   **图片填充**：ZIP 内 `images/<sha1>` 转为 data URL，按 `imageRef` 写入 `fills`。
-   **矢量**：`resolveVectorNodePaths` 生成 `fillGeometry` / `strokeGeometry` 路径。
-   **Auto-layout**：`stackMode` / `stackSpacing` / padding / 对齐 / hug 尺寸等映射为
    `display: 'flex'` 与 Yoga 布局字段；子项 `stackChildPrimaryGrow`、`stackChildAlignSelf`、
    `stackPositioning: ABSOLUTE` 映射为 `flexGrow`、`alignSelf`、`position: 'absolute'`。
    Grid auto-layout 暂不支持。

## 从 REST API 导入（可选）

```ts
import {
    FigmaRestClient,
    parseFigmaFileToSerializedNodes,
} from '@infinite-canvas-tutorial/figma';

const client = new FigmaRestClient({ token: '<个人访问令牌>' });
const file = await client.getFile('https://www.figma.com/file/<key>/<name>');
const imageRefUrls = await client.getImageFills('<key>');

const doc = parseFigmaFileToSerializedNodes(file, { imageRefUrls });
api.importIcDocument(doc);
```

云端文件的图片填充需通过 `getImageFills` 解析 URL；本地 `.fig` 则使用包内嵌入图片。

## 导出到 Figma

```ts
import { serializedNodesToFigmaScene } from '@infinite-canvas-tutorial/figma';

const doc = api.exportIcDocument();
const scene = serializedNodesToFigmaScene(doc.elements, doc.source);
// 将 `scene` 保存为 JSON，再粘贴到配套的 Figma 插件中。
```

在应用中使用 **Export to… → Figma (.json)** 下载场景负载，然后在 Figma 中运行配套插件
（见 `packages/plugin-figma/figma-plugin`），粘贴 JSON 即可重建节点。

## 映射关系

| Figma                                                                | `.ic` `SerializedNode`                |
| -------------------------------------------------------------------- | ------------------------------------- |
| `FRAME` / `SECTION` / `COMPONENT` / `COMPONENT_SET`                  | `rect`（裁剪使用 `clipMode: 'clip'`） |
| `GROUP`                                                              | `g`                                   |
| `INSTANCE`                                                           | 引用组件 id 的 `ref`                  |
| `RECTANGLE` / `ROUNDED_RECTANGLE`                                    | `rect`（`cornerRadius`）              |
| `ELLIPSE`                                                            | `ellipse`                             |
| `VECTOR` / `STAR` / `LINE` / `REGULAR_POLYGON` / `BOOLEAN_OPERATION` | `path`                                |
| `TEXT`                                                               | `text`                                |
| Auto-layout（`HORIZONTAL` / `VERTICAL`）                             | `display: 'flex'` + Yoga 布局属性     |
| 图片填充                                                             | `fills[] { type: 'image' }`           |
| 线性 / 径向渐变填充                                                  | `fills[] { type: 'gradient' }`        |

Paint 映射为 `fills` / `strokes`；`DROP_SHADOW` / `INNER_SHADOW` 映射为内 / 外阴影
属性；`LAYER_BLUR` / `BACKGROUND_BLUR` 映射为 CSS `filter`；图层 / paint 的
`blendMode` 映射为 `.ic` 混合模式；`opacity` 映射为节点 `opacity`；约束信息会以
`data-figma-constraint-*` 属性形式保留。

## 暂不支持（首版）

Grid auto-layout、原型 / 交互、蒙版、角向 / 菱形渐变的精确还原，以及超出扁平化几何的布尔运算。
