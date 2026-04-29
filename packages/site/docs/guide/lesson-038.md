---
outline: deep
description: 'Design tokens, variables, themes, componentized generation, and icon font integration in Pencil. Export SVG, Iconify, and the path from design to code.'
---

<script setup>
import IconLucide from '../components/IconLucide.vue'
import IconButton from '../components/IconButton.vue'
import ComponentsInstances from '../components/ComponentsInstances.vue'
</script>

# Lesson 38 - From design to code

## Variables and themes {#variables-and-themes}

Pencil supports a full design token system with multi-theme conditional values. See [Variables and Themes]. Variables reduce hard-coding: the model does not need to emit specific color values (fewer `#RRGGBB` mistakes) or learn your design-system token table—it only needs semantic variable names, and the renderer resolves them.

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

When the model designs for dark mode, it does not need two full palettes—only references like `$color.bg`, while the node’s `theme` controls the resolved value.

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

The model also does not need to compute pixel values or wire responsive breakpoints. It states intent in a declarative way, and the layout engine computes geometry. See [Lesson 33 - Layout engine].

### Variable types {#variable-types}

Figma supports four variable kinds. See [Guide to variables in Figma]

-   Color (`#000000`)
-   Number
-   String, e.g. `fontFamily` or text content
-   Boolean

![source: https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes](https://help.figma.com/hc/article_attachments/30211233510039)

![source: https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections](https://help.figma.com/hc/article_attachments/26964398869143)

### Property panel and variable picker

With a node selected, the Spectrum property panel can bind design variables from `AppState.variables` to **fill / stroke color / stroke width / font size**: pick a name from the dropdown to write `$token`. When bound, a purple badge appears, and you can **unbind** in one action (write back the current resolved literal and record history). The color picker and stroke width slider always show **resolved** values, so raw `$...` is never used as an invalid CSS color.

### Export SVG

Several export strategies exist; the default is resolved literals:

```ts
export type DesignVariablesSvgExportMode =
    /** Resolve $ → literal */
    | 'resolved'
    /** Keep `$token` strings (attributes may be non-standard; good for post-processing) */
    | 'preserve-token'
    /** `:root{--x:...}` + `fill="var(--x)"` */
    | 'css-var';
```

You can also use the CSS variables mode: globals are declared under `:root` so you can tweak them in devtools. See [Using CSS custom properties (variables)]

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

## Icon

Icons matter when generating UIs. [Lucide] is already widely used in React code generation, and Pencil supports similar built-in graphics:

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

In OpenPencil, `iconLookup` is an injectable function, which means:

-   **Flexibility**: any icon source (Iconify, Lucide, custom)
-   **Model load**: the model only outputs `iconFontName: "SearchIcon"`; the runtime resolves paths

```ts
private drawIconFont(canvas, node, x, y, w, h, opacity) {
  const iconName = iNode.iconFontName ?? iNode.name ?? '';
  const iconMatch = this.iconLookup?.(iconName) ?? null;
  const iconD = iconMatch?.d ?? FALLBACK_ICON_D;  // SVG path data
  const iconStyle = iconMatch?.style ?? 'stroke';   // stroke or fill

  // Resolve SVG path → Skia path → scale → draw
}
```

Our definitions:

```ts
export interface IconFontAttributes {
  /** Name of the icon in the font family */
  iconFontName?: StringOrVariable;
  /**
   * Font family, e.g. 'lucide', 'feather', 'Material Symbols Outlined', 'phosphor', etc.
   */
  iconFontFamily?: StringOrVariable;
}

export interface IconFontSerializedNode
  extends BaseSerializeNode<'iconfont'>,
  Partial<IconFontAttributes>;
```

### Register icon at runtime {#register-icon-at-runtime}

We use the icon shape from [IconifyJSON] to load Lucide, Material, and other sets at runtime via JSON that includes SVG:

```ts
import { registerIconifyIconSet } from '@infinite-canvas-tutorial/ecs';

const m = await import('@iconify/json/json/lucide.json');
registerIconifyIconSet('lucide', m);
```

The icon JSON maps into our scene graph the same way as before: a Search icon becomes a `Group` with `Path` and `Circle` children, much like turning SVG into our shapes.

```json
"search": {
    "body": "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m21 21l-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></g>"
}
```

We also map width, height, and `strokeWidth` onto the converted graph:

```ts
function buildIconFontScalablePrimitives(
    iconFontName: string,
    iconFontFamily: string,
    targetWidth: number,
    targetHeight: number,
): ScaledIconPrimitive[] {}
```

<IconLucide />

### Display in the layer panel

Iconify ships Web Components for display. See [Iconify Icon web component]. We use them for thumbnails in the layer list:

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

### Export SVG

### Render with layout {#render-component-with-layout}

Together with the [Lesson 33 - Layout engine], you can build a button that includes an icon:

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

We want a `Button` with multiple **variants**—in the same spirit as [Shadcn UI]—so we do not have to write the same structure over and over:

```tsx
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
```

## Components and slots {#components-and-slots}

In `.pen` files, the `ref` + `descendants` system is, in effect, a component-inheritance model aimed at AI: the model does not have to understand the low-level stack (rounded rect + text + padding). It can point at an existing `round-button` in the design system and override the label. That is the same “inherit, then override” idea as in code. See [Components and Instances].

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

## Design ↔ code {#design-to-code}

[Design ↔ Code]

## Extended reading {#extended-reading}

[Variables and Themes]: https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
[Guide to variables in Figma]: https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma
[Using CSS custom properties (variables)]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
[Design ↔ Code]: https://docs.pencil.dev/design-and-code/design-to-code
[Lesson 33 - Layout engine]: /guide/lesson-033
[IconifyJSON]: https://iconify.design/docs/types/iconify-json.html
[Iconify Icon web component]: https://iconify.design/docs/iconify-icon/
[Lucide]: https://lucide.dev/icons
[Shadcn UI]: https://ui.shadcn.com/docs/components/radix/button
[Components and Instances]: https://docs.pencil.dev/for-developers/the-pen-format#components-and-instances
