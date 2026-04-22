---
outline: deep
description: ''
---

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

Pencil 支持

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

## Design ↔ Code {#design-to-code}

[Design ↔ Code]

## 扩展阅读 {#extended-reading}

[Variables and Themes]: https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
[Guide to variables in Figma]: https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma
[Using CSS custom properties (variables)]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
[Design ↔ Code]: https://docs.pencil.dev/design-and-code/design-to-code
[课程 33 - 布局引擎]: /zh/guide/lesson-033
