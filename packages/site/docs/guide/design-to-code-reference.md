---
title: Design to Code export details
outline: deep
---

# Design to Code export details

This page collects export behavior and limitations. Return to [lesson 38](/guide/lesson-038#design-to-code) for the API and interactive examples.

## Concept mapping

| `.ic` concept                                        | Code output                                           |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `rect`/`g` + `display: flex`                         | `<div>` + flex utilities (`flex items-center …`)      |
| Flex direction, alignment, sizing, gaps, and padding | Tailwind flex utilities / CSS                         |
| Child `x` / `y` inside a non-flex container          | Absolute positioning relative to that container       |
| `cornerRadius` / `fills` / `strokes` / `dropShadow`  | `rounded-* / bg-* / border / shadow-*`                |
| `rect` with an image fill                            | `<img src>` with `object-fit` / `object-position`     |
| `rect` with one CSS gradient fill                    | CSS `background-image`                                |
| `ellipse`                                            | CSS `border-radius: 50%`                              |
| Leaf `path` with solid fill and stroke               | Inline SVG `<path>` with vector geometry              |
| Leaf `line` / `polyline` with solid stroke           | Inline SVG `<path>` with open vector geometry         |
| `rect` / `ellipse` + `clipMode: clip`                | CSS `overflow: hidden` on the clipping element        |
| `rotation` / `scaleX` / `scaleY`                     | CSS `transform` around the local top-left corner      |
| node-level `blendMode`                               | CSS `mix-blend-mode`                                  |
| `visibility: hidden` / `visible`                     | CSS visibility without removing layout space          |
| `text` + `content`                                   | text node; known `$token` content → text value        |
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

## Component props

With `componentStructure: 'preserve'` (the default, and Pencil's selling point), each `reusable` root becomes a component and every `ref` becomes an instance. Overridable attributes (`content`, `fills`, typography including `fontVariant` and `fontKerning`, text decoration, `opacity`, `visibility`, `cornerRadius`, explicit `width`/`height`, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`, `padding`, `margin`, flex gaps, `flexDirection`, `alignItems`, `justifyContent`, `flexWrap`, `alignSelf`, `flexGrow`, `flexShrink`, `flexBasis`, `strokeWidth`, `strokes`, and drop-shadow fields) seen across instances are lifted into props with the template value as default.

Numeric `lineHeight` values are pixel heights in `.ic`, so React output adds `px` instead of treating them as unitless multipliers. Boolean `fontKerning` becomes CSS `normal` or `none`.

Spacing arrays become CSS shorthand strings, the text-decoration fields combine into one prop, and the shadow fields combine into one `boxShadow` prop. A decoration with zero thickness renders as `none`, matching the canvas.

## Text

Text exports use a unitless `1.2` line height when no explicit `lineHeight` is set, keeping browser flex spacing close to the canvas text metrics. An explicit numeric `lineHeight` still exports in pixels.

Explicit line breaks are preserved with `white-space: pre`. When `wordWrap` is enabled with a positive `wordWrapWidth`, the output uses `pre-wrap`, `overflow-wrap: anywhere`, and that width as a maximum.

A positive `maxLines` adds CSS line clamping for `ellipsis` (the default) or a clipped line-height limit for `clip`. Editing the wrap width of an already wrapped reusable text becomes a component prop.

Switching wrapping on or off, or changing its truncation settings, expands the instance so the exported layout follows the edit. The canvas does not currently apply its `whiteSpace` setting in text measurement; custom `textOverflow` marker strings have no equivalent in standard CSS.

## Images and fills

For a reusable image, changing only the image URL binds the instance's `fills` override to the component's `<img src>` prop. Changing the fill type, fit, position, or fill opacity expands the instance so the generated element and styles reflect the edit.

A leaf image combines its single fill opacity with node opacity on `<img>`. A single image fill on an ellipse exports as a rounded `<img>`.

Image-filled rectangles and ellipses with children use a positioned wrapper and place a decorative `<img>` behind those children; the wrapper carries node opacity while `<img>` carries fill opacity, fit, and position.

A rectangle with one enabled CSS linear, radial, or conic gradient fill exports that gradient as `background-image`. Editing only its gradient value on an instance becomes a component prop.

Rectangles and ellipses with multiple solid, supported gradient, image, or pattern fills export stacked backgrounds in paint order. A single pattern also exports as a CSS background.

The canvas's `conic-gradient(circle at …)` syntax is converted to CSS `conic-gradient(at …)`. Image layers support `fill`, `contain`, `cover`, `none`, `scale-down`, and position, while keeping child content above the paint.

Patterns retain their natural tile size and repetition setting. For paints that need independent opacity, image `scale-down`, or a supported 2D pattern transform, the generator emits clipped decorative layers behind children.

CSS-supported layer blend modes remain local to the fill stack. Pattern transforms support `matrix`, `translate`, `scale`, `rotate`, `skewX`, and `skewY` on rectangles and ellipses with explicit dimensions; the canvas also decodes URL-based pattern images and applies these transforms.

Editing a stack or pattern on a reusable instance expands it. Other gradient formats, unsupported pattern transform syntax, and blend modes without CSS equivalents such as `linearBurn` and `linearDodge` still need separate handling.

A single solid fill with opacity below 1 exports through CSS `color-mix`, preserving the fill alpha without dimming child elements. Node opacity remains a separate CSS `opacity`. Editing a translucent fill on a reusable instance expands that instance so the generated paint retains its opacity.

## Transforms and layout

Node rotation (stored in radians) and `scaleX` / `scaleY` export as a CSS `rotate(...) scale(...)` transform with origin `0 0`, matching the canvas's local transform order. Editing an instance transform expands that instance so the changed geometry is included in the export.

Rectangles and ellipses with `clipMode: clip` now clip their children in generated HTML and React code. Rounded rectangles retain their corner radius, and ellipses use `border-radius: 50%`. Changing a reusable instance's clip mode expands that instance so its clipping state is preserved. `erase` and `soft` masks do not have a direct CSS overflow equivalent and are not exported as clipping.

For a non-flex container, children use their local canvas `x` / `y` as CSS `left` / `top` positions. Flex children remain in normal flex flow.

Yoga defaults their `flexShrink` to `0`, so the export sets `flex-shrink: 0` unless the node specifies another value. A preserved component instance inside a non-flex container gets a positioned wrapper; moving a child inside an instance expands that instance to retain the edit.

When multiple top-level nodes all have explicit sizes, the export also adds a relative frame and keeps their spacing, including rotated and flipped bounds. Roots without measurable sizes retain normal document flow.

Node-level `visibility` becomes CSS `visibility`, so hidden nodes keep their layout space. The default `inherited` state uses CSS inheritance. Changing a reusable instance's visibility becomes a component prop, including edits to descendants.

## Vector shapes

Paths with valid `d` data export as inline SVG instead of a rectangular placeholder. When a Path has children, its SVG sits behind them in a positioned wrapper, keeping the vector outline and each child's local coordinates.

Fill layers made from solid colors, linear or radial gradients, and images export as separate SVG paths in canvas order, preserving each layer's opacity. CSS-supported blend modes apply inside an isolated SVG group, so they blend only with lower fill layers.

Active strokes of those paint types retain their paint, opacity, line, triangle, or diamond endpoint markers, fill rule, width, cap, join, miter limit, and dash settings. Paths, lines, and polylines with multiple strokes export each stroke in canvas order with shared geometry and CSS-supported layer blending.

Closed paths also retain inner or outer stroke alignment by clipping or masking every layer; open paths stay center-aligned. Gradients and image paints follow the path's viewBox.

Path image fills support `fill`, `contain`, `cover`, `none`, and `scale-down`, including intermediate percentage positions. Common `fill` / `contain` / `cover` alignments use SVG patterns; other fits and positions use a clipped SVG `foreignObject` with CSS `object-fit` / `object-position`.

Image strokes use SVG patterns for `fill`, `contain`, or `cover` at 0%, 50%, or 100% positions. A single image stroke with another fit or position uses a positioned HTML image and an SVG geometry mask, preserving its cap, join, endpoint markers, and inner or outer alignment in Chromium and WebKit.

Layered image strokes with these fits or positions also retain canvas paint order, supported CSS blend modes, opacity, and endpoint markers alongside SVG stroke layers. Use a durable image URL or data URL in exported code.

A drop shadow follows the SVG artwork without shadowing a Path's children. Path paint, geometry, marker, stroke alignment, or shadow overrides on a reusable instance expand that instance so the SVG reflects the edit.

Blend modes without CSS equivalents such as `linearBurn` and `linearDodge`, conic and mesh gradients, and other path filters need separate SVG handling.

Leaf lines and polylines use the same SVG pipeline. Their local endpoints or point list become an open path with no fill.

The SVG viewBox follows the geometry's local origin and centers a zero-width or zero-height axis, so offset paths and thin horizontal or vertical strokes remain visible in generated code. Their stroke can use a single active solid, linear gradient, radial gradient, or image paint.

Line, triangle, and diamond arrowheads use local SVG markers with the stroke paint. Geometry, paint, or marker edits to a reusable line or polyline instance also expand that instance.

Other line effects still need separate handling.

## Blend modes

Node-level `blendMode` becomes CSS `mix-blend-mode`, including a component prop when an instance changes it. `light` maps to CSS `lighten`; modes without a CSS equivalent follow SVG export and render as `normal`. A fill layer's own `blendMode` blends with other fills in that node and is not treated as node-level `mix-blend-mode`.

## Practical interface examples

The lesson 38 examples load an analytics dashboard, a SaaS pricing page, and a mobile checkout screen into the **IC editor canvas**. All three scenes use nested flex layouts and semantic color variables; the checkout uses a narrow 390 × 844 artboard. Select and edit nodes on the canvas, then refresh, copy, or download code generated from the canvas's current document with `API.exportCode`. With HTML/CSS selected, use **HTML preview** to view the generated page at its artboard size in a sandboxed frame. Switch designs to load another editable scene.

The examples pass a node-ID keyed `semanticElements` map to `API.exportCode`. It turns selected canvas rectangles and text into HTML landmarks, headings, and `<button type="button">` controls in both exports. The map belongs to this demo's export configuration; wire button actions and navigation in your application.

The pricing page uses one `reusable` plan-card template and three `ref` instances. The editor expands instances to render and edit them; this demo reconciles text, color, typography and text decoration, opacity, explicit size and size constraints, spacing, flex alignment and item sizing, solid border, and drop-shadow edits back into instance overrides for the React and `.ic` downloads. The Growth card demonstrates an accent border. Numeric `flexBasis` and size constraint values become pixel values in HTML/CSS and React styles. If a card's structure or an unsupported property changes, the export uses its expanded nodes so the result still matches the canvas.

The three React exports are also rendered in a browser test with React 19 and Tailwind CSS 4. The test checks key text positions against the HTML preview so these examples remain runnable as the generator changes.

Download the `.ic` file to continue editing the design in the [online app](https://app.infinitecanvas.cc/) via **Import from… > .ic**. Download the HTML file and open it directly in a browser. For React, choose **Download React project** to get a Vite, React 19, and Tailwind CSS 4 starter ZIP from the current canvas. Extract it, then run `pnpm install` and `pnpm dev`; the exported component lives in `src/App.tsx`. The starter bundles the Inter font locally when the design uses it. Temporary `blob:` images from the current canvas are copied into `public/assets` and referenced by local paths; data URLs stay inline and remote URLs remain remote. Its `src/responsive.css` adds narrow-screen layouts for these three examples while preserving the artboard-sized component in `src/App.tsx`. You can also download just the `.tsx` file for an existing project. The generator currently emits presentation markup; wire navigation, checkout actions, payments, and live data to your application logic after export.
