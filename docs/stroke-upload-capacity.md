# Bounded stroke upload capacity in Core and ECS

Follow-up to #742. Screen `StrokeBatch` pages in **both** renderers retain their
writable segment/travel buffers while the next geometry fits. New storage rounds
to 16 segment rows; a rebuild below half capacity shrinks it. A nonempty rebuilt
page therefore retains at most the larger of 16 rows and twice its active rows.
The draw still submits only the current instance count and uploads the complete
current point/travel arrays. There is no CPU byte mirror or partial-upload path.

This reduces resource allocation work with a measured memory cost. It does not
establish smooth interaction for the real 2,400-card + 2,400-edge Workflow.
Runtime defaults, compatibility, sampling precision, page membership, painter
order, documents, history/collaboration, picking and full exports use their
existing paths. No dependency, lockfile, shader or package import changes.

## Ownership and failure handling

Capacity is one scalar on the page, alongside its existing dynamic handles.
There is no idle pool or retained entity key. Device-specific immutable constants
continue to use the existing lease. Growth stages both dynamic allocations and
any initial lease before replacing ownership; a failed allocation retires only
its new partial storage. Current buffers remain owned after an upload failure;
a successful retry writes both complete current arrays. Destruction releases
owned dynamic buffers once, detaches shared handles and releases the lease.

Shared Core/ECS contracts check current uploaded bytes after repeated placement
edits, growth, shrink, allocation failure with/without retry, and a partial write
followed by an upload exception with/without retry. Browser tests require zero
new buffers for warm placement edits while both current arrays are uploaded;
an intermediate moved frame must match the unbatched full path. Existing tests
continue to cover precision revisits, camera migration, culling/reentry,
same-frame removal, selection/history, WebGL1 attributes, exports and teardown.

## Why a bounding upload span is insufficient

The new optional `STROKE_UPLOAD_DIAGNOSTIC=1` mode observes the original emitted
Float32 geometry in the canonical trusted-wheel and paired camera benchmarks.
It records node geometry separately from placement/order and final packed-page
snapshots. Weak device/page keys and ECS held-handle identities distinguish
concurrent/rebound borrowed handles without retaining entities. Float32 bit
comparisons include signed zero. Geometry is primed before measured input.

Across Workflow traversals, 12,010 / 12,666 of 14,992 node samples have identical
emitted geometry (80.1% / 84.5%). Yet those values move to different packed offsets
when visible membership changes. One optimistic bounding changed interval per
point/travel buffer would upload 19,623,972 / 19,666,456 of the actual
19,695,312 / 19,730,160 packed stroke bytes: only about 0.36% / 0.32% saved.
These are stroke-page payloads, excluding other buffers and uniforms.

| Workload/backend | Round     | Unchanged / all node samples | Placement changes | Packed bytes | Modeled bounding-span bytes |
| ---------------- | --------- | ---------------------------- | ----------------- | ------------ | --------------------------- |
| Workflow ECS     | 0         | 12010 / 14992                | 0                 | 19695312     | 19623972                    |
| Workflow ECS     | 1         | 12666 / 14992                | 0                 | 19730160     | 19666456                    |
| paired Core      | 0, 1 each | 5988 / 8396                  | 2144              | 15202624     | 12664284                    |
| paired ECS       | 0, 1 each | 5988 / 8396                  | 0                 | 17102952     | 13890036                    |

`spanUploadBytes` is an optimistic same-offset interval model, not an actual GL
counter. `capacityUploadBytes` and `capacityAllocations` additionally model a
power-of-two, minimum-16 capacity with **no shrinking**; those fields are not the
retained runtime policy or measured native allocations. Inactive tails are not
modeled as reusable history. Snapshot copying, comparison and identity work add
diagnostic overhead, so no diagnostic timings enter ordinary comparisons.

Positive class/module load counts and node partitions are asserted. Methods are
restored by original descriptors before renderer teardown, numeric histories
are cleared and the global entry is deleted. The Vite-rewritten module still
contains an inactive optional observer call until the page closes; this is not
a claim to restore pristine module source. Ordinary mode installs no extra
hooks. Ordinary qualifiers reject both the explicit mode and residual counter /
restoration fields even if the mode is removed. Final diagnostics have exactly
matching ordinary native/resource/geometry-call and semantic data at every pose;
weak-held identity counts also match the first diagnostic cohort.

## Qualified sources and capture boundary

[Summary data](./stroke-upload-capacity-benchmark.json) preserves all sources,
26 raw-capture SHA-256 fingerprints, both ordinary cohorts, diagnostic totals
and exact audit results. Repeated work is represented by control-1/candidate-1
in summary work rows only after exact repeat equality; all timing rows remain.
The private archive retains every raw frame, audit, reproduction command,
source bundle and validation/failure log. No ordinary sample was discarded.

| Source                                   | Commit                                     | Tree                                       |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Control, #742 merge                      | `9c490cde91982c18b5f26a01a7dc6b91cd7eb711` | recorded in summary                        |
| Tooling-only ordinary/diagnostic control | `e791d106c67778eac2b59b1ae16b124aaadbe4d8` | recorded in summary                        |
| Rejected power-of-two runtime            | `d7d933adffaed138e4ce4a8eeb5bdd538fa47dc5` | `ed8482fa43d7d6d8917de0b9e70dbedbece02a58` |
| Retained 16-row runtime                  | `bd25a5097f0a8bf05a898db99416c84921725480` | `502d02d0dc7a34560c2b306c0c35546505fec0f7` |

All measured worktrees are clean. Each ordinary cohort runs eight serial fresh
pages: control-1 / candidate-1 / candidate-2 / control-2 for Workflow, then the
same order for paired strokes. No other task-local tests, extra diagnostics,
CDP profiling or timelines overlap those ordinary measurements. Diagnostic
captures run separately; their timings are excluded. Tooling-only ordinary
captures also match the unmodified control's semantic/native/resource/call-count
fields exactly. The final report commit changes no measured renderer behavior.

Node v24.22.3, Chromium 140.0.7339.186, headless SwiftShader, DPR 1. Workflow has
2,400 cards + 2,400 edges, outer viewport 1500 x 980 and canvas 1148 x 914 CSS px.
Each traversal has twenty trusted pixel-wheel events and one engine execution
per event. Workflow uses the existing `?imageBatching=1` benchmark entry;
the demo defaults are unchanged. The paired trace has 2,400 paths, twelve poses and an 800 x 600 canvas
inside 1000 x 760. First (0) and warm (1) traversals stay separate; setup already primes the
coarse overview, so round 0 is not full application startup.

Times below are engine elapsed wall time, including synchronous native waits;
they are not process CPU counters, GPU completion or physically presented FPS.
Workflow input ends at completed engine execution, before the subsequent
membership/resource observation. Core synchronous and ECS awaited operation
boundaries differ. Nearest-rank paired p95 at twelve poses is the maximum.

## Retained 16-row results

| Workload/backend | Run         | Round | Engine p50 / p95 / total ms | Input/operation p50 / p95 ms |
| ---------------- | ----------- | ----- | --------------------------- | ---------------------------- |
| workflow ecs     | control-1   | 0     | 16.4 / 82.9 / 633.0         | 16.6 / 83.1                  |
| workflow ecs     | control-1   | 1     | 18.1 / 54.1 / 485.7         | 18.3 / 54.5                  |
| workflow ecs     | candidate-1 | 0     | 11.4 / 70.5 / 533.2         | 11.5 / 71.9                  |
| workflow ecs     | candidate-1 | 1     | 11.6 / 52.1 / 455.4         | 11.9 / 52.3                  |
| workflow ecs     | candidate-2 | 0     | 18.4 / 79.9 / 602.2         | 20.7 / 80.0                  |
| workflow ecs     | candidate-2 | 1     | 16.5 / 76.7 / 588.6         | 17.2 / 76.9                  |
| workflow ecs     | control-2   | 0     | 14.1 / 60.9 / 615.3         | 14.5 / 61.1                  |
| workflow ecs     | control-2   | 1     | 15.5 / 69.5 / 586.6         | 15.9 / 69.7                  |
| strokes core     | control-1   | 0     | 4.2 / 65.6 / 162.7          | 4.2 / 65.6                   |
| strokes core     | control-1   | 1     | 3.3 / 15.8 / 60.2           | 3.3 / 15.8                   |
| strokes ecs      | control-1   | 0     | 15.9 / 116.1 / 363.2        | 22.4 / 124.8                 |
| strokes ecs      | control-1   | 1     | 10.4 / 51.5 / 177.6         | 17.6 / 57.7                  |
| strokes core     | candidate-1 | 0     | 5.4 / 52.0 / 150.7          | 5.4 / 52.0                   |
| strokes core     | candidate-1 | 1     | 2.8 / 10.2 / 43.6           | 2.8 / 10.2                   |
| strokes ecs      | candidate-1 | 0     | 10.4 / 73.7 / 278.7         | 22.2 / 80.9                  |
| strokes ecs      | candidate-1 | 1     | 11.7 / 53.0 / 215.4         | 18.5 / 55.8                  |
| strokes core     | candidate-2 | 0     | 3.8 / 48.5 / 143.5          | 3.8 / 48.5                   |
| strokes core     | candidate-2 | 1     | 2.7 / 11.4 / 45.5           | 2.7 / 11.4                   |
| strokes ecs      | candidate-2 | 0     | 10.7 / 58.7 / 256.7         | 24.4 / 65.7                  |
| strokes ecs      | candidate-2 | 1     | 10.0 / 42.6 / 163.8         | 18.5 / 46.8                  |
| strokes core     | control-2   | 0     | 7.5 / 68.2 / 203.7          | 7.5 / 68.2                   |
| strokes core     | control-2   | 1     | 4.9 / 23.3 / 80.5           | 4.9 / 23.3                   |
| strokes ecs      | control-2   | 0     | 9.5 / 72.4 / 250.1          | 24.2 / 82.6                  |
| strokes ecs      | control-2   | 1     | 8.5 / 43.3 / 161.6          | 18.6 / 58.5                  |

Workflow creates/deletes/allocations change **177 -> 119 first / 81 warm**.
Paired Core and ECS each change **95 -> 65 first / 67 warm**. Every matching
frame retains exact drawcalls, indices, array vertices, upload calls/bytes,
uniform calls/bytes, live resource counts, geometry-call counts and existing
phase-call counts. Paired ARRAY_BUFFER binds decrease with avoided allocations;
other native counters match. Requested/reached views, full visible membership,
surfaces, document/theme/version state, input payloads and clock arithmetic are
audited. Capacity bytes are recorded rather than normalized away.

Workflow live tracked buffer bytes range **94,772–3,170,524 control** versus
**156,116–3,322,588 retained**: peak +152,064 bytes (4.8%). This tracks GL buffer
storage sizes, not physical GPU/driver residency or JS heap. These are
post-frame samples; staged replacement can temporarily own old and new pairs
between samples. Full upload payload
is unchanged at 21,113,128 first / 21,147,976 warm bytes per traversal. Paired
Core/ECS payload remains 15,208,704 / 17,108,488 bytes. Workflow visibility is
36–2,400 cards and 36–2,400 edges plus zero/one overlay; draws range 3–22 and
indices 15,516–633,846 per frame. Paired visibility is 0–2,400 paths, draws 0–11,
indices 0–999,000. Indices are submitted references, not unique vertices.

Timing remains mixed. Paired Core warm totals decrease in both pairs. Workflow
warm total decreases in pair 1 but slightly increases in pair 2, whose p95 also
increases. ECS warm total increases in both pairs (215.4 vs 177.6 and 163.8 vs
161.6 ms). The retained policy is a bounded resource-work reduction with these
explicit costs; no stable whole-application speedup, causal native-stall
attribution or 60-FPS acceptance is claimed.

## Rejected power-of-two experiment

The first runtime grows to powers of two and shrinks below quarter capacity.
It reduces Workflow buffer creates from 177 to 77 per traversal but increases
peak tracked bytes from 3,170,524 to 5,653,084 (78.3%). ECS warm totals increase
in both pairs, and Workflow tails vary. This version is not retained. The
following complete cohort is separate from the revised policy above.

| Workload/backend | Run         | Round | Engine p50 / p95 / total ms | Input/operation p50 / p95 ms |
| ---------------- | ----------- | ----- | --------------------------- | ---------------------------- |
| workflow ecs     | control-1   | 0     | 15.4 / 63.4 / 611.7         | 15.5 / 63.5                  |
| workflow ecs     | control-1   | 1     | 19.3 / 58.0 / 523.5         | 19.9 / 58.2                  |
| workflow ecs     | candidate-1 | 0     | 15.7 / 82.1 / 661.2         | 15.8 / 82.3                  |
| workflow ecs     | candidate-1 | 1     | 19.6 / 71.7 / 577.1         | 19.8 / 71.9                  |
| workflow ecs     | candidate-2 | 0     | 15.7 / 82.8 / 684.4         | 15.9 / 83.0                  |
| workflow ecs     | candidate-2 | 1     | 13.0 / 51.4 / 445.4         | 13.3 / 51.5                  |
| workflow ecs     | control-2   | 0     | 18.4 / 101.0 / 737.7        | 18.6 / 101.2                 |
| workflow ecs     | control-2   | 1     | 21.0 / 68.7 / 545.4         | 21.5 / 68.9                  |
| strokes core     | control-1   | 0     | 6.2 / 53.3 / 153.8          | 6.2 / 53.3                   |
| strokes core     | control-1   | 1     | 4.4 / 24.6 / 74.7           | 4.4 / 24.6                   |
| strokes ecs      | control-1   | 0     | 14.9 / 92.1 / 332.7         | 23.1 / 95.5                  |
| strokes ecs      | control-1   | 1     | 9.5 / 45.7 / 165.2          | 18.9 / 56.3                  |
| strokes core     | candidate-1 | 0     | 3.7 / 47.2 / 134.6          | 3.7 / 47.2                   |
| strokes core     | candidate-1 | 1     | 3.8 / 16.2 / 59.6           | 3.8 / 16.2                   |
| strokes ecs      | candidate-1 | 0     | 15.6 / 82.6 / 307.4         | 21.5 / 91.8                  |
| strokes ecs      | candidate-1 | 1     | 15.6 / 87.2 / 294.1         | 18.7 / 105.9                 |
| strokes core     | candidate-2 | 0     | 4.1 / 67.8 / 170.3          | 4.1 / 67.8                   |
| strokes core     | candidate-2 | 1     | 4.7 / 25.8 / 82.5           | 4.7 / 25.8                   |
| strokes ecs      | candidate-2 | 0     | 10.0 / 76.9 / 283.3         | 22.2 / 83.7                  |
| strokes ecs      | candidate-2 | 1     | 17.2 / 49.9 / 198.0         | 25.6 / 56.0                  |
| strokes core     | control-2   | 0     | 6.7 / 78.2 / 231.7          | 6.7 / 78.2                   |
| strokes core     | control-2   | 1     | 6.7 / 35.6 / 111.1          | 6.7 / 35.6                   |
| strokes ecs      | control-2   | 0     | 9.2 / 160.6 / 366.1         | 21.5 / 172.3                 |
| strokes ecs      | control-2   | 1     | 10.2 / 34.0 / 166.8         | 23.1 / 47.7                  |

## Reproduction and validation

```sh
# Ordinary cohorts, use a fresh output directory per checkout/run.
WORKFLOW_INPUT_COUNT=2400 pnpm bench:workflow-input
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts

# Separate count-only captures; never use their timings as ordinary results.
STROKE_UPLOAD_DIAGNOSTIC=1 WORKFLOW_INPUT_COUNT=2400 pnpm bench:workflow-input
STROKE_UPLOAD_DIAGNOSTIC=1 pnpm exec playwright test -c playwright.camera-replay-bench.config.ts

pnpm test:browser 'stroke-batching|camera-replay|path-instances|image-batching'
pnpm test:browser:webkit 'stroke-batching|camera-replay|path-instances|image-batching'
pnpm test:workflow
pnpm test:tooling
```

Set `WORKFLOW_CHROMIUM` identically on every checkout; use distinct
`WORKFLOW_INPUT_OUTPUT_DIR` / `CAMERA_REPLAY_OUTPUT_DIR` paths. Ordinary cohorts
must have `STROKE_UPLOAD_DIAGNOSTIC`, `CAMERA_PHASES` and `CAMERA_TIMELINE_DIR`
unset. The private archive's `run-ab.py` and `run-ab-power2.py` preserve orders
and executable paths; use `reproduce-ab.py` with exact bundled sources and a new
output directory (it rejects source mismatches and existing output paths). Audits self-qualify ordinary captures with the canonical
helpers, then require exact semantics and all unchanged native work; they permit
only non-increasing creates/deletes/allocations/ARRAY_BUFFER binds and record
capacity bytes. Repeat work must match exactly within each variant.

Passed locally: 119 Core/diagnostic cases in six suites, 165 ECS cases in seven
suites, 142 tooling cases, Core/ECS and browser/paired-benchmark/Workflow-benchmark
TypeScript projects, repository ESLint with zero warnings, and 54 Chromium
browser cases. Six real Workflow functional cases also pass through 2,400 cards,
anchored zoom/pan, connected drag/history, tour cancellation, persistence/export
and narrow/reduced-motion use. All 54 WebKit cases pass in a complete fresh run
with unchanged source hashes. The focused capacity tests and sixteen Chromium stroke cases
also passed on each frozen runtime before its ordinary measurements.

The first WebKit run passes 53 cases and interrupts one ECS image case with
`Execution context was destroyed`; its subsequent cleanup also lacks the page
object. Source-comment writes coincide with that interruption and Vite
reconnection, supporting local hot-reload interference. This avoidable local
validation interruption is preserved in the original log and textual trace
evidence, not counted as a complete pass. The unchanged isolated candidate case
and master case both pass, followed by all 54 cases in a fresh full run with
source hashes guarded throughout. No assertion or timeout was altered.

Correctness Chromium is 149.0.7827.55, distinct from timing Chromium 140. WebKit
uses cached build 2388 with only the host-requirements preflight skipped;
behavioral assertions remain active. Cached dependency CLIs ran without a fresh
pnpm 9.15.9 install; generated local Husky helpers are absent, so per-command
hooksPath overrides follow the explicit checks. Existing ts-jest deprecation
warnings remain. Initial setup/type/lint failures and the old allocation-count
expectations are preserved in the private logs, separate from passing results.
No assertion timeout, browser retry, dependency/audit suppression or CI config
is changed to obtain passes.

Not run locally: complete repository unit/browser suites, full package/site or
packed-package builds, hardware GPU/WebGPU, retained-heap attribution and
continuous wheel/pinch physical-presentation measurements. CI is separate.

The next substantive target is a representation that preserves geometry across
packed-page offset changes, rather than a CPU mirror of mostly relocated bytes.
Before a new residency/cache design, measure its applicability on the real
Workflow and specify memory limits, placement/order changes, precision buckets,
per-camera/device ownership, removal/reentry and export isolation in both
backends. Current evidence supports investigating that path; it does not yet
validate such an implementation or close the 2,400-node smoothness goal.
