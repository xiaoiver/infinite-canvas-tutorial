# Stroke geometry working set and optimistic rebuild transfers

Follow-up to #743. This investigation extends the isolated stroke-upload
recorder with a bounded numeric model, exercised against actual **Core and ECS**
StrokeBatch geometry. Production code in both packages is identical to control
`0df7feb121d44e14c80a1cd1737305210439e5c9`; defaults, shaders, documents,
interaction and exports have no implementation change. No changeset is needed.

The model finds enough repeated geometry to justify a resident-geometry
prototype. Its transfer predictions are conditional on a new representation and
ownership/submission design. No GPU residency, upload saving or interaction
speedup has been implemented or measured by this patch.

## Scope and transfer assumptions

The existing observer compares emitted Float32 geometry separately from
translation/order and final packed offsets. Each observed owner has one latest
geometry version per device. Float32 geometry or travel changes increment the
version; placement changes retain it. Core uses its primitive shape ID; ECS
uses weak held-handle identity to separate borrowed/rebound handles. The model
retains only primitive IDs, versions and byte counts, with no entity/GPU handles.

Each hypothetical resident segment uses four RGBA32F texels (64 bytes), enough
for twelve geometry floats and up to three travel floats plus padding. A rebuilt
visible segment additionally transfers four floats (16 bytes) for geometry-row
address, translation and painter order. A new/changed/evicted owner incurs the
entire padded geometry transfer; a hit still incurs current instance bytes.
This preserves the input precision and accounts for the two backends' different
travel strides. It does not prove shader decoding or platform support.

Three independent models use per-device budgets of 1, 4 and 8 MiB. A current
page pins all of its owners before visiting any of them; eviction selects the
least recently used owner outside that page. Changed versions release their
old numeric entry first. An oversized page charges its full existing packed
payload before modifying residency. Empty owners consume no entries. Peaks
include occupancy at the start of a measured step and fold using **maximum**;
transfer/hit/eviction counters sum. Full node partitions and budget bounds are
asserted. Disposal clears all model entries and deletes the injected factory.

The observer is **rebuild-only**. It does not trace every submitted reference on
unchanged pages, pin an entire frame, implement addresses/fragmentation, repair
cached draw references after eviction, or protect concurrent cameras/in-flight
GPU work. Therefore low-budget eviction results are optimistic policy estimates,
not an implementable cache contract. Both [Core submit](../packages/core/src/drawcalls/Drawcall.ts#L119) and
[ECS submit](../packages/ecs/src/drawcalls/Drawcall.ts#L266) prepare dirty geometry
immediately before rendering that drawcall. An unchanged page still reaches
render without a geometry rebuild. A production cache must validate every
submitted reference and use whole-frame/camera leases or a proven
upload/submission sequence. A byte-equal hit also does not prove an immutable
source identity suitable for a cheap runtime cache key.

Other excluded costs include texture dimension/capability constraints, allocation
rounding/holes, reallocation copies, staging/driver storage, extra vertex texture
fetches, CPU packing/lookup overhead, upload failures and rollback. Model peak
bytes count hypothetical geometry payload, not allocated texture size, total
application memory, or measured GPU residency. These are material open questions
for the prototype, especially on WebGL1/WebGPU and multiple active cameras.

## Chromium transfer results

The real Workflow's 4 MiB model has zero evictions, with 2,817,280 peak modeled
geometry bytes. Rebuild transfer would be 8,181,536 / 7,362,400 bytes versus the
existing 19,695,312 / 19,730,160 packed stroke bytes in first/warm traversals.
The 8 MiB model gives identical Workflow counts. Initial setup primes geometry
and the models before either traversal: these totals exclude cold initialization.

The paired Core/ECS trace reaches 4,416,512 modeled geometry bytes at 8 MiB.
At 4 MiB it evicts 970 owner versions each traversal; at 1 MiB it evicts 7,324.
Even this optimistic 1 MiB estimate exceeds Core's current transfer payload,
because misses pay both padded geometry and visible-instance bytes. A small
budget cannot be assumed to improve bandwidth. These budgets are diagnostic
inputs, not new runtime defaults or a claim of an ideal universal setting.

| Workload/backend | Round | Budget MiB | Packed stroke bytes | Modeled geometry + instances bytes | Model peak geometry bytes | Hits / misses / evictions |
| ---------------- | ----- | ---------- | ------------------- | ---------------------------------- | ------------------------- | ------------------------- |
| workflow ecs     | 0     | 1          | 19695312            | 18004704                           | 1048576                   | 3057 / 11935 / 11537      |
| workflow ecs     | 0     | 4          | 19695312            | 8181536                            | 2817280                   | 12010 / 2982 / 0          |
| workflow ecs     | 0     | 8          | 19695312            | 8181536                            | 2817280                   | 12010 / 2982 / 0          |
| workflow ecs     | 1     | 1          | 19730160            | 18018848                           | 1048576                   | 3057 / 11935 / 11517      |
| workflow ecs     | 1     | 4          | 19730160            | 7362400                            | 2817280                   | 12666 / 2326 / 0          |
| workflow ecs     | 1     | 8          | 19730160            | 7362400                            | 2817280                   | 12666 / 2326 / 0          |
| strokes core     | 0     | 1          | 15202624            | 16962192                           | 1048576                   | 1072 / 7324 / 7324        |
| strokes core     | 0     | 4          | 15202624            | 9841424                            | 4194304                   | 5082 / 3314 / 970         |
| strokes core     | 0     | 8          | 15202624            | 8231376                            | 4416512                   | 5988 / 2408 / 0           |
| strokes core     | 1     | 1          | 15202624            | 16962192                           | 1048576                   | 1072 / 7324 / 7324        |
| strokes core     | 1     | 4          | 15202624            | 9841424                            | 4194304                   | 5082 / 3314 / 970         |
| strokes core     | 1     | 8          | 15202624            | 8231376                            | 4416512                   | 5988 / 2408 / 0           |
| strokes ecs      | 0     | 1          | 17102952            | 16962192                           | 1048576                   | 1072 / 7324 / 7324        |
| strokes ecs      | 0     | 4          | 17102952            | 9841424                            | 4194304                   | 5082 / 3314 / 970         |
| strokes ecs      | 0     | 8          | 17102952            | 8231376                            | 4416512                   | 5988 / 2408 / 0           |
| strokes ecs      | 1     | 1          | 17102952            | 16962192                           | 1048576                   | 1072 / 7324 / 7324        |
| strokes ecs      | 1     | 4          | 17102952            | 9841424                            | 4194304                   | 5082 / 3314 / 970         |
| strokes ecs      | 1     | 8          | 17102952            | 8231376                            | 4416512                   | 5988 / 2408 / 0           |

No page exceeds a budget in these traces; explicit unit cases cover oversized
page fallback. The table's model occupancy/evictions must not be interpreted as
actual GL allocations/deletes. Existing `spanUploadBytes` and
`capacityUploadBytes` remain their separate bounding-span/power-of-two models
from #743; none of those counters are native transfer observations.

## Sources, calibration and invariant checks

[Summary data](./stroke-residency-model-benchmark.json) records the ten raw-file
fingerprints, clean source identities, native counter ranges/totals, separate
ordinary timings, diagnostic totals and audit outcomes. Exact raw captures,
source bundle, runners, audits and verification logs are retained privately.

Control is the #743 merge above. Measured Chromium implementation is
`38d7c222eaa9a03c1ace0d45605eca0d7e8c2145`, tree
`f7f1f50034c51b1466627ceaa0a3cd22d7e8292b`. WebKit runs on the later source
identified in the summary, which only adds integration assertions for hit,
placement, invalidation and factory restoration. Final report commits change no
measured model/renderer behavior.

Node v24.22.3, pinned Chromium 140.0.7339.186, headless SwiftShader, DPR 1.
Six serial fresh captures run control ordinary / candidate ordinary / candidate
diagnostic for Workflow, then the same sequence for paired strokes. No other
local tests or profiling overlap those captures. Workflow has 2,400 cards and
2,400 edges, outer viewport 1500 x 980, canvas 1148 x 914 CSS px, the existing
`?imageBatching=1` benchmark entry and twenty trusted pixel-wheel inputs per
traversal. Paired strokes use 2,400 paths, twelve fixed poses, viewport
1000 x 760 and canvas 800 x 600. First/warm/backend boundaries remain separate.

Every corresponding semantic, requested/reached view, full visible membership,
surface, document/theme/version, native draw/index/array-vertex/upload counter,
live resource/capacity table, geometry-call count and existing phase-call count
matches exactly across control ordinary, candidate ordinary and diagnostic.
Clock arithmetic, document equality, GPU gates/positive controls and teardown
pass. Diagnostics are rejected by ordinary qualifiers, including if their mode
is stripped but counters/restoration fields remain. No comparison thresholds
are weakened to admit the new recorder.

Workflow still submits 3–22 native draws, 15,516–633,846 indices and four array
vertices per frame, with 36–2,400 visible cards and edges. The paired trace
retains 0–11 draws, 0–999,000 indices and 0–2,400 visible paths. Indices are
submitted references, not unique vertices. Current native upload and allocation
work remains the #743 path; the hypothetical transfer table does not replace it.

The following ordinary scopes are calibration records on identical renderer
code, not speedup evidence. No diagnostic timings are pooled. Engine elapsed
wall time includes synchronous native waits and ends before membership/resource
observation; it is not process CPU usage, GPU completion or presented FPS.
Nearest-rank p50/p95 is used; paired p95 is the maximum of twelve poses. Core
synchronous and ECS awaited boundaries differ. No repeated timing cohort or
statistical performance acceptance is claimed.

| Workload/backend | Source   | Round | Engine p50 / p95 / total ms |
| ---------------- | -------- | ----- | --------------------------- |
| workflow ecs     | control  | 0     | 17.6 / 78.4 / 736.1         |
| workflow ecs     | control  | 1     | 13.6 / 62.6 / 536.5         |
| workflow ecs     | ordinary | 0     | 16.9 / 89.1 / 704.7         |
| workflow ecs     | ordinary | 1     | 12.2 / 67.6 / 554.0         |
| strokes core     | control  | 0     | 6.0 / 63.6 / 164.0          |
| strokes core     | control  | 1     | 3.8 / 13.8 / 55.0           |
| strokes ecs      | control  | 0     | 13.1 / 108.2 / 365.0        |
| strokes ecs      | control  | 1     | 11.2 / 36.3 / 179.3         |
| strokes core     | ordinary | 0     | 5.1 / 50.3 / 150.4          |
| strokes core     | ordinary | 1     | 3.0 / 12.8 / 46.5           |
| strokes ecs      | ordinary | 0     | 14.0 / 74.3 / 325.5         |
| strokes ecs      | ordinary | 1     | 16.1 / 41.0 / 204.5         |

WebKit build 2388 additionally runs ordinary/diagnostic pairs on the fixed
2,400-stroke Core/ECS trace and the small 24-card trusted-wheel protocol. The
observer preserves exact native/resource/geometry-call and semantic data in both
pairs. The 24-card run is a portability/correctness check; it is not a WebKit
2,400-card performance claim. WebKit metrics remain separate in the summary.
Only its host-requirements preflight is skipped; actual browser assertions run.

## Validation and reproduction

Passed locally: twenty pure-model/observer cases, 143 tooling cases, browser
and Workflow benchmark TypeScript projects, and repository zero-warning ESLint.
Nine new model cases cover relocation reuse, version replacement/revisits,
LRU/reentry, later-page-member pinning, oversized fallback before mutation,
independent models, zero-length ownership, clear/reuse and invalid inputs.
Observer integration assertions check unchanged/moved hits, changed-geometry
misses and restoration. Tooling verifies peak maxima rather than cumulative
peak sums and rejects budget overflow. All ten canonical browser captures pass.

```sh
# Existing ordinary protocols; keep diagnostics/phases/timelines unset.
WORKFLOW_INPUT_COUNT=2400 pnpm bench:workflow-input
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts

# Count-only models. Use fresh separate output directories.
STROKE_UPLOAD_DIAGNOSTIC=1 WORKFLOW_INPUT_COUNT=2400 pnpm bench:workflow-input
STROKE_UPLOAD_DIAGNOSTIC=1 pnpm exec playwright test -c playwright.camera-replay-bench.config.ts

pnpm exec jest -c jest.config.js --runInBand --coverage=false --runTestsByPath __tests__/unit/stroke-residency-model.spec.ts __tests__/unit/stroke-upload-probe.spec.ts
pnpm test:tooling
```

Pin `WORKFLOW_CHROMIUM` and select fresh `WORKFLOW_INPUT_OUTPUT_DIR` /
`CAMERA_REPLAY_OUTPUT_DIR` for each source/mode. The private archive's runners
record the serial source/order/browser paths and refuse existing capture output
folders. Source must be clean before every capture. Cached dependency CLIs ran
without a fresh pnpm 9.15.9 install. Explicit checks precede per-command hook
bypass because this restored checkout lacks generated Husky helpers.

Not run locally: full renderer unit/browser suites, package/site/packed builds,
hardware GPU/WebGPU, shader/texture residency, retained-heap attribution or
continuous wheel/pinch physical-presentation acceptance. Production source is
unchanged, and this patch does not close the 2,400-node smoothness target.
Remote CI is reported separately in the PR.

## Next prototype and acceptance boundary

Implement a guarded resident-geometry prototype in Core and ECS together,
starting with a supported WebGL2 device. It must collect every current draw
reference (including unchanged cached pages), protect geometry versions across
whole frames/cameras and bind slots only after successful uploads. Device/format
and memory failure use the existing packed StrokeBatch path; full exports and
unsupported styles retain their current constructors. Keep the new path opt-in
until actual end-to-end measurements support it.

Validate the shader's exact geometry/travel decoding and painter order, distinct
precision versions in concurrent cameras, same-frame deletion, culling/reentry,
source edits, upload/allocation failure recovery, migration, resource teardown
and isolated full exports. Measure real current visible sets, native uploads,
texture/buffer allocation and peak storage, CPU frame/input tails and the
prototype's own lookup/packing/fetch costs. A whole-frame lease trace must
quantify the model's missing cached-reference work. Retain the runtime only on
its own correctness and ordinary-input results; theoretical bytes saved are
insufficient to establish smoother interaction.
