# @infinite-canvas-tutorial/gsplat

3D Gaussian Splatting (3DGS) rendering for ECS / `device-api` canvases, inspired
by [PlayCanvas SuperSplat](https://github.com/playcanvas/supersplat).

This is a **Phase-1 MVP**: it loads gaussian-splat assets, projects each
gaussian to a screen-space ellipse with EWA splatting, depth-sorts on the CPU,
and composites back-to-front with premultiplied alpha. View-dependent color uses
spherical-harmonics **degree 0** (DC color). It runs on both WebGL2 and WebGPU
because the shaders are GLSL transpiled by
[`@infinite-canvas-tutorial/device-api`](../device-api).

## Install

```bash
pnpm add @infinite-canvas-tutorial/gsplat
```

## Usage

```ts
import { parseGsplat, GsplatRenderer } from '@infinite-canvas-tutorial/gsplat';

// 1. Parse an asset (.ply or .splat). Format is inferred from the name/URL.
const buffer = await (await fetch('/scene.ply')).arrayBuffer();
const data = parseGsplat(buffer, { nameOrUrl: 'scene.ply' });

// 2. Create a renderer on an existing device (e.g. the canvas GPUResource).
const renderer = new GsplatRenderer(device);
renderer.setData(data);

// 3. Render each frame with column-major view/projection matrices.
const texture = renderer.render({
    viewMatrix, // mat4, column-major; camera looks down -z
    projectionMatrix, // mat4, perspective
    width,
    height,
});
// `texture` is an RGBA (premultiplied-alpha) texture you can blit / use as a fill.
```

### Parsing only

```ts
import {
    parsePly,
    parseSplat,
    GsplatData,
} from '@infinite-canvas-tutorial/gsplat';

const data: GsplatData = parsePly(plyBuffer);
console.log(data.count, data.computeBounds());
```

## Supported formats

| Format   | Notes                                                            |
| -------- | ---------------------------------------------------------------- |
| `.ply`   | INRIA / SuperSplat export. ASCII and binary (little/big endian). |
| `.splat` | Compact antimatter15 layout, 32 bytes per gaussian.              |

PLY decoding follows the reference implementation: scales are `exp(scale_i)`,
opacity is `sigmoid(opacity)`, color is `0.5 + SH_C0 · f_dc_i`, and the
quaternion is stored `(w, x, y, z)` (re-emitted as `(x, y, z, w)`). Higher-order
`f_rest_*` SH bands are ignored in this MVP.

## How it works

-   **Geometry** — each gaussian is one instanced quad (4 verts, 2 triangles).
-   **Vertex shader (EWA splatting)** — the 3D covariance `Σ = R S Sᵀ Rᵀ` is
    projected to a 2D screen-space covariance via the perspective Jacobian, and the
    quad is expanded along the resulting ellipse's major/minor axes.
-   **Fragment shader** — the 2D gaussian weight `α = opacity · exp(-½ d²)` is
    evaluated and output as premultiplied-alpha color.
-   **Sorting** — gaussians are depth-sorted farthest→nearest each frame using a
    16-bit counting sort (`O(n)`), then the instance buffer is uploaded in sorted
    order for correct back-to-front "over" compositing.

## Roadmap

-   GPU radix sort (WebGPU compute) and a WebGL2 web-worker CPU sort for very large
    captures.
-   Higher-order spherical harmonics (degree 1–3) for view-dependent color.
-   A declarative `gsplat` node type in core ECS (serialize / deserialize / pick).
-   Editing: selection, transform, crop box (toward the SuperSplat editor UX).

## License

MIT
