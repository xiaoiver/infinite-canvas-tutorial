# 3D Gaussian Splatting

[3D Gaussian Splatting](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)
(3DGS) represents a scene as millions of anisotropic 3D gaussians instead of
triangles. Each gaussian has a position, an anisotropic covariance (from a scale
and rotation), an opacity, and a view-dependent color encoded as spherical
harmonics. Editors such as [PlayCanvas SuperSplat](https://github.com/playcanvas/supersplat)
let you view and edit these captures.

This experiment adds a `@infinite-canvas-tutorial/gsplat` package that loads
gaussian-splat assets and renders them with **EWA splatting** on top of
`device-api`, so it works on both WebGL2 and WebGPU. The Phase-1 MVP supports
spherical-harmonics **degree 0** (DC color).

## Data format

Each gaussian is decoded into render-ready, linear-space values:

| Field    | Meaning                              |
| -------- | ------------------------------------ |
| center   | gaussian mean `(x, y, z)`            |
| scale    | per-axis standard deviation (linear) |
| rotation | unit quaternion `(x, y, z, w)`       |
| color    | RGB DC color in `[0, 1]`             |
| opacity  | alpha in `[0, 1]`                    |

Two asset formats are parsed:

-   **`.ply`** — the INRIA / SuperSplat export, ASCII or binary (little/big
    endian). Scales are stored as `log(scale)` (we apply `exp`), opacity as a
    logit (we apply the logistic sigmoid), color as the SH DC term
    (`0.5 + SH_C0 · f_dc_i`), and the quaternion is stored `(w, x, y, z)`.
-   **`.splat`** — the compact antimatter15 layout, 32 bytes per gaussian.

```ts
import { parseGsplat } from '@infinite-canvas-tutorial/gsplat';

const buffer = await (await fetch('/scene.ply')).arrayBuffer();
const data = parseGsplat(buffer, { nameOrUrl: 'scene.ply' });
console.log(data.count, data.computeBounds());
```

## EWA projection

Each gaussian is drawn as one **instanced quad**. In the vertex shader the 3D
covariance is built from the scale and rotation:

$$\Sigma = R\,S\,S^\top R^\top$$

and projected to a 2D screen-space covariance through the perspective Jacobian
$J$ of the view transform:

$$\Sigma' = J\,W\,\Sigma\,W^\top J^\top$$

The 2×2 result gives the ellipse's major/minor axes, which expand the quad. The
fragment shader evaluates the 2D gaussian weight and outputs premultiplied
alpha:

$$\alpha = \text{opacity} \cdot e^{-\frac{1}{2} d^2}$$

where `d` is the distance to the ellipse center in eigen-axis units.

## Depth sorting

Alpha compositing requires drawing **back-to-front**. Every frame the gaussians
are sorted by view-space depth (farthest first) with an `O(n)` 16-bit counting
sort, and the instance buffer is uploaded in sorted order before drawing with a
premultiplied "over" blend (`ONE`, `ONE_MINUS_SRC_ALPHA`).

## WebGL2 vs WebGPU

The shaders are written once in GLSL 300 ES and transpiled by `device-api` for
both backends, so rendering is portable. The difference is the **sort**:

-   This MVP sorts on the **CPU** every frame — fine for small/medium captures.
-   For very large captures a **GPU radix sort** (WebGPU compute) or a WebGL2
    **web-worker** sort is planned (see the package roadmap).

## Example

A self-contained reference component lives at
`packages/site/docs/components/Gsplat.vue`. It creates a `device-api` swap chain,
builds a small synthetic gaussian sphere, and orbits a `gl-matrix` camera around
it:

```ts
import { GsplatRenderer } from '@infinite-canvas-tutorial/gsplat';

const renderer = new GsplatRenderer(device);
renderer.setData(data);

// each frame, render straight into the swap-chain's on-screen target:
const onscreen = device.createRenderTargetFromTexture(
    swapChain.getOnscreenTexture(),
);
renderer.render({ viewMatrix, projectionMatrix, width, height }, onscreen);
onscreen.destroy();
```

Omit the second argument to render into an offscreen texture instead (returned
from `render`), which you can then use as a fill or composite with other layers.
