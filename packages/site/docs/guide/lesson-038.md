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

Canvas nodes become layout, text, image or vector elements, for example:

| Canvas content     | Code output                                      |
| ------------------ | ------------------------------------------------ |
| Flex container     | HTML container and flex styles                   |
| Text, image        | Text nodes and `<img>`                           |
| Path, Line         | Inline SVG retaining the outline                 |
| `reusable` / `ref` | React components and instances                   |
| Design variables   | Literal values, CSS variables or retained tokens |

[View the full concept mapping](/guide/design-to-code-reference#concept-mapping).

### Variable modes {#design-to-code-variable-modes}

The three variable modes match the SVG export semantics:

-   `resolved` (default): resolve `$token` to literals (e.g. `bg-[#FFFFFF]`).
-   `css-var`: emit `var(--token)` for styles (e.g. `bg-[var(--color-bg)]`). HTML/CSS export includes a `:root { … }` block; React scopes the definitions to each exported component, including reusable components rendered on their own. Nested instances share the parent scope, so separate exports can use different values for the same token. Text content tokens resolve to their current values because CSS custom properties cannot replace text nodes.
-   `preserve-token`: keep `$token` (routed to an inline `style` for post-processing).

### Components and instances {#design-to-code-components}

With the default `componentStructure: 'preserve'`, each `reusable` root becomes a React component and each `ref` becomes an instance. Supported text, style and layout overrides become props; changes that cannot be expressed as props expand the instance to preserve its appearance.

For text, images, gradients, patterns, Paths, clipping and blend modes, see the [Design to Code export details](/guide/design-to-code-reference).

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

Try an analytics dashboard, a SaaS pricing page, and a mobile checkout in the IC editor canvas. Select and edit nodes, then generate, copy or download code from the current canvas. Choose HTML/CSS and **HTML preview** to view the result; switching examples loads another editable design.

The pricing page uses a reusable plan card. The examples also use `semanticElements` to export selected nodes as headings, landmarks and buttons.

<DesignToCodeInterfaces />

Download `.ic` to continue editing in the [online app](https://app.infinitecanvas.cc/), or open the downloaded HTML in a browser. Choose **Download React project**, extract it and run `pnpm install` and `pnpm dev`; alternatively, download the `.tsx` file for an existing project. The generated code is presentation markup; connect navigation, payments and live data in your application. See [export details](/guide/design-to-code-reference#practical-interface-examples) for images, responsive layouts and instance overrides.

### Command line {#cli}

The repository also includes an offline CLI for `.ic` files (Node.js 20+). Export the design from the editor with **Export as… > .ic** and save it as `design.ic`. From the repository root, build its workspace dependencies in order, then run:

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

`inspect --json` reports node and root counts, reusable nodes, variables, and asset URL counts. Omitting `--output` prints generated code to stdout; invalid documents or options return a nonzero exit status with an error message. The CLI outputs the same React component or HTML/CSS fragment as the editor's code generator. It uses the document's variables and theme, does not access an online project, and rejects temporary `blob:` images that cannot survive outside the browser. Use data URLs or durable image URLs in exported documents.

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
