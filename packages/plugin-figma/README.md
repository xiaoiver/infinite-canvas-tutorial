# @infinite-canvas-tutorial/figma

Import from / export to [Figma](https://www.figma.com) for the Infinite Canvas
`.ic` format.

The `.ic` `SerializedNode` model is already Figma-shaped (multi-layer
`fills` / `strokes` as a `Paint` subset, layer `blendMode`, `opacity`,
inner / drop shadow, `filter`, and components / instances via `reusable` +
`type: 'ref'`), so this package is a node-tree mapping rather than a new data
model.

## Why two directions are asymmetric

Figma's `.fig` binary is proprietary and the Figma **REST API is read-only**
for document content. Therefore:

-   **Import (Figma → `.ic`)** uses the REST API (`GET /v1/files/:key`) with a
    personal access token — fully headless.
-   **Export (`.ic` → Figma)** cannot go through REST. This package produces a
    JSON payload that the companion Figma plugin (`figma-plugin/`) replays with
    the Figma Plugin API.

## Import

```ts
import {
    FigmaRestClient,
    parseFigmaFileToSerializedNodes,
} from '@infinite-canvas-tutorial/figma';

const client = new FigmaRestClient({ token: '<personal-access-token>' });
const file = await client.getFile('https://www.figma.com/file/<key>/<name>');
const imageRefUrls = await client.getImageFills('<key>');

const doc = parseFigmaFileToSerializedNodes(file, { imageRefUrls });
api.importIcDocument(doc); // from @infinite-canvas-tutorial/ecs
```

## Export

```ts
import { serializedNodesToFigmaScene } from '@infinite-canvas-tutorial/figma';

const doc = api.exportIcDocument();
const scene = serializedNodesToFigmaScene(doc.elements, doc.source);
// Download / copy `scene` as JSON, then paste it into the companion
// "Infinite Canvas Import" Figma plugin (see figma-plugin/README.md).
```

## Mapping

| Figma                                                                | `.ic` `SerializedNode`                                |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| `FRAME` / `GROUP` / `SECTION`                                        | `g` (`clipMode: 'clipBox'` for clipping frames)       |
| `COMPONENT` / `COMPONENT_SET`                                        | `g` with `reusable: true`                             |
| `INSTANCE`                                                           | `ref` referencing the component id                    |
| `RECTANGLE`                                                          | `rect` (`cornerRadius`)                               |
| `ELLIPSE`                                                            | `ellipse`                                             |
| `VECTOR` / `STAR` / `LINE` / `REGULAR_POLYGON` / `BOOLEAN_OPERATION` | `path` (from `fillGeometry` / `strokeGeometry`)       |
| `TEXT`                                                               | `text`                                                |
| image fills                                                          | `fills[] { type: 'image' }` (resolved via `imageRef`) |

Per-property: paints → `fills` / `strokes`; `DROP_SHADOW` / `INNER_SHADOW` →
drop/inner shadow attributes; `LAYER_BLUR` / `BACKGROUND_BLUR` → CSS `filter`;
layer/paint `blendMode` → `.ic` blend modes; `opacity` → node `opacity`;
constraints are preserved as `data-figma-constraint-*` attributes.

## Unsupported (first pass)

Auto-layout nuance, prototyping / interactions, masks, gradient direction
fidelity, and boolean operations beyond their flattened geometry.
