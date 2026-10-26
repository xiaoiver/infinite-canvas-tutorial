---
outline: deep
description: 'Design tokens, variables, themes, componentized generation, and icon font integration in Pencil. Export SVG, Iconify, and the path from design to code.'
---

<script setup>
import IconLucide from '../components/IconLucide.vue'
import IconButton from '../components/IconButton.vue'
import ComponentsInstances from '../components/ComponentsInstances.vue'
import DesignToCodeInterfaces from '../components/DesignToCodeInterfaces.vue'
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

Icon bodies accept single- or double-quoted SVG attributes. Paths, rectangles,
circles, ellipses and lines may use self-closing tags or explicit closing tags;
nested `<g>` fill and stroke attributes are inherited by their shapes.

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

The key insight from [Design ↔ Code] is that design-to-code is **not** a pixel-to-code AI guess. Because the `.ic` format already encodes code-friendly primitives—flex layout, design variables, `reusable`/`ref` components, semantic names, and icon fonts—the scene graph **is** an IR built for code. So the core is a **deterministic transpiler**, and AI only helps at the naming / structure-cleanup layer.

### Pipeline {#design-to-code-pipeline}

We mirror the SVG export pipeline, but insert a framework-agnostic **Code IR** so that adding a new target framework is just one more emitter:

```text
.ic SceneGraph
  → expandRefSerializedNodes   // reuse existing ref/reusable handling
  → CodeIR                     // element tree + structured style + token refs + component defs
  → Emitter                    // react-tailwind | html-css | ...
```

The Code IR node keeps: a **role** (container / text / icon / image / shape), **pre-resolved `$token` references**, structured **flex style**, and `reusable`/`ref` **component relations**.

### Entry point {#design-to-code-entry}

`API.exportCode` is the counterpart of `renderToSVG`. Without arguments it transpiles the whole scene; pass nodes to transpile a selection.

```ts
const code = api.exportCode(undefined, {
    framework: 'react-tailwind', // or 'html-css'
    variablesMode: 'css-var', // 'resolved' | 'preserve-token' | 'css-var'
    componentStructure: 'preserve', // 'preserve' | 'flatten'
});
```

You can also call the pure function directly:

```ts
import { serializedNodesToCode } from '@infinite-canvas-tutorial/ecs';

const code = serializedNodesToCode(nodes, {
    framework: 'react-tailwind',
    variables,
});
```

### Concept mapping {#design-to-code-mapping}

| `.ic` concept                                        | Code output                                           |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `rect`/`g` + `display: flex`                         | `<div>` + flex utilities (`flex items-center …`)      |
| Flex direction, alignment, sizing, gaps, and padding | Tailwind flex utilities / CSS                         |
| Child `x` / `y` inside a non-flex container          | Absolute positioning relative to that container       |
| `cornerRadius` / `fills` / `strokes` / `dropShadow`  | `rounded-* / bg-* / border / shadow-*`                |
| `rect` with an image fill                            | `<img src>` with `object-fit` / `object-position`     |
| `rect` with one CSS gradient fill                    | CSS `background-image`                                |
| `ellipse`                                            | CSS `border-radius: 50%`                              |
| `rect` / `ellipse` + `clipMode: clip`                | CSS `overflow: hidden` on the clipping element        |
| `rotation` / `scaleX` / `scaleY`                     | CSS `transform` around the local top-left corner      |
| node-level `blendMode`                               | CSS `mix-blend-mode`                                  |
| `visibility: hidden` / `visible`                     | CSS visibility without removing layout space          |
| `text` + `content`                                   | text node; `$token` content → variable                |
| text decoration line, style, color, and thickness    | CSS `text-decoration`                                 |
| `fontVariant` / `fontKerning`                        | CSS `font-variant` / `font-kerning`                   |
| `wordWrap` / `wordWrapWidth`                         | `white-space`, `overflow-wrap`, and `max-width`       |
| `maxLines` / `textOverflow`                          | CSS line clamp or clipped line count                  |
| `iconfont` (lucide)                                  | `lucide-react` `<Search />`                           |
| `iconfont` (other families)                          | `@iconify/react` `<Icon icon="family:name" />`        |
| `$color.bg` variable                                 | `bg-[var(--color-bg)]` (css-var) / literal (resolved) |
| `reusable` root                                      | a React component definition                          |
| `ref` + `descendants` overrides                      | a component instance with props                       |
| `name`                                               | component / prop / class name                         |

### Variable modes {#design-to-code-variable-modes}

The three variable modes match the SVG export semantics:

-   `resolved` (default): resolve `$token` to literals (e.g. `bg-[#FFFFFF]`).
-   `css-var`: emit `var(--token)` (e.g. `bg-[var(--color-bg)]`); the HTML/CSS emitter also injects a `:root { … }` block.
-   `preserve-token`: keep `$token` (routed to an inline `style` for post-processing).

### Components and instances {#design-to-code-components}

With `componentStructure: 'preserve'` (the default, and Pencil's selling point), each `reusable` root becomes a component and every `ref` becomes an instance. Overridable attributes (`content`, `fills`, typography including `fontVariant` and `fontKerning`, text decoration, `opacity`, `visibility`, `cornerRadius`, explicit `width`/`height`, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`, `padding`, `margin`, flex gaps, `flexDirection`, `alignItems`, `justifyContent`, `flexWrap`, `alignSelf`, `flexGrow`, `flexShrink`, `flexBasis`, `strokeWidth`, `strokes`, and drop-shadow fields) seen across instances are lifted into props with the template value as default. Numeric `lineHeight` values are pixel heights in `.ic`, so React output adds `px` instead of treating them as unitless multipliers. Boolean `fontKerning` becomes CSS `normal` or `none`. Spacing arrays become CSS shorthand strings, the text-decoration fields combine into one prop, and the shadow fields combine into one `boxShadow` prop. A decoration with zero thickness renders as `none`, matching the canvas:

Text exports preserve explicit line breaks with `white-space: pre`. When `wordWrap` is enabled with a positive `wordWrapWidth`, the output uses `pre-wrap`, `overflow-wrap: anywhere`, and that width as a maximum. A positive `maxLines` adds CSS line clamping for `ellipsis` (the default) or a clipped line-height limit for `clip`. Editing the wrap width of an already wrapped reusable text becomes a component prop. Switching wrapping on or off, or changing its truncation settings, expands the instance so the exported layout follows the edit. The canvas does not currently apply its `whiteSpace` setting in text measurement; custom `textOverflow` marker strings have no equivalent in standard CSS.

For a reusable image, changing only the image URL binds the instance's `fills` override to the component's `<img src>` prop. Changing the fill type, fit, position, or fill opacity expands the instance so the generated element and styles reflect the edit. For a single image fill, the exported `<img>` opacity combines the fill opacity with the node opacity.

A rectangle with one enabled `linear-gradient(...)` or `radial-gradient(...)` fill exports that gradient as `background-image`. Editing only its gradient value on an instance becomes a component prop. Other gradient formats, layered fills, fill opacity, and per-fill blend modes are not mapped to one CSS background image.

A single solid fill with opacity below 1 exports through CSS `color-mix`, preserving the fill alpha without dimming child elements. Node opacity remains a separate CSS `opacity`. Editing a translucent fill on a reusable instance expands that instance so the generated paint retains its opacity.

Node rotation (stored in radians) and `scaleX` / `scaleY` export as a CSS `rotate(...) scale(...)` transform with origin `0 0`, matching the canvas's local transform order. Editing an instance transform expands that instance so the changed geometry is included in the export.

Rectangles and ellipses with `clipMode: clip` now clip their children in generated HTML and React code. Rounded rectangles retain their corner radius, and ellipses use `border-radius: 50%`. Changing a reusable instance's clip mode expands that instance so its clipping state is preserved. `erase` and `soft` masks do not have a direct CSS overflow equivalent and are not exported as clipping.

For a non-flex container, children use their local canvas `x` / `y` as CSS `left` / `top` positions. Flex children remain in normal flex flow. A preserved component instance inside a non-flex container gets a positioned wrapper; moving a child inside an instance expands that instance to retain the edit. When multiple top-level nodes all have explicit sizes, the export also adds a relative frame and keeps their spacing, including rotated and flipped bounds. Roots without measurable sizes retain normal document flow.

Node-level `visibility` becomes CSS `visibility`, so hidden nodes keep their layout space. The default `inherited` state uses CSS inheritance. Changing a reusable instance's visibility becomes a component prop, including edits to descendants.

Node-level `blendMode` becomes CSS `mix-blend-mode`, including a component prop when an instance changes it. `light` maps to CSS `lighten`; modes without a CSS equivalent follow SVG export and render as `normal`. A fill layer's own `blendMode` blends with other fills in that node and is not treated as node-level `mix-blend-mode`.

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

`componentStructure: 'flatten'` is the fallback: it expands every instance via `expandRefSerializedNodes` into concrete DOM with no component definitions. The HTML/CSS emitter always flattens, since HTML has no component concept.

### Practical interface examples {#practical-interface-examples}

The following examples load an analytics dashboard, a SaaS pricing page, and a mobile checkout screen into the **IC editor canvas**. All three scenes use nested flex layouts and semantic color variables; the checkout uses a narrow 390 × 844 artboard. Select and edit nodes on the canvas, then refresh, copy, or download code generated from the canvas's current document with `API.exportCode`. With HTML/CSS selected, use **HTML preview** to view the generated page at its artboard size in a sandboxed frame. Switch designs to load another editable scene.

The examples pass a node-ID keyed `semanticElements` map to `API.exportCode`. It turns selected canvas rectangles and text into HTML landmarks, headings, and `<button type="button">` controls in both exports. The map belongs to this demo's export configuration; wire button actions and navigation in your application.

The pricing page uses one `reusable` plan-card template and three `ref` instances. The editor expands instances to render and edit them; this demo reconciles text, color, typography and text decoration, opacity, explicit size and size constraints, spacing, flex alignment and item sizing, solid border, and drop-shadow edits back into instance overrides for the React and `.ic` downloads. The Growth card demonstrates an accent border. Numeric `flexBasis` and size constraint values become pixel values in HTML/CSS and React styles. If a card's structure or an unsupported property changes, the export uses its expanded nodes so the result still matches the canvas.

<DesignToCodeInterfaces />

Download the `.ic` file to continue editing the design in the [online app](https://app.infinitecanvas.cc/) via **Import from… > .ic**. Download the HTML file and open it directly in a browser. For React, put the downloaded `.tsx` in a project with Tailwind CSS and render its exported `AnalyticsDashboard`, `PricingPage`, or `CheckoutScreen` component. The generator currently emits presentation markup; wire navigation, checkout actions, payments, and live data to your application logic after export. The desktop and mobile artboards use fixed widths for a clear design handoff; adapt the generated layout for your responsive breakpoints.

### Reverse: code → design {#design-to-code-reverse}

The reverse direction (parse JSX/HTML AST back into `.ic` nodes) is harder and more ambiguous, so it is left as a second phase. The recommended first milestone is an **idempotent round-trip** of code that this transpiler emits (design → code → design without information loss) before extending to arbitrary hand-written code.

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
