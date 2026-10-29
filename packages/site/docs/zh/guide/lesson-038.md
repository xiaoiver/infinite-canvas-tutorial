---
outline: deep
description: '设计变量与主题、组件化生成和图标字体，以及从设计导出到代码的路径。'
---

<script setup>
import IconLucide from '../../components/IconLucide.vue'
import IconButton from '../../components/IconButton.vue'
import ComponentsInstances from '../../components/ComponentsInstances.vue'
import DesignToCodeInterfaces from '../../components/DesignToCodeInterfaces.vue'
</script>

# 课程 38 - 从设计到代码

## 变量与主题 {#variables-and-themes}

Pencil 支持完整的 Design Token 系统，支持多主题条件取值，详见：[Variables and Themes]。变量系统可以有效减少硬编码，AI 不需要生成具体的颜色值（减少 `#RRGGBB` 格式错误），也不需要理解设计系统的 token 映射。它只需引用语义化变量名，渲染引擎负责解析。

```ts
api.setAppState({
    variables: {
        'color.background': { type: 'color', value: '#FFFFFF' },
        'text.title': { type: 'number', value: 72 },
    },
});
api.updateNodes([
    {
        id: 'r1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 1,
        fill: '$color.background',
        stroke: '$color.background',
    },
]);
```

AI 为 dark mode 生成设计时，不需要输出两套颜色方案，只需引用 `$color.bg`，由节点的 `theme` 属性决定实际取值。

```json
"variables": {
  "color.bg": {
    "type": "color",
    "value": [
      { "value": "#FFFFFF", "theme": { "mode": "light" } },
      { "value": "#000000", "theme": { "mode": "dark" } }
    ]
  }
}
```

另外 AI 也不需要计算像素值或处理响应式断点。它用声明式语义描述意图，布局引擎自动计算几何。详见 [课程 33 - 布局引擎]

### 解析 {#parse}

Figma 支持以下四种类型的变量，详见：[Guide to variables in Figma]

-   Color `#000000`
-   Number
-   String 例如 `fontFamily` 或者文本内容
-   Boolean

![source: https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes](https://help.figma.com/hc/article_attachments/30211233510039)

![source: https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections](https://help.figma.com/hc/article_attachments/26964398869143)

### 属性面板与变量选择器 {#property-panel-variable-picker}

选中节点后，在 Spectrum 属性面板中可以为**填充 / 描边颜色 / 线宽 / 字号**绑定 `AppState.variables` 里的设计变量：通过下拉选择变量名即可写入 `$token`；已绑定时会显示紫色徽标，并可一键**解除绑定**（写回当前解析后的字面量并记入历史）。取色器与线宽滑块始终按**解析后的值**展示，避免 `$...` 直接当作 CSS 颜色无效。

### 导出 SVG {#export-svg}

我们可以有多种导出策略，默认使用解析后的字面量：

```ts
export type DesignVariablesSvgExportMode =
    /** 解析 $ → 字面量 */
    | 'resolved'
    /** 保留 `$token` 字符串（属性可能非标准，适合再加工） */
    | 'preserve-token'
    /** `:root{--x:...}` + `fill="var(--x)"` 形式 */
    | 'css-var';
```

也可以使用 CSS variables 导出策略，会在 `:root` 中声明这些全局变量，便于在浏览器开发者工具中修改。详见：[Using CSS custom properties (variables)]

```html
<svg>
    <defs>
        <style>
            :root {
                --color-background: #2563eb;
                --color-stroke: red;
                --text-title: 72px;
            }
        </style>
    </defs>
    <rect
        fill="var(--color-background)"
        stroke="var(--color-stroke)"
        stroke-width="2"
        width="100"
        height="100"
        id="node-r1"
    />
</svg>
```

## icon {#icon}

icon 在生成 UI 时非常重要，例如 [Lucide] 已经在 React 组件生成中大规模使用了。Pencil 也支持这种内置图形：

```ts
export interface IconFont extends Entity, Size, CanHaveEffects {
    type: 'icon_font';
    /** Name of the icon in the icon font */
    iconFontName?: StringOrVariable;
    /** Icon font to use. Valid fonts are 'lucide', 'feather', 'Material Symbols Outlined', 'Material Symbols Rounded', 'Material Symbols Sharp', 'phosphor' */
    iconFontFamily?: StringOrVariable;
    /** Variable font weight, only valid for icon fonts with variable weight. Values from 100 to 700. */
    weight?: NumberOrVariable;
    fill?: Fills;
}
```

OpenPencil 的 iconLookup 是可注入的函数，这意味着：

-   灵活性：可以接入任何图标源（Iconify、Lucide、自定义）
-   AI 负担：AI 只需要输出 iconFontName: "SearchIcon"，具体路径由运行时解析

```ts
private drawIconFont(canvas, node, x, y, w, h, opacity) {
  const iconName = iNode.iconFontName ?? iNode.name ?? '';
  const iconMatch = this.iconLookup?.(iconName) ?? null;
  const iconD = iconMatch?.d ?? FALLBACK_ICON_D;  // SVG path data
  const iconStyle = iconMatch?.style ?? 'stroke';   // stroke or fill

  // 解析 SVG path → Skia Path → 缩放适配 → 绘制
}
```

我们的定义如下：

```ts
export interface IconFontAttributes {
  /** 图标在字体族中的名称 */
  iconFontName?: StringOrVariable;
  /**
   * 字体族。例如：'lucide'、'feather'、'Material Symbols Outlined'、'phosphor' 等。
   */
  iconFontFamily?: StringOrVariable;
}

export interface IconFontSerializedNode
  extends BaseSerializeNode<'iconfont'>,
  Partial<IconFontAttributes>;
```

### 动态注册 icon 信息 {#register-icon-at-runtime}

我们使用 [IconifyJSON] 提供的 icon 类型，可以在运行时动态引入 Lucide、Material 等图标库，它提供了包含图标 SVG 的 JSON：

```ts
import { registerIconifyIconSet } from '@infinite-canvas-tutorial/ecs';

const m = await import('@iconify/json/json/lucide.json');
registerIconifyIconSet('lucide', m);
```

图标正文支持单引号或双引号的 SVG 属性。路径、矩形、圆、椭圆和线段既可以使用
自闭合标签，也可以使用显式闭合标签；嵌套 `<g>` 的填充和描边属性会传给子图形。

然后我们就可以将图标 JSON 转换成我们的场景图表示，例如下面的 Search 图标会被解析成一个 `Group` 父节点，拥有一个 `Path` 和 `Circle` 子节点，这部分和之前将 SVG 元素转换成我们的图形表示几乎一模一样：

```json
"search": {
    "body": "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m21 21l-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></g>"
}
```

当然我们需要将宽高、`strokeWidth` 映射到转换后的场景图上：

```ts
function buildIconFontScalablePrimitives(
    iconFontName: string,
    iconFontFamily: string,
    targetWidth: number,
    targetHeight: number,
): ScaledIconPrimitive[] {}
```

<IconLucide />

### 在图层列表中展示 {#display-in-layer-panel}

Iconify 也提供了开箱即用的 Webcomponents 组件用于展示，详见：[Iconify Icon web component]。这样我们就可以在图层列表项目的缩略图中展示了：

```ts
import 'iconify-icon';

if (this.node.type === 'iconfont') {
    const iconName = this.#normalizeIconifyName(
        this.node as IconFontSerializedNode,
    );
    thumbnail = iconName
        ? html`<iconify-icon icon=${iconName}></iconify-icon>`
        : html`<sp-icon-group></sp-icon-group>`;
}
```

### 导出 SVG {#export-icon-to-svg}

### 结合布局渲染组件 {#render-component-with-layout}

结合 [课程 33 - 布局引擎] 我们就可以实现带有 icon 的 Button 了：

```ts
const button1 = {
    id: 'icon-button',
    type: 'rect',
    fill: 'grey',
    display: 'flex',
    width: 200,
    height: 100,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    cornerRadius: 10,
    gap: 10,
} as const;

const searchIcon = {
    id: 'icon-button-search',
    parentId: 'icon-button',
    type: 'iconfont',
    iconFontName: 'search',
    iconFontFamily: 'lucide',
};

const text = {
    id: 'icon-button-text',
    parentId: 'icon-button',
    type: 'text',
    content: 'Button',
};
```

<IconButton />

我们想像 [Shadcn UI] 一样支持不同变体的 Button 组件，可以减少大量样板代码：

```tsx
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
```

## 组件化生成 {#components-and-slots}

`.pen` 的 ref + descendants 系统本质上是一种面向 AI 的组件继承机制。这样 AI 就不需要理解"圆角矩形 + 文本 + 内边距"的底层构成。它只需引用设计系统已有的 round-button 组件，并覆盖文本内容。这类似于代码中的继承+覆盖。详见：[Components and Instances]

```json
{
    "id": "round-button",
    "type": "g",
    "reusable": true,
    "cornerRadius": 9999,
    "children": [
        {
            "id": "label",
            "type": "text",
            "content": "Submit",
            "fill": "#000000"
            ...
        }
    ]
}

{
    "id": "save-round-button",
    "type": "ref",
    "ref": "round-button",
    "descendants": { "label": { "content": "Save" } }
}
```

<ComponentsInstances />

## Design ↔ Code {#design-to-code}

[Design ↔ Code]

| 产品           | 核心策略               | 工程实现                                                                        |
| -------------- | ---------------------- | ------------------------------------------------------------------------------- |
| **OpenPencil** | 规则引擎 + 增量管道    | `pen-codegen` 包提供确定性转换，`codegen_plan/submit/assemble/clean` 处理大文件 |
| **Pencil.dev** | AI 自由生成 + 双向同步 | `.pen` 文件作为上下文，AI 直接输出代码，支持 Code → Design 反向导入             |

[Design ↔ Code] 的核心洞察是：design-to-code **不是**「像素 → 代码」的 AI 猜测。由于 `.ic` 格式已经内置了对代码友好的原语——flex 布局、设计变量、`reusable`/`ref` 组件、语义命名、图标字体——场景图本身**就是**一份为代码而设计的 IR。因此核心是一个**确定性转译器**，AI 仅在命名/结构清理这一层锦上添花。

### 管线 {#design-to-code-pipeline}

我们仿照 SVG 导出管线，但额外插入一层框架无关的 **Code IR**，这样新增目标框架只需再写一个 emitter：

```text
.ic SceneGraph
  → expandRefSerializedNodes   // 复用现有的 ref/reusable 处理
  → CodeIR                     // 元素树 + 结构化样式 + 变量引用 + 组件定义
  → Emitter                    // react-tailwind | html-css | ...
```

Code IR 节点保留：**角色**（容器 / 文本 / 图标 / 图片 / 形状）、**解析前的 `$token` 引用**、结构化的 **flex 样式**，以及 `reusable`/`ref` 的**组件关系**。

### 入口 {#design-to-code-entry}

`API.exportCode` 与 `renderToSVG` 对称：不传参时转译整个场景，传入节点则转译选区。

```ts
const code = api.exportCode(undefined, {
    framework: 'react-tailwind', // 或 'html-css'
    variablesMode: 'css-var', // 'resolved' | 'preserve-token' | 'css-var'
    componentStructure: 'preserve', // 'preserve' | 'flatten'
});
```

也可以直接调用纯函数：

```ts
import { serializedNodesToCode } from '@infinite-canvas-tutorial/ecs';

const code = serializedNodesToCode(nodes, {
    framework: 'react-tailwind',
    variables,
});
```

### 概念映射 {#design-to-code-mapping}

画布节点会按用途转换为布局、文本、图片或矢量元素，例如：

| 画布内容           | 代码产物                       |
| ------------------ | ------------------------------ |
| Flex 容器          | HTML 容器与 flex 样式          |
| 文本、图片         | 文本节点与 `<img>`             |
| Path、Line         | 保留轮廓的内联 SVG             |
| `reusable` / `ref` | React 组件与实例               |
| 设计变量           | 字面量、CSS 变量或保留的 token |

[查看完整概念映射](/zh/guide/design-to-code-reference#概念映射)。

### 变量模式 {#design-to-code-variable-modes}

三种变量模式与 SVG 导出语义保持一致：

-   `resolved`（默认）：把 `$token` 解析为字面量（如 `bg-[#FFFFFF]`）。
-   `css-var`：样式输出 `var(--token)`（如 `bg-[var(--color-bg)]`）。HTML/CSS 导出包含 `:root { … }` 块；React 为每个导出组件限定变量作用域，单独渲染可复用组件时也有效。嵌套实例共用父组件的作用域，因此多个导出组件可以对同一个 token 使用不同的值。CSS 自定义属性不能替换文本节点，所以文本内容变量会解析为当前值。
-   `preserve-token`：保留 `$token`（写入 inline `style`，便于再加工）。

### 组件与实例 {#design-to-code-components}

默认的 `componentStructure: 'preserve'` 会把 `reusable` 根节点导出为 React 组件，把 `ref` 导出为组件实例。可覆盖的文字、样式和布局属性会成为 props；无法用组件参数表达的修改会展开实例，保留画布效果。

文本、图片、渐变、图案、Path、裁剪和混合模式各有导出规则，详见 [Design to Code 导出细节参考](/zh/guide/design-to-code-reference)。

```tsx
interface RoundButtonProps {
    label?: string;
}

export function RoundButton({ label = 'Submit' }: RoundButtonProps) {
    return (
        <div className="flex items-center justify-center w-[120px] h-[40px] rounded-[9999px]">
            <span>{label}</span>
        </div>
    );
}

export function Design() {
    return <RoundButton label="Save" />;
}
```

`componentStructure: 'flatten'` 是回退方案：通过 `expandRefSerializedNodes` 把每个实例展开为具体 DOM，不产出组件定义。HTML/CSS emitter 始终扁平化，因为 HTML 没有组件概念。

### 可用于实际界面的示例 {#practical-interface-examples}

在 IC 编辑器画布中试用数据面板、SaaS 定价页和移动端结账页：选中并编辑节点，再从当前画布生成、复制或下载代码。选择 HTML/CSS 后可使用 **HTML 预览**；切换示例会加载另一份可编辑设计。

定价页使用可复用的套餐卡片。示例也通过 `semanticElements` 将部分节点导出为标题、页面区域和按钮。

<DesignToCodeInterfaces locale="zh" />

下载 `.ic` 可在[在线应用](https://app.infinitecanvas.cc/)继续编辑；HTML 可直接用浏览器打开。选择 **下载 React 工程** 后，解压并执行 `pnpm install` 和 `pnpm dev`，或下载 `.tsx` 文件接入现有项目。生成的是展示层，导航、支付和实时数据需要自行接入。图片、响应式布局和实例覆盖的详情见 [导出细节参考](/zh/guide/design-to-code-reference#实际界面示例)。

### 反向：code → design {#design-to-code-reverse}

反向（把 JSX/HTML AST 解析回 `.ic` 节点）更难、歧义也更多，故作为二期。建议先实现本转译器产出代码的**幂等回环**（design → code → design 不丢信息），再扩展到任意手写代码。

### JSON 格式文件 {#json-file}

在 [课程 10 - 图片导入导出] 中我们介绍了如何将图形导出成各种图片格式。在与 AI 交互的过程中，我们需要始终将场景持久化到文件中。在 Figma 中我们可以导入导出 `.fig` 文件，详见：[Import files to the file browser] 与 [Save a local copy of files]

参考 excalidraw 与 pencil 的自定义文件格式，我们也可以设计自己的 JSON 文件，格式为 `.ic`：

```json
{
    "type": "infinite-canvas",
    "version": 1,
    "source": "https://infinitecanvas.cc",
    "variables": {},
    "themes": {},
    "elements": [],
    "appState": {}
}
```

导入时会：删掉当前相机下所有场景根节点，再合并默认 AppState 与文件中的 appState，写入 variables / themes，并在删除完成后 updateNodes(elements)；选区里指向不存在节点的 id 会被过滤掉。

```ts
import {
    downloadIcDocument,
    stringifyIcDocument,
} from '@infinite-canvas-tutorial/ecs';

// 导出
const doc = api.exportIcDocument(window.location.origin);
downloadIcDocument(doc, 'my-scene.ic'); // 浏览器里触发下载

// 或自管字符串 / 文件
const text = stringifyIcDocument(doc);
// …写入 .ic 文件或上传

// 导入（可传入对象或 JSON 字符串）
api.importIcDocument(await (await fetch('/scene.ic')).text());
```

在 UI 中，顶部菜单提供了 `Export as... > .ic` 与 `Import from... > .ic`，后者会打开文件选择框读取 `.ic` 文件并调用 `api.importIcDocument`。

### 命令行 {#cli}

仓库还提供离线处理 `.ic` 文件的 CLI（需要 Node.js 20 或更新版本）。先在编辑器中通过 **Export as… > .ic** 导出设计，保存为 `design.ic`。然后在仓库根目录按依赖顺序构建并运行：

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @infinite-canvas-tutorial/device-api build:cjs
corepack pnpm --filter @infinite-canvas-tutorial/ecs build:cjs
corepack pnpm --filter @infinite-canvas-tutorial/cli build
node packages/cli/dist/cli.js validate design.ic
node packages/cli/dist/cli.js inspect design.ic --json
node packages/cli/dist/cli.js codegen design.ic --framework react-tailwind --variables-mode css-var --component-name Design --output Design.tsx
node packages/cli/dist/cli.js codegen design.ic --framework html-css --output design.html
```

`inspect --json` 会列出节点数、根节点、可复用节点、变量和资源 URL 数量。不传 `--output` 时，生成的代码写入标准输出；文档或参数错误会返回非零退出码并输出错误信息。CLI 生成的 React 组件或 HTML/CSS 片段与编辑器代码生成器一致，并使用文档里的变量和主题。它不会访问在线项目；无法跨浏览器进程使用的临时 `blob:` 图片会被拒绝。导出的文档应使用 data URL 或持久有效的图片 URL。

## 扩展阅读 {#extended-reading}

-   [pencil-design-skill]

[Variables and Themes]: https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
[Guide to variables in Figma]: https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma
[Using CSS custom properties (variables)]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
[Design ↔ Code]: https://docs.pencil.dev/design-and-code/design-to-code
[课程 33 - 布局引擎]: /zh/guide/lesson-033
[IconifyJSON]: https://iconify.design/docs/types/iconify-json.html
[Iconify Icon web component]: https://iconify.design/docs/iconify-icon/
[Lucide]: https://lucide.dev/icons
[Shadcn UI]: https://ui.shadcn.com/docs/components/radix/button
[Components and Instances]: https://docs.pencil.dev/for-developers/the-pen-format#components-and-instances
[pencil-design-skill]: https://github.com/chiroro-jr/pencil-design-skill
[课程 10 - 图片导入导出]: /zh/guide/lesson-010
[Import files to the file browser]: https://help.figma.com/hc/en-us/articles/360041003114-Import-files-to-the-file-browser
[Save a local copy of files]: https://help.figma.com/hc/en-us/articles/8403626871063-Save-a-local-copy-of-files
