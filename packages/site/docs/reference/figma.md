---
outline: deep
---

# Figma

This plugin imports a Figma file into the canvas scene graph and exports the
scene back into Figma. The `.ic` `SerializedNode` model is already Figma-shaped
(multi-layer `fills` / `strokes`, layer `blendMode`, `opacity`, inner / drop
shadow, `filter`, and components / instances), so this plugin is a node-tree
mapping rather than a new data model.

## Import / export are asymmetric

Figma's `.fig` binary is proprietary and the **Figma REST API is read-only**
for document content. Therefore:

-   **Import (Figma → `.ic`)** is recommended via a local `.fig` file (Figma
    **File → Save local copy**). The REST API with a personal access token remains
    available for headless cloud files.
-   **Export (`.ic` → Figma)** cannot go through REST. The plugin produces a JSON
    payload that the companion "Infinite Canvas Import" Figma plugin replays via
    the Figma Plugin API.

## Import from a `.fig` file (recommended)

A `.fig` file is a ZIP archive containing Kiwi-encoded `canvas.fig` and
`images/*` assets. The package parses it with
[openfig-core](https://github.com/OpenFig-org/openfig-core), converts the tree
in `fig-to-figma.ts` to the same shape as a REST file response, then runs the
shared `figma-to-ic` mapper.

```ts
import { parseFigFileToSerializedNodes } from '@infinite-canvas-tutorial/figma';

const bytes = new Uint8Array(await (await fetch('/design.fig')).arrayBuffer());
const doc = parseFigFileToSerializedNodes(bytes);
api.importIcDocument(doc);
```

In the app, use **Import from… → Figma (.fig)** in the top navigation bar to open
a file picker.

`fig-to-figma` conversion notes:

-   **Multi-fill order**: `.fig` `fillPaints` follow the Figma UI (top to bottom);
    `.ic` stacks bottom to top, so fills are reversed on import.
-   **Gradients**: `stops` → `gradientStops`; paint `transform` is projected via
    `resolveGradientGeometry` into `gradientHandlePositions` (linear / radial
    direction matches Figma).
-   **Image fills**: embedded `images/<sha1>` bytes become data URLs keyed by
    `imageRef`.
-   **Vectors**: `resolveVectorNodePaths` produces `fillGeometry` /
    `strokeGeometry` paths.
-   **Auto-layout**: `stackMode`, spacing, padding, alignment, and hug sizing map
    to `display: 'flex'` and Yoga layout fields; child `stackChildPrimaryGrow`,
    `stackChildAlignSelf`, and `stackPositioning: ABSOLUTE` map to `flexGrow`,
    `alignSelf`, and `position: 'absolute'`. Grid auto-layout is not supported yet.

## Import via REST API (optional)

```ts
import {
    FigmaRestClient,
    parseFigmaFileToSerializedNodes,
} from '@infinite-canvas-tutorial/figma';

const client = new FigmaRestClient({ token: '<personal-access-token>' });
const file = await client.getFile('https://www.figma.com/file/<key>/<name>');
const imageRefUrls = await client.getImageFills('<key>');

const doc = parseFigmaFileToSerializedNodes(file, { imageRefUrls });
api.importIcDocument(doc);
```

Cloud files need `getImageFills` for image paint URLs; local `.fig` files use
embedded ZIP assets.

## Export to Figma

```ts
import { serializedNodesToFigmaScene } from '@infinite-canvas-tutorial/figma';

const doc = api.exportIcDocument();
const scene = serializedNodesToFigmaScene(doc.elements, doc.source);
// Save `scene` as JSON, then paste it into the companion Figma plugin.
```

In the app, use **Export to… → Figma (.json)** to download the scene payload,
then run the companion plugin in Figma (see `packages/plugin-figma/figma-plugin`)
and paste the JSON to recreate the nodes.

## Mapping

| Figma                                                                | `.ic` `SerializedNode`                     |
| -------------------------------------------------------------------- | ------------------------------------------ |
| `FRAME` / `SECTION` / `COMPONENT` / `COMPONENT_SET`                  | `rect` (`clipMode: 'clip'` when clipping)  |
| `GROUP`                                                              | `g`                                        |
| `INSTANCE`                                                           | `ref` referencing the component id         |
| `RECTANGLE` / `ROUNDED_RECTANGLE`                                    | `rect` (`cornerRadius`)                    |
| `ELLIPSE`                                                            | `ellipse`                                  |
| `VECTOR` / `STAR` / `LINE` / `REGULAR_POLYGON` / `BOOLEAN_OPERATION` | `path`                                     |
| `TEXT`                                                               | `text`                                     |
| Auto-layout (`HORIZONTAL` / `VERTICAL`)                              | `display: 'flex'` + Yoga layout attributes |
| image fills                                                          | `fills[] { type: 'image' }`                |
| linear / radial gradient fills                                       | `fills[] { type: 'gradient' }`             |

Paints become `fills` / `strokes`; `DROP_SHADOW` / `INNER_SHADOW` become drop /
inner shadow attributes; `LAYER_BLUR` / `BACKGROUND_BLUR` become a CSS `filter`;
layer / paint `blendMode` map to `.ic` blend modes; `opacity` maps to the node
`opacity`; constraints are preserved as `data-figma-constraint-*` attributes.

## Unsupported (first pass)

Auto-layout grid, prototyping / interactions, masks, faithful angular /
diamond gradients, and boolean operations beyond their flattened geometry.
