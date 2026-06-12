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

-   **导入（Figma → `.ic`）** 使用 REST API，配合
    [个人访问令牌](https://www.figma.com/developers/api#access-tokens)，可在无界面环境下完成。
-   **导出（`.ic` → Figma）** 无法通过 REST 完成。插件会生成一份 JSON 负载，由配套的
    “Infinite Canvas Import” Figma 插件通过 Figma Plugin API 重放。

## 从 Figma 导入

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

在应用中也可使用顶部导航栏的 **Import from… → Figma**，它会提示输入文件 key（或 URL）
和个人访问令牌。

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

| Figma                                                                | `.ic` `SerializedNode`                         |
| -------------------------------------------------------------------- | ---------------------------------------------- |
| `FRAME` / `GROUP` / `SECTION`                                        | `g`（裁剪型 frame 使用 `clipMode: 'clipBox'`） |
| `COMPONENT` / `COMPONENT_SET`                                        | 带 `reusable: true` 的 `g`                     |
| `INSTANCE`                                                           | 引用组件 id 的 `ref`                           |
| `RECTANGLE`                                                          | `rect`（`cornerRadius`）                       |
| `ELLIPSE`                                                            | `ellipse`                                      |
| `VECTOR` / `STAR` / `LINE` / `REGULAR_POLYGON` / `BOOLEAN_OPERATION` | `path`                                         |
| `TEXT`                                                               | `text`                                         |
| 图片填充                                                             | `fills[] { type: 'image' }`                    |

Paint 映射为 `fills` / `strokes`；`DROP_SHADOW` / `INNER_SHADOW` 映射为内 / 外阴影
属性；`LAYER_BLUR` / `BACKGROUND_BLUR` 映射为 CSS `filter`；图层 / paint 的
`blendMode` 映射为 `.ic` 混合模式；`opacity` 映射为节点 `opacity`；约束信息会以
`data-figma-constraint-*` 属性形式保留。

## 暂不支持（首版）

Auto-layout 细节、原型 / 交互、蒙版、渐变方向的精确还原，以及超出扁平化几何的布尔运算。
