# ECS object uniform uploads

After [#679](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/679) removed repeated document scans during blend planning, a camera frame still uploaded unchanged object uniforms and rebuilt matrix upload packets. The ECS renderer now keeps one numeric Float32 packet per physical object uniform buffer, skipping the GPU write when its bytes would be unchanged. Model matrices and upload views reuse their storage. Resolved paint colors use a bounded per-drawcall cache (16 entries), avoiding repeated parsing while limiting retention during animated paint changes.

This covers the non-instanced object uniform paths in SDF shapes, Mesh fills, SmoothPolyline strokes and SDFText, including text raster bakes. It also benefits the Mesh/SmoothPolyline rendering of ordinary Paths. Existing instanced attributes, camera uniforms, 3D renderer caches and the core package are unchanged. LOD defaults and batch membership/order are unchanged.

## Correctness

The cache compares the actual packed Float32 values every submission, including transforms, paint, opacity and render order. It does not depend on component reference identity or dirty flags. In-place edits still change the packet; a replacement GPU buffer forces an upload. Failed writes remain dirty for retry. The cache owns no GPU resources and clears its buffer reference and color entries when the drawcall is retired.

Every writer to a physical object buffer uses the same cache. Different fill/stroke layers and text bake/screen passes must perform A → B → A writes when their values differ. Scene/pass uniforms continue through their existing paths. WebGL1 legacy uniform setters still run every draw because programs can be shared by independent drawcalls; this optimization never treats program state as local drawcall state.

## Measurements

Run the existing mixed-scene benchmark:

```sh
POLYLINE_LOD_COUNTS=600 pnpm bench:polyline-lod
```

The fixture now records native `bufferSubData` calls and bytes, tagging uniform buffers when allocated and following buffer bindings even when uploads use `COPY_WRITE_BUFFER`. These are actual API submissions, not GPU execution times or allocated GPU byte estimates. The benchmark reports counters for the final completed measured frame.

The baseline is merge `b7510c6a` (#679). The measured checkout `37f05dfb` has the same tree. Only the new fixture instrumentation was temporarily copied to that checkout and restored afterward; production source remained the baseline. Baseline and optimized runs used sequential fresh Chromium launches, baseline first, with no concurrent CPU checks. Each case used 600 actual visible objects: equal numbers of rectangles, adaptive Paths and 512-sample polylines; 800×600 canvas, DPR 1, zoom 0.2, 15 warmup frames and 29 completed measured frames. Environment: Linux, Node 24.22.3, Chromium 140.0.7339.186 with SwiftShader.

| Polyline LOD | Baseline CPU p50 / p95 (ms) | Optimized CPU p50 / p95 (ms) | Uniform uploads before / after | Uniform bytes before / after |
| ------------ | --------------------------- | ---------------------------- | ------------------------------ | ---------------------------- |
| off          | 20.6 / 36.0                 | 16.5 / 35.6                  | 601 / 1                        | 76,992 / 192                 |
| on           | 18.6 / 26.8                 | 14.0 / 25.9                  | 601 / 1                        | 76,992 / 192                 |

Only the 192-byte scene block uploads during a settled camera-only frame. Native drawcalls remain 801 including final compositing; submitted indices remain 1,599,000 with LOD off and 126,000 with LOD on. The main canvas retains 3,403 buffers, seven textures, five programs and five vertex arrays in both versions. Geometry and resources are unchanged. These short software-renderer samples show reduced median CPU time but almost no p95 improvement with LOD off; they do not establish a universal FPS improvement. Layered paints and bake passes still upload whenever their values alternate. Material value generation and legacy setter calls still run.

Full raw results are in [object-uniforms-benchmark.json](./object-uniforms-benchmark.json).

## Validation

Local checks passed: 91 tests across eight related Jest suites; 22 Chromium browser cases across blend, object uniforms, polyline LOD, text LOD and text proxy instancing; ECS/browser TypeScript; changed-file ESLint, Markdown lint and diff checks; and all nine browser CI tooling checks. The raw measurements above were run separately from those checks.

The focused regressions cover numeric packing/equality, in-place updates, independent buffers, layer/bake transitions, failed-upload retry, bounded color retention, real camera-only upload counters, style/transform edits, gradient-text bakes, whole/partial raster export, shared-program WebGL1 pixels and resource cleanup. Existing blend and polyline LOD browser cases also run against the change. The new browser cases are included in both Chromium discovery and the existing WebKit CI suite.

Local verification uses Chromium software WebGL. WebKit cannot launch on this host because its system libraries are missing; CI remains necessary. Native WebGPU, physical devices and the full native headless-GL suite were not measured. No dependency, audit exception, CI timeout or retry policy changes are needed.
