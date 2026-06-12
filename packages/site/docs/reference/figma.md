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

-   **Import (Figma → `.ic`)** uses the REST API with a
    [personal access token](https://www.figma.com/developers/api#access-tokens) —
    fully headless.
-   **Export (`.ic` → Figma)** cannot go through REST. The plugin produces a JSON
    payload that the companion "Infinite Canvas Import" Figma plugin replays via
    the Figma Plugin API.

## Import from Figma

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

In the app you can also use **Import from… → Figma** in the top navigation bar,
which prompts for the file key (or URL) and a personal access token.

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

| Figma                                                                | `.ic` `SerializedNode`                          |
| -------------------------------------------------------------------- | ----------------------------------------------- |
| `FRAME` / `GROUP` / `SECTION`                                        | `g` (`clipMode: 'clipBox'` for clipping frames) |
| `COMPONENT` / `COMPONENT_SET`                                        | `g` with `reusable: true`                       |
| `INSTANCE`                                                           | `ref` referencing the component id              |
| `RECTANGLE`                                                          | `rect` (`cornerRadius`)                         |
| `ELLIPSE`                                                            | `ellipse`                                       |
| `VECTOR` / `STAR` / `LINE` / `REGULAR_POLYGON` / `BOOLEAN_OPERATION` | `path`                                          |
| `TEXT`                                                               | `text`                                          |
| image fills                                                          | `fills[] { type: 'image' }`                     |

Paints become `fills` / `strokes`; `DROP_SHADOW` / `INNER_SHADOW` become drop /
inner shadow attributes; `LAYER_BLUR` / `BACKGROUND_BLUR` become a CSS `filter`;
layer / paint `blendMode` map to `.ic` blend modes; `opacity` maps to the node
`opacity`; constraints are preserved as `data-figma-constraint-*` attributes.

## Unsupported (first pass)

Auto-layout nuance, prototyping / interactions, masks, gradient direction
fidelity, and boolean operations beyond their flattened geometry.
