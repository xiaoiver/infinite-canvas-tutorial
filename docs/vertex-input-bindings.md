# Vertex input buffer bindings

After [#680](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/680) removed unchanged object uniform uploads, `Device_GL.setVertexInput` still bound the same `ARRAY_BUFFER` separately for every attribute within a vertex buffer slot. The device now binds once when the first active attribute in that slot is configured. It continues setting every attribute pointer, including its format, stride and buffer offset.

The flag is local to one slot of one submission. There is no persistent binding cache, additional VAO or invalidation protocol. Shared layouts can switch buffers on the next draw; null slots and WebGL1 attributes optimized out of the program retain the previous behavior. Index buffer binding and draw offsets, instancing divisors and render-bundle replay are unchanged.

This changes the repository's WebGL device implementation, used by ECS for text and other graphics. Core still uses external `@antv/g-device-api` and does not receive this optimization. No dependency migration is included. WebGPU, batch membership/order, geometry, LOD defaults and export precision are unchanged.

## Measurements

Reproduce with the existing mixed-scene benchmark:

```sh
POLYLINE_LOD_COUNTS=600 pnpm bench:polyline-lod
```

The fixture now counts native `ARRAY_BUFFER` and `ELEMENT_ARRAY_BUFFER` bindings and `vertexAttribPointer` calls, in addition to existing draw/upload counters. These count actual API submissions; they are not GPU execution timings. All CPU measurements include the probe overhead, which is not separately quantified.

Baseline merge `b87079f4` has the same tree as measured checkout `57c49f28`. Only the new fixture instrumentation was temporarily copied into that clean checkout and restored afterward. Runs were sequential, baseline first, with fresh Chromium launches and no concurrent CPU checks. Each case uses 600 actual visible objects: equal numbers of rectangles, adaptive Paths and 512-sample polylines; an 800×600 canvas, DPR 1 and zoom 0.2; 15 warmup and 29 completed measured frames. Environment: Linux, Node 24.22.3, Chromium 140.0.7339.186 with SwiftShader.

| Polyline LOD | Baseline CPU p50 / p95 (ms) | Optimized CPU p50 / p95 (ms) | Array buffer binds before / after |
| ------------ | --------------------------- | ---------------------------- | --------------------------------- |
| off          | 17.2 / 31.0                 | 15.8 / 23.1                  | 5,201 / 3,601                     |
| on           | 18.0 / 27.9                 | 16.1 / 20.2                  | 5,201 / 3,601                     |

In both cases, attribute pointer calls remain 5,201 and element buffer bindings remain 800. Native drawcalls remain 801 including final compositing. Uniform uploads remain one 192-byte scene block; submitted indices remain 1,599,000 with LOD off and 126,000 with LOD on. Main-canvas resources remain 3,403 buffers, seven textures, five programs and five vertex arrays. The change removes 1,600 redundant bindings per measured frame without removing attribute configuration or adding resources. These short instrumented software-renderer samples do not establish a universal CPU or FPS improvement.

Raw measurements are in [vertex-input-bindings-benchmark.json](./vertex-input-bindings-benchmark.json).

## Validation and limits

-   Sixteen tests across the vertex input, device draw and device lifecycle Jest suites passed. New cases verify attribute-to-buffer association, offsets, WebGL1 locations, shared-layout buffer replacement, null and optimized-out slots, index offsets and deferred render-bundle replay.
-   Forty-four Chromium browser cases passed, covering ECS blend comparisons, WebGL1 rendering, object uniform updates, whole/partial exports, text/proxy/polyline LOD interactions and resource cleanup, and adaptive paths at high zoom/DPR. Core path tests are an unchanged control, not evidence that core uses the optimized device.
-   Device and browser TypeScript, changed-file ESLint, Markdown lint, diff checks and the device package ES module build passed.
-   WebKit cannot launch on this host due to missing system libraries; existing CI covers these renderer paths. Full local native headless-GL tests, WebGPU and physical devices were not run. GPU time and allocated GPU byte counts were not measured.

No dependencies, audit exceptions, CI timeouts or retry policies changed.
