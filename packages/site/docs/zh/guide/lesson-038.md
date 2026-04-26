---
outline: deep
description: ''
---

<script setup>
import IconLucide from '../../components/IconLucide.vue'
import IconButton from '../../components/IconButton.vue'
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

## 组件化生成 {#components-and-slots}

`.pen` 的 ref + descendants 系统本质上是一种面向 AI 的组件继承机制。这样 AI 就不需要理解"圆角矩形 + 文本 + 内边距"的底层构成。它只需引用设计系统已有的 round-button 组件，并覆盖文本内容。这类似于代码中的继承+覆盖。

```json
{
    "type": "ref",
    "ref": "round-button",
    "descendants": { "label": { "content": "Save" } }
}
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

## Design ↔ Code {#design-to-code}

[Design ↔ Code]

## 扩展阅读 {#extended-reading}

[Variables and Themes]: https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
[Guide to variables in Figma]: https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma
[Using CSS custom properties (variables)]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
[Design ↔ Code]: https://docs.pencil.dev/design-and-code/design-to-code
[课程 33 - 布局引擎]: /zh/guide/lesson-033
[IconifyJSON]: https://iconify.design/docs/types/iconify-json.html
[Iconify Icon web component]: https://iconify.design/docs/iconify-icon/
[Lucide]: https://lucide.dev/icons
