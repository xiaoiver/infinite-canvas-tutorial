# Page-owned stroke geometry textures: measured, then withheld

After #744, a real WebGL2 geometry-texture prototype was implemented in **both Core and ECS**. Actual transfer and logical storage costs improved, but ordinary input did not show stable latency improvement. **The runtime, API, shader and producer changes are withdrawn.** All `packages/` sources remain byte-identical to `d25a6bd8bd6ea6cfddb8b3ae33ac7f88bdf97ca3`.

The retained changes are a native texture-transfer recorder, qualification and comparison tools, tests, this report and an exact experimental patch. They do not enable residency or alter rendering defaults.

## What was tested

The device texture API exposes whole-image uploads, without a subregion upload operation. Instead of relying on private GL internals or changing dependencies, the prototype owns an RGBA32F geometry texture per StrokeBatch. It has no shared slot allocator or eviction. This differs from the shared-residency model in #744; its results must not be presented as validation of that model.

One texel holds each original `(x, y, joint, padding)` point. Each segment instance contains a point address, translation, painter order and travel (20 bytes in Core, 28 in ECS). The vertex shader fetches four adjacent points and takes the original joint from PointA. Textures have fixed width 256 and at most 256 rows (1 MiB/page, including padding). Placement-only edits retain geometry. Precision/membership changes repack the page and use a full texture upload when the bit-exact snapshot changes. An independent instance buffer is still uploaded. This is neither zero-copy nor allocation-free.

The experimental switch defaults off; only eligible stroke pages enter the supported WebGL2 path. Existing full constructors and raster exports retain the packed path. Malformed, empty, oversized and unsupported pages fall back before allocation. Each page owns its mutable resources; only immutable vertex/index constants are shared. Replacement handles publish after successful uploads; failed writes invalidate the CPU snapshot for retry. This design avoids stale shared-slot references on cached submissions, but does not implement global reuse or bound total storage by a shared budget.

## Exact source and reproduction

Measured source: `080b1071c8c4d7ccf280238465ac09dba580dd1f`, tree `808d2ed8689c3efe2660b7b717586d3eefacf509`, based on #744 merge `d25a6bd8bd6ea6cfddb8b3ae33ac7f88bdf97ca3`. This is the experimental source identity, not the final report PR head. The patch includes both runtime and matching benchmark instrumentation, and can be applied to a clean worktree at the base without depending on a private branch.

```sh
git worktree add /tmp/stroke-texture-experiment d25a6bd8bd6ea6cfddb8b3ae33ac7f88bdf97ca3
# In that worktree, apply the patch from this report checkout:
git apply /path/to/report/docs/perf-experiments/stroke-texture.patch
git add . && git commit -m "perf: reproduce stroke texture experiment"
# Keep diagnostics/phases/timelines unset; use distinct fresh output folders.
STROKE_TEXTURE_BENCH=0 WORKFLOW_INPUT_COUNT=2400 WORKFLOW_INPUT_OUTPUT_DIR=/tmp/captures/workflow/packed-1 pnpm bench:workflow-input
STROKE_TEXTURE_BENCH=1 WORKFLOW_INPUT_COUNT=2400 WORKFLOW_INPUT_OUTPUT_DIR=/tmp/captures/workflow/texture-1 pnpm bench:workflow-input
# Repeat texture-2 then packed-2, each in a fresh browser page.
# Run the same 0 / 1 / 1 / 0 order with CAMERA_REPLAY_OUTPUT_DIR for paired strokes:
STROKE_TEXTURE_BENCH=0 CAMERA_REPLAY_OUTPUT_DIR=/tmp/captures/strokes/packed-1 pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
# From the report checkout, qualify and audit all eight captures:
node scripts/compare-stroke-textures.mjs /tmp/captures > comparison.json
```

Pin `WORKFLOW_CHROMIUM` consistently. Source must be clean for every capture; applying the patch creates the same measured tree, although the reproduction commit identity will differ. The comparison requires all eight captures to share the same source identity. The public [summary](./stroke-texture-evaluation-benchmark.json) includes raw-file byte counts/SHA-256, exact source identities, complete timing/transfer summaries, resource ranges and strict audit outcomes. A private review archive retains every raw capture, source bundle, runner/audit scripts and logs, including failed preliminary checks. No unfavorable capture is replaced by a favorable rerun.

## Protocol and actual latency

Node 24.22.3, Chromium 140.0.7339.186, headless SwiftShader, DPR 1, shared cloud host. Eight serial fresh-page captures ran packed / texture / texture / packed for Workflow, then the same sequence for paired strokes. No tests or diagnostics overlapped ordinary timings. Both controls install the same texture observer; these timings form a separate scope from recordings without it. The observer counts native calls without new timers or GPU queries.

Workflow uses the real ECS example with 2,400 cards + 2,400 edges, twenty trusted pixel-wheel events per traversal, outer viewport 1500 x 980 and actual surface 1148 x 914. Each target completes before the next event. The separate Core/ECS protocol uses 2,400 paths and twelve fixed camera poses on an 800 x 600 surface, including offscreen culling, reentry and idle. Round 0 and warm round 1 are reported separately. Engine elapsed is wall time and may include synchronous native waits; it is not process CPU time, GPU completion, continuous gesture FPS or physical presentation. For twelve poses, nearest-rank p95 is the maximum.

| Workload/backend | Capture   | Round | Engine p50 / p95 / total ms | Input/operation-to-frame p50 / p95 ms |
| ---------------- | --------- | ----- | --------------------------- | ------------------------------------- |
| workflow ecs     | packed-1  | 0     | 13.9 / 99.8 / 730.5         | 14.2 / 100.0                          |
| workflow ecs     | packed-1  | 1     | 13.8 / 64.2 / 492.2         | 13.8 / 64.5                           |
| workflow ecs     | texture-1 | 0     | 18.5 / 88.1 / 773.0         | 18.6 / 88.4                           |
| workflow ecs     | texture-1 | 1     | 18.7 / 78.5 / 584.8         | 18.9 / 78.7                           |
| workflow ecs     | texture-2 | 0     | 12.9 / 67.4 / 574.8         | 15.0 / 67.6                           |
| workflow ecs     | texture-2 | 1     | 18.3 / 60.9 / 463.1         | 19.8 / 61.0                           |
| workflow ecs     | packed-2  | 0     | 17.0 / 82.9 / 664.7         | 17.2 / 83.0                           |
| workflow ecs     | packed-2  | 1     | 13.1 / 70.7 / 516.0         | 14.8 / 70.9                           |
| strokes core     | packed-1  | 0     | 5.9 / 66.4 / 191.6          | 5.9 / 66.4                            |
| strokes core     | packed-1  | 1     | 3.6 / 15.9 / 61.6           | 3.6 / 15.9                            |
| strokes ecs      | packed-1  | 0     | 10.9 / 112.1 / 331.6        | 18.4 / 126.7                          |
| strokes ecs      | packed-1  | 1     | 11.6 / 54.2 / 193.6         | 16.7 / 54.7                           |
| strokes core     | texture-1 | 0     | 4.0 / 48.0 / 125.4          | 4.0 / 48.0                            |
| strokes core     | texture-1 | 1     | 5.6 / 16.8 / 70.4           | 5.6 / 16.8                            |
| strokes ecs      | texture-1 | 0     | 19.7 / 81.6 / 424.5         | 30.7 / 95.9                           |
| strokes ecs      | texture-1 | 1     | 12.9 / 72.9 / 274.9         | 18.7 / 81.8                           |
| strokes core     | texture-2 | 0     | 5.7 / 50.4 / 146.4          | 5.7 / 50.4                            |
| strokes core     | texture-2 | 1     | 3.8 / 15.8 / 63.6           | 3.9 / 15.8                            |
| strokes ecs      | texture-2 | 0     | 10.8 / 64.9 / 268.7         | 22.8 / 75.7                           |
| strokes ecs      | texture-2 | 1     | 12.8 / 59.8 / 219.3         | 19.6 / 66.2                           |
| strokes core     | packed-2  | 0     | 5.6 / 43.7 / 136.4          | 5.7 / 43.7                            |
| strokes core     | packed-2  | 1     | 4.1 / 12.2 / 57.1           | 4.1 / 12.2                            |
| strokes ecs      | packed-2  | 0     | 14.7 / 111.2 / 347.6        | 23.8 / 114.6                          |
| strokes ecs      | packed-2  | 1     | 9.8 / 44.8 / 193.5          | 20.1 / 50.6                           |

Workflow warm p50 rises in both pairs: **13.8 -> 18.7 ms** and **13.1 -> 18.3 ms**. Warm p95 improves in one pair and worsens in the other. Paired ECS warm p95 worsens in both pairs: **54.2 -> 72.9 ms** and **44.8 -> 59.8 ms**; totals also worsen (193.6 -> 274.9 ms, 193.5 -> 219.3 ms). Core warm total/p95 do not improve either. First-round results vary. These samples do not establish a statistical regression across devices, but they fail the acceptance condition for retaining this runtime.

## Actual transfers, submissions and storage

Native `bufferBytes` already includes uniform writes; uniforms are not added again. Known typed texture bytes are added separately. All measured DOM/source-offset/PBO upload counts are zero, so the combined transfer totals below have no unknown source extent. The recorder deliberately leaves a total unknown if such a call occurs. Counts cover submitted JavaScript source bytes and logical native allocations; they do not measure driver compression, physical GPU memory or texture-cache behavior.

| Workload/backend | Round | Packed buffer bytes | Texture-mode buffer bytes | Texture typed bytes | Combined bytes |
| ---------------- | ----- | ------------------- | ------------------------- | ------------------- | -------------- |
| workflow ecs     | 0     | 21113128            | 9077104                   | 5386240             | 14463344       |
| workflow ecs     | 1     | 21147976            | 9090656                   | 5447680             | 14538336       |
| strokes core     | 0     | 15208704            | 4756900                   | 2887680             | 7644580        |
| strokes core     | 1     | 15208704            | 4756900                   | 2879488             | 7636388        |
| strokes ecs      | 0     | 17108488            | 6656684                   | 2912256             | 9568940        |
| strokes ecs      | 1     | 17108488            | 6656684                   | 2879488             | 9536172        |

Corresponding captures repeat these native transfer counts exactly within each mode. Combined transfers decrease about 31% in Workflow, 50% in Core strokes and 44% in ECS strokes; these are bandwidth observations, not smoothness improvements.

Workflow post-frame logical buffer + RGBA32F storage ranges **156,116–3,322,588 bytes** packed and **110,612–2,235,932 bytes** textured. The texture-only within-frame peak is **851,968 bytes** first / **843,776 bytes** warm. Paired stroke texture-only peaks are Core **1,212,416 / 1,208,320 bytes**, ECS **1,224,704 / 1,208,320 bytes**. These maxima include staged old/new textures, rather than only after-frame live handles. Buffer within-frame peaks were not recorded, so a combined peak is not claimed. Paired traces record buffer object counts but not buffer byte capacities. CPU copies, driver memory and resident-heap ownership are not quantified.

Workflow retains **36–2,400 visible cards/edges**, **3–22 drawcalls**, **15,516–633,846 submitted indices** and four array vertices/frame. Paired strokes retain **0–2,400 visible paths**, **0–11 draws**, **0–999,000 indices** and **0–4 array vertices/frame**. Indices are submitted references, not unique vertices. Native submission, uniform work and full visible identity sets match exactly. Textured pages actually draw in both backends; unchanged/idle frames can retain live textures while issuing zero draws. More efficient transfer does not eliminate page repacking, material/binding work, texture fetching or synchronous waits. Their isolated costs were not measured, so this report does not attribute the latency difference to a particular one.

## Audit and verification

All eight captures pass canonical source/clock/document/teardown qualification. Corresponding steps have exact requested/reached views, input anchors, surfaces, full visible membership, theme/version/document state, precision/geometry call counts, phase call counts, draw/index/array-vertex and uniform work. All non-buffer/texture resource counts match. Only explicit representation work/storage can differ. Repeats within each mode additionally match every recorded native/texture counter and resource/storage snapshot per frame. The tool never relaxes the existing ordinary comparator to accept arbitrary native differences.

The retained tests reject mixed observed/unobserved scopes, dirty or different source, changed visible membership, geometry/phase calls, draw/uniform work, other resources, repeat allocation/upload/storage drift and incomplete teardown/restoration. They verify buffer+texture byte accounting, unknown upload extents and peak maximum rather than peak sums. Four recorder unit cases cover inherited API deduplication, active texture units, staging/retirement, descriptor restoration and disabled retained wrappers.

On the frozen prototype, passed: thirteen Core helper/recorder tests, nine ECS helper tests, Core/ECS typechecks, browser/Workflow benchmark typechecks, zero-warning ESLint, 145 tooling tests, eighteen Chromium stroke regressions and two WebKit texture pixel/ownership cases (build 2388). The eighteen Chromium cases include sixteen pre-existing cases with the experimental switch off; they are not comprehensive texture-mode coverage. The two new cases per browser/backend check actual texture activation, exact draw/index/document parity, moved pixels, mode flips, precision revisits and teardown. WebKit skips host preflight only; real browser assertions run.

Not completed for the rejected prototype: all combinations of texture-mode picking/history, multiple cameras/migration, complex-style edits, same-frame deletion/export, explicit instance-upload fault injection, hardware GPU/WebGPU testing, physical GPU memory or continuous wheel/pinch presentation acceptance. No allocation/format failure auto-fallback guarantee beyond the tested capability/size gates is claimed. Staged failure cleanup and retry are tested; a thrown GPU allocation remains an error. The patch is experimental evidence, not a supported API.

On the final retained sources, passed: 148 tooling tests, four recorder unit cases, browser and Workflow benchmark TypeScript projects, zero-warning repository ESLint, the strict eight-capture audit, and `git diff --check`. Applying the experimental patch to a temporary index at the base reconstructs the exact measured tree. Full package/site builds and full renderer suites were not rerun for the retained test/report changes; remote CI is reported separately in the PR. No dependency changes or changeset is needed: no runtime behavior/API ships. The 2,400-node smoothness target remains open.

## Next implementation direction

Stop pursuing per-vertex texture reads as the next default path on this evidence. Use the existing separated phase/upload diagnostics to locate the long-frame cost when culling changes ordered page membership, then prototype retaining/incrementally rebuilding those CPU pages in Core and ECS together. Keep painter barriers, eligibility, precision versions and export isolation explicit. Measure the same ordinary-input protocol before retaining another runtime change; shared-budget geometry residency remains a separate, unproven design.
