# Core repeated Path fill instancing

This extends the ECS prototype in [#683](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/683)
to `packages/core`. Both packages retain independent drawcall implementations.
The feature is experimental and **defaults off**.

```ts
const canvas = await new Canvas({ canvas: element, pathInstancing: true })
    .initialized;
const icon = new Path({
    d: 'M0 0 L18 0 L20 20 L10 14 L0 20 Z',
    fill: '#2563eb',
    strokeWidth: 0,
    batchable: true,
});
canvas.appendChild(icon);
canvas.render();
// Runtime switch; the next render rebuilds the plan.
canvas.pathInstancing = false;
canvas.render();
```

`Path` still defaults to `batchable: false`; explicitly opt in per object.
The constructor now honors that existing attribute. The canvas switch is runtime
render state and does not enter serialized documents. Enabling it preserves
geometry, bounds and picking; it does not replace the original Path with a proxy.

## Ordered planning and fallback

With the switch on, the manager walks the visible render order and only merges
adjacent compatible objects. A page contains at most 4,096 Paths. A one-object run uses ordinary Mesh instead
of paying for instance attributes. Other drawcall
classes retain their compatibility checks and can batch within consecutive runs.
A different path, linear transform, effect or intervening draw breaks the run.
The existing planner remains in use while the switch is off.

An exact key includes path data, fill rule, tessellation method and the world
matrix's four linear entries. Translation, solid color, opacity and fill opacity
vary in 48-byte instance rows. Singular or nonfinite matrices, custom/rough Paths,
wireframes, size attenuation, image/gradient/pattern fills, strokes and shadows
fall back to full Mesh rendering. Ordinary Mesh has no instance attributes, so
unsupported Paths render individually even when `batchable` was requested.
This also corrects the old planner's invalid full-Mesh instancing after disabling
the feature. The benchmark explicitly sets `strokeWidth: 0`; it does not measure
core's existing transparent stroke draw for `stroke: 'none'` with positive width.

A page owns one adaptive geometry cache and three buffers. An unchanged visible
sequence with no dirty shapes reuses its plan on camera-only frames. Capture
intent, dirty shapes or visible membership changes invalidate that plan. Camera changes inside
a precision bucket reuse the triangulation and row buffer. Row comparisons skip
identical uploads; adjacent changed rows share a write, and a failed write stays
pending for retry. Unused geometry-key pages retire immediately. Capture uses
full individual Mesh draws, then restores the screen plan even with `grid: true`.
Capture exceptions clear capture state and restore the screen in `finally`.
Export may retire/recreate screen buffers; it is not a retained bitmap cache.

The tests exposed two core correctness prerequisites: parent changes must mark
descendants dirty, and RBush removal must use the stored previous bounds rather
than a zero rectangle. These are fixed so moved/reentered Paths do not leave old
spatial entries. Drawcall retirement also releases binding-cache references; separated SDF runs
can share scene bindings until their last owner retires. Material rebuilds release
the previous reference. Empty full-Mesh geometry clears old buffers and can become
visible again. Wireframe barycentric buffers and geometry allocated before a
material failure are also released.

## Resource accounting

Core still uses external `@antv/g-device-api` 1.6.13. Its input-layout destructor
only deletes the currently bound VAO. A small compatibility helper finishes
native deletion of an unbound VAO after the normal destructor, without binding it
or changing cached device state. The helper covers both native WebGL2 VAOs and
the WebGL1 extension; WebGPU layouts retain their own destructor. The renderer's
grid uses the same helper.

That external device also retains startup fallback textures, framebuffers and a
buffer after `device.destroy()`. Tests snapshot native counts immediately after
swap-chain/device creation, before renderer resources, and require destruction
to return to that exact baseline. They do not claim a zero-allocation device
teardown. Browser context closure remains responsible for those pre-existing
external resources. New geometry, instance buffers, programs, shaders and VAOs
must all be released. No dependency version or audit policy changed.

## Reproduction and validation

```sh
pnpm exec playwright test -c playwright.core-path-instancing.config.ts
pnpm exec jest -c jest.config.js --runTestsByPath \
  __tests__/unit/core-path-instances.spec.ts \
  __tests__/unit/path.spec.ts __tests__/unit/group.spec.ts --runInBand --coverage=false
PATH_INSTANCE_COUNTS=600,1000 pnpm exec playwright test \
  -c playwright.core-path-instancing-bench.config.ts
```

The benchmark compares the same build with the switch off/on, with 600 or 1,000
actually visible Paths, either one identical geometry or two alternating keys.
Each case has a fresh page; cases run sequentially at 800 × 600 CSS pixels,
DPR 1 and zoom 0.75. After 15 warmup frames, it measures 30 completed synchronous
`Canvas.render()` calls during alternating camera pans. Native counters refer
to the final completed frame, including the grid's background draw. The CPU
samples exclude screenshots, serialization and final state collection; browser
GPU work is asynchronous. Do not compare these values directly with ECS's
`World.execute()` timings or infer physical-device/GPU speedups.

Results are recorded in `core-path-fill-instancing-benchmark.json`. Native
resource counts are live object counts, not allocated bytes or peak memory.

## Observed results

Chromium 140.0.7339.186, Node 24.22.3, Linux, configured SwiftShader:

| Actual visible Paths | Geometry keys | CPU p50/p95 off → on (ms) | Native draws off → on |
| -------------------- | ------------- | ------------------------- | --------------------- |
| 600                  | 1 repeated    | 4.4/8.9 → 0.8/2.2         | 601 → 2               |
| 1,000                | 1 repeated    | 6.4/10.1 → 1.1/2.6        | 1,001 → 2             |
| 600                  | 2 alternating | 4.1/7.0 → 4.4/10.9        | 601 → 601             |
| 1,000                | 2 alternating | 6.8/9.5 → 6.2/9.3         | 1,001 → 1,001         |

At 1,000 repeated Paths, buffers drop from 3,003 to 6. Texture counts remain 7
in both cases: core already uses direct solid-color uniforms. Programs/shaders/
VAOs are 2/4/2 off and 3/6/3 on, since the previously used full-Mesh program stays
cached until canvas destruction. Both submit 9,000 indices and upload one
192-byte scene uniform block during camera-only movement. Vertex attribute
pointer calls drop from 1,001 to 5.

The alternating controls keep 1,803/3,003 buffers, 601/1,001 native draws and
601/1,001 attribute pointer calls respectively. They receive no drawcount
reduction. The 600-object control's p95 is higher with the feature enabled;
short instrumented runs include scheduling/GC variation and do not establish a
no-regression guarantee. Plan reuse and ordinary-Mesh singleton fallback avoid
paying for unused instance attributes, but matching/visibility work still has a
cost. Leave the switch off for scenes without useful adjacent repeats.

Local verification:

-   15 relevant Jest tests in three suites passed, including keys/fallback, paging,
    shared binding ownership, failed-row retry, clean-plan invalidation, empty
    geometry and bounded descriptor buckets.
-   Final core Chromium regression passed 33 cases: nine new cases, eleven existing
    adaptive-path cases and thirteen text-path/documentation cases. After the last
    bounded-cache change, all nine new cases passed again.
-   An earlier 49-case core/ECS combined run passed 47 cases but timed out during
    an existing ECS arc screenshot and crashed on existing ECS DPR-3 navigation.
    Both cases passed separately with the same assertions and timeout. No underlying
    browser crash fix is claimed. A renderer-only server attempt could not load the
    Vue text demo; the final run uses the repository's complete Vite configuration.
-   All eight benchmark cases passed, including exact live visibility, native draws,
    submitted indices, one camera upload, and return to the device baseline.
-   Browser/core TypeScript, ESM/CJS core builds, changed-file ESLint, format and
    Markdown checks passed. Browser CI tooling verifies Chromium/WebKit coverage.
-   Local WebKit was initially unavailable; the CI follow-up below records its
    successful verification after supplying the WPE runtime. Native headless-GL
    tests, native WebGPU, physical devices and a live collaboration session with
    core instancing enabled were not run locally.

No dependencies, production capacity settings, deployment configuration,
assertion tolerances, timeouts or retry policies changed.

## WebKit CI follow-up

The first CI run exposed two real rendering/input problems:

-   Core SDF shapes unpack attenuation flags using bits 22/23. The default
    `mediump` precision can overflow the unpacking arithmetic and make ordinary
    rectangles disappear in WebKit. Both SDF shader stages now request `highp`.
    The existing rectangle/Path barrier test reproduces the failure with the old
    shader and passes after this change, including the nonempty-image assertion.
-   ECS CameraControl releases its transient input points before Select processes
    pointerup. A complete drag delivered between frames, or a final move sharing
    a frame with release, could therefore leave the marquee uncommitted. Select
    now applies the release position with the retained original press before
    finishing the brush. Cancellation and the existing movement threshold remain.

All 16 core/ECS instancing cases pass in both Chromium and iPhone-profile WebKit.
The full selection interaction suite passes 40 cases, including six new tests
for mouse/touch/pen coalesced drags, final release coordinates, cancellation and
sub-threshold motion. A further 115 tests pass across path editing, crop/hierarchy,
vector editing, snapping and camera-pan suites. An initial combined local Jest
process was killed (exit 137); running each suite in a fresh process completed.
No browser assertions, retry policy or timeouts were relaxed; the native marquee
case is unchanged.

For local reproduction, missing WPE libraries were extracted from official Debian
packages into the local Playwright browser cache. Local launches bypassed the
combined host-library precheck with `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`
after supplying the actual WPE dependencies. The project dependencies and CI
configuration were unchanged. The recorded Path-only benchmark was not rerun:
its workload uses neither SDF shapes nor ECS input.
