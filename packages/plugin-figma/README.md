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

-   **Import (Figma → `.ic`)** reads local `.fig` ZIP archives (recommended), or
    fetches cloud files via the REST API (`GET /v1/files/:key`) with a personal
    access token.
-   **Export (`.ic` → Figma)** cannot go through REST. This package produces a
    JSON payload that the companion Figma plugin (`figma-plugin/`) replays with
    the Figma Plugin API.

## Import from `.fig`

```ts
import { parseFigFileToSerializedNodes } from '@infinite-canvas-tutorial/figma';

const bytes = new Uint8Array(await (await fetch('/design.fig')).arrayBuffer());
const doc = parseFigFileToSerializedNodes(bytes);
api.importIcDocument(doc); // from @infinite-canvas-tutorial/ecs
```

Parsing uses [openfig-core](https://github.com/OpenFig-org/openfig-core).
`fig-to-figma.ts` converts the decoded document into the same `FigmaFileResponse`
tree shape as the REST API, then `figma-to-ic.ts` maps it to `.ic`:

-   Multi-fill order: `.fig` paints are UI top-to-bottom; `.ic` stacks bottom-to-top
    (reversed on import).
-   Gradients: `stops` → `gradientStops`; paint `transform` → handle positions via
    `resolveGradientGeometry`.
-   Images: ZIP `images/<sha1>` → data URLs for `imageRef` fills.
-   Vectors: `resolveVectorNodePaths` for path geometry.

## Import via REST API

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
| `FRAME` / `SECTION` / `COMPONENT` / `COMPONENT_SET`                  | `rect` (`clipMode: 'clip'` for clipping frames)       |
| `GROUP`                                                              | `g`                                                   |
| `INSTANCE`                                                           | `ref` referencing the component id                    |
| `RECTANGLE` / `ROUNDED_RECTANGLE`                                    | `rect` (`cornerRadius`)                               |
| `ELLIPSE`                                                            | `ellipse`                                             |
| `VECTOR` / `STAR` / `LINE` / `REGULAR_POLYGON` / `BOOLEAN_OPERATION` | `path` (from `fillGeometry` / `strokeGeometry`)       |
| `TEXT`                                                               | `text`                                                |
| image fills                                                          | `fills[] { type: 'image' }` (resolved via `imageRef`) |
| linear / radial gradients                                            | `fills[] { type: 'gradient' }`                        |

Per-property: paints → `fills` / `strokes`; `DROP_SHADOW` / `INNER_SHADOW` →
drop/inner shadow attributes; `LAYER_BLUR` / `BACKGROUND_BLUR` → CSS `filter`;
layer/paint `blendMode` → `.ic` blend modes; `opacity` → node `opacity`;
constraints are preserved as `data-figma-constraint-*` attributes.

## Unsupported (first pass)

Auto-layout nuance, prototyping / interactions, masks, angular / diamond
gradient fidelity, and boolean operations beyond their flattened geometry.
