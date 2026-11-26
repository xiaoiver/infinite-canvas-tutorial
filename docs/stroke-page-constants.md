# Shared immutable stroke-page buffers

Follow-up to #731. Core and ECS screen `StrokeBatch` pages now lease the same
immutable vertex-number and index buffer pair within each device. Writable
segment/travel buffers and final CPU page snapshots remain independently owned.
Full passes and exports continue to allocate their own geometry. Eligibility,
runtime defaults, precision, painter order, authored data and interaction paths
are unchanged.

## Ownership and failure handling

The pair contains nine Float32 vertex numbers and fifteen Uint32 indices, 96
bytes of payload. A weak device key owns the reference-counted entry. Each page
that allocates GPU geometry acquires one lease; the last release destroys both buffers and removes
the entry. There is no idle GPU pool. Retired pages detach leased handles before
base destruction, preventing a peer page from destroying shared resources.

Constant creation rolls back partial allocation before publishing an entry.
New writable buffers are recorded in page ownership before uploads, allowing
first-upload failures before material creation to clean up completely. The
allocation-failure path still preserves the previous page. Shared constants are
never overwritten; old writable buffers are not reused for later submissions.

## Qualified workload and reproduction

```sh
pnpm bench:workflow-input
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
pnpm test:browser stroke-batching.spec.ts camera-replay.spec.ts path-instances.spec.ts core-path-instances.spec.ts
pnpm test:browser:webkit stroke-batching.spec.ts camera-replay.spec.ts path-instances.spec.ts core-path-instances.spec.ts
```

Use separate `WORKFLOW_INPUT_OUTPUT_DIR` / `CAMERA_REPLAY_OUTPUT_DIR` values and
pin `WORKFLOW_CHROMIUM` for every checkout. Each workload ran control / candidate
/ candidate / control sequentially in fresh pages, without other local tests
during timing. Node 24.22.3 and Chromium 140.0.7339.186 with SwiftShader were used.
The table below records clean committed development captures before packaging
CI corrected the ECS helper import to its declared device-api fork. The initial
import resolved in the monorepo but failed in a packed consumer. Post-fix exact-
source benchmark and consumer verification are tracked in [#732](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/732);
keep that batch separate from the initial rows below.

Control: `9413648f0a00f48fc3178be4973dc50b1ef213a8`. Measured candidate: `6fdbdd5d04f129d5d2e77cb7aa4afeeb952e75ee`
(tree `45c73caca996d368f373267e1ddb0a365d1dbf1b`). Raw captures, exact source bundle,
producers, audits and failure logs are retained in the private review archive.

## Resource work reduced, timing remains mixed

The actual Workflow has 2,400 cards and 2,400 edges, outer viewport 1500 x 980,
canvas 1148 x 914 CSS pixels and DPR 1. Each traversal has ten trusted -100 and
ten +100 pixel-wheel inputs, one engine execution per target. These isolated
events are not a continuous-gesture or physical-presentation acceptance test.

Every 20-event traversal reduces buffer creates **195 to 177**, deletes 195 to
177, allocations 195 to 177 and upload calls **344 to 326**. The nine avoided
immutable pairs save 864 uploaded bytes: first/warm payloads change from
21,113,992 / 21,148,840 to 21,113,128 / 21,147,976 bytes. This is a 9.2% reduction
in object/allocation/upload-call counts, not a substantial bandwidth reduction.
Peak live allocated bytes change from 3,171,388 to 3,170,524.

The same 2,400-stroke trace in Core and ECS reduces creates/allocations **127 to
95** per traversal, upload calls by 32 and upload payload by 1,536 bytes. It also
avoids sixteen ARRAY_BUFFER and sixteen ELEMENT_ARRAY_BUFFER binds. First and
warm cohorts stay separate because existing precision hysteresis changes some
geometry between traversals.

Every corresponding requested/actual view, visible membership, surface, stroke
page count, native drawcall/index/array-vertex counter and non-buffer live
resource map matches. Workflow retains 3-22 draws and up to 633,846 indices;
the paired stroke workload retains 0-11 draws and up to 999,000 indices.
Documents, GPU gates/positive control, pending inputs and teardown pass.

The strict #731 comparator is unchanged: it deliberately rejects cross-variant
captures with changed native counters. The dedicated audit allows only exact
constant-pair savings: creates/allocations/uploads decrease equally by an even
number, uploaded bytes decrease by 48 times that number, deletes decrease by
an even number, and each saved live buffer corresponds to 48 allocated bytes.
In the stroke trace each avoided pair also saves one bind per target. Every
other native field must match. The audit covers every frame, not only totals.

Times below are milliseconds. Engine wall time includes synchronous native
waits and ends before observation. Workflow input time ends at target engine
completion; the stroke trace preserves Core synchronous and ECS awaited
boundaries. p95 is nearest-rank: 20 inputs for Workflow and 12 poses for strokes
(therefore maximum for the latter). These are not process-CPU or GPU timers.

| Capture | Traversal | Engine total | Engine p50 / p95 | Input p50 / p95 |
| --- | --- | --- | --- | --- |
| control-1 | first | 634.0 | 17.9 / 72.8 | 18.2 / 73.0 |
| control-1 | warm | 522.6 | 14.0 / 70.8 | 14.1 / 71.0 |
| candidate-1 | first | 567.7 | 13.2 / 67.5 | 13.8 / 67.7 |
| candidate-1 | warm | 485.4 | 14.7 / 65.5 | 14.9 / 65.7 |
| candidate-2 | first | 641.4 | 19.0 / 77.0 | 19.1 / 77.1 |
| candidate-2 | warm | 446.8 | 12.0 / 65.2 | 12.2 / 65.4 |
| control-2 | first | 582.2 | 14.2 / 67.7 | 14.7 / 67.8 |
| control-2 | warm | 492.3 | 15.1 / 58.2 | 15.2 / 58.4 |

| Capture | Backend | Traversal | Engine total | Engine p50 / p95 | Operation p50 / p95 |
| --- | --- | --- | --- | --- | --- |
| control-1 | core | first | 222.3 | 12.0 / 72.3 | 12.0 / 72.3 |
| control-1 | core | warm | 119.6 | 10.5 / 32.9 | 10.5 / 32.9 |
| control-1 | ecs | first | 303.0 | 15.0 / 81.1 | 24.7 / 85.1 |
| control-1 | ecs | warm | 184.0 | 10.1 / 44.6 | 18.7 / 60.4 |
| candidate-1 | core | first | 224.6 | 14.2 / 82.3 | 14.3 / 82.3 |
| candidate-1 | core | warm | 145.2 | 16.3 / 24.0 | 16.3 / 24.0 |
| candidate-1 | ecs | first | 246.4 | 9.0 / 63.6 | 16.6 / 78.4 |
| candidate-1 | ecs | warm | 144.9 | 8.9 / 30.9 | 20.2 / 45.3 |
| candidate-2 | core | first | 215.2 | 14.5 / 63.2 | 14.5 / 63.2 |
| candidate-2 | core | warm | 135.9 | 13.8 / 28.1 | 13.8 / 28.2 |
| candidate-2 | ecs | first | 355.5 | 15.0 / 85.8 | 26.7 / 101.5 |
| candidate-2 | ecs | warm | 210.9 | 10.5 / 48.1 | 14.8 / 55.4 |
| control-2 | core | first | 219.3 | 13.5 / 64.4 | 13.5 / 64.4 |
| control-2 | core | warm | 137.6 | 10.9 / 28.1 | 10.9 / 28.1 |
| control-2 | ecs | first | 257.6 | 14.7 / 59.2 | 20.1 / 74.1 |
| control-2 | ecs | warm | 154.3 | 8.9 / 37.2 | 19.3 / 42.0 |

Workflow warm engine totals fall in both pairs, but its second candidate has a
slower first traversal and warm p95 than control 2. Core/ECS trace results are
also mixed. This is an independently verified resource-work reduction; it is
not evidence of a stable whole-application speedup. The smooth 2,400-node goal
remains open.

## Separate host-call diagnostic

A diagnostic installs wrappers on actual HTML/Offscreen WebGL contexts before
the device receives them. Counts match every corresponding ordinary native
counter and targets/resources remain identical within each source variant.
Timings include probe/timer overhead and coarse clock quantization; they are
excluded from ordinary timing and do not measure GPU execution or partition
all engine time.

| Variant | Traversal | createBuffer calls / host ms | bufferSubData calls / host ms |
| --- | --- | --- | --- |
| control | first | 195 / 1.0 | 344 / 4.6 |
| control | warm | 195 / 1.1 | 344 / 6.8 |
| candidate | first | 177 / 0.7 | 326 / 5.0 |
| candidate | warm | 177 / 1.3 | 326 / 17.2 |

Expanded wrappers also cover queries, error checks, readbacks and submission
methods. The wrapped getError/getParameter/readPixels/finish/clientWaitSync entrypoints
observe no calls inside the captured input steps. This does not establish that GPU time or all
synchronization is absent. Buffer entrypoint residence alone does not account
for the long engine intervals; the next trace must include the remaining JS,
GC, scheduling and native/presentation work before changing writable-buffer
ownership. Do not infer that overwriting in-flight buffers is safe.

An initial late prototype hook recorded zero calls because context methods
were already intercepted as own properties; it is retained as an invalid
diagnostic and never used as timing evidence. The first additional Core browser
case also repeated an already-enabled switch, resetting its per-frame counters
on an empty render. Correcting the test driver makes both real-GPU page-count
cases pass without production changes.

## Validation

- 37 Core + 22 ECS unit cases pass, including shared constants, independent
  writable snapshots, separate devices/full passes, last-owner cleanup,
  allocation rollback and upload failure with/without a surviving peer.
- 32 existing + 2 new cases per browser pass in Chromium 149 and WebKit. These
  cover screen pixels, page-count changes, history/interaction, camera migration,
  culling/reentry, same-frame removal, WebGL1, exports and resource teardown.
  A second active page adds only two writable buffers and one object uniform;
  retirement/recreation returns to the same physical buffer count.
- Five focused source/build/contract typecheck projects, repository ESLint,
  82 tooling cases, formatting/Markdown checks and eight ordinary replay
  captures pass. Diagnostic counts and all defined resource deltas are audited.

Packaging CI caught the new ECS helper importing the upstream GPU API used by
Core. ECS instead declares the project device-api fork; that one ECS import is
corrected without adding dependencies. The existing packed React consumer check
is the regression gate. Core keeps its declared upstream API import.

No dependency, public option, benchmark producer or observer is changed. Local
commands use installed Node CLIs (pnpm 11 versus requested 9.15.9); WebKit uses
the existing host-validation override with assertions intact. Generated Husky
helpers are absent, so checks ran explicitly. Full monorepo builds/suites,
hardware GPU, WebGPU and sustained-gesture/presentation acceptance were not
run locally.
