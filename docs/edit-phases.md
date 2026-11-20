# Profiling edit-frame phases in Core and ECS

The order-write guard in #694 removes unnecessary layout validation, but does not
establish a CPU latency improvement. This follow-up adds a reproducible diagnostic
for **both Core and ECS**, keeping all instrumentation in browser fixtures and
benchmark scripts. No production renderer, eligibility, document, interaction,
export or resource-ownership behavior changes. Feature defaults remain off.

## Reproduce

Run `pnpm bench:edit-phases` after installing the existing workspace dependencies
and Playwright Chromium. Set `EDIT_PHASES_BENCH_OUTPUT` to choose the output file.
The benchmark uses the existing grouped mixed scene: 1,000 actually visible objects
with 200 full text labels. Path instancing and text/polyline LOD remain off. Each
backend runs with full-text batching off and on in a fresh page.

Each configuration first measures 30 unprofiled edit frames after 15 warmup frames,
then explicitly installs phase wrappers and repeats 30 frames after 15 warmup.
A short unprofiled run after restoration verifies that wrappers were removed.
Native work, allocated buffer bytes, live resource counts, WebGL errors and final
teardown are asserted against the unprofiled control. Timing does not have a CI
performance threshold.

The clean measured local source is `8246a84259e2b5228a68f88064ab07be549ed291`,
identical to published commit
[`945a22d`](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/945a22db9f453c7a06909057c9a326f2f6c86a19)
(tree `3f2191e12f5514a835b5082206900f85cbbed970`). The complete quiet serial
Chromium 140 software-WebGL cohort ran without concurrent local tests or Git-tree
payload preparation. Documentation and [raw results](./edit-phases-benchmark.json)
were added afterward. Every CPU/native sample, installed scope name, phase sample,
resource snapshot and three slowest profiled frames per configuration are retained.

## Timing semantics

The fixture-only collector wraps synchronous methods on explicit request and
restores exact original descriptors on disable, replacement, failed installation
or destruction. Outside a measured frame it does not read the clock. It preserves
receivers, arguments, return values and thrown errors. Nested scopes record both
inclusive time and exclusive time with measured child durations subtracted.
Repeated or recursive scopes accumulate their exclusive work once.

Core measures mutation and `render`, with nested `BatchManager.planOrdered` and
`flush` scopes. ECS measures synchronous `execute` methods on exported System
prototypes, grouping the transform systems and naming the main derived/order/
visibility phases. Other exported systems retain their class names. MeshPipeline
camera rendering, batch planning, scheduling and submission have nested scopes.
Async methods are excluded and listed explicitly; this cohort has no skipped
async system. Non-exported systems and Becsy work outside wrapped methods remain
in the frame residual.

These are synchronous CPU **wall-time** scopes, including possible GC pauses,
native/driver calls or waits. They are not GPU timestamps or isolated JS CPU cost.
`batch.submit` covers the backend's submission method and its work; the two
implementations have different boundaries. Core's `core.render` exclusive value
covers rendering work outside measured children. ECS residual is total frame time
minus the sum of exclusive scopes. Quantiles from different scopes cannot be
added. Very small scopes can round to zero at the browser timer resolution.

Calls count method entries, including cached early returns. ECS `plan` has 60
entries across 30 frames; its dirty guard means this does not demonstrate 60
expensive replans. Retain the existing correctness checks before considering any
cache or dirty-range optimization.

## Observed cohort

| Backend / text batching | Unprofiled edit p50 / p95 ms | Profiled edit p50 / p95 ms | Edit calls | Edit upload bytes/frame |
| ----------------------- | ---------------------------: | -------------------------: | ---------: | ----------------------: |
| core / off              |                   9.8 / 17.1 |                 7.4 / 15.0 |        603 |                   61744 |
| core / on               |                  14.3 / 30.1 |                13.6 / 18.7 |        407 |                   61744 |
| ecs / off               |                  29.1 / 37.5 |                44.2 / 52.5 |        602 |                   69496 |
| ecs / on                |                  41.4 / 56.3 |                26.4 / 39.8 |        407 |                   68296 |

All configurations retain 1,000 visible objects, zero text proxies, 395,280
submitted indices and four array vertices. Native work and live/allocated
resources match their unprofiled controls, and every teardown succeeds. Enabled
Core scene resources retain 1,627 buffers / 9 textures and 1,893,724 allocated
buffer bytes; ECS retains 1,632 buffers / 209 textures and 2,159,388 bytes, plus its
live export context with one buffer and five textures until world exit.

Selected **exclusive** phase observations for enabled batching:

| Backend | Scope             | Mean ms/frame | p50 / p95 ms |
| ------- | ----------------- | ------------: | -----------: |
| core    | `batch.submit`    |          6.96 |   6.3 / 10.3 |
| core    | `batch.plan`      |          3.75 |    2.8 / 7.2 |
| core    | `core.render`     |          2.09 |    2.0 / 3.2 |
| core    | `core.mutate`     |          0.07 |    0.1 / 0.2 |
| ecs     | `batch.submit`    |         10.04 |   9.2 / 14.4 |
| ecs     | `batch.plan`      |          7.00 |   6.2 / 12.5 |
| ecs     | `edit.apply`      |          3.32 |    2.6 / 7.8 |
| ecs     | `order.rank`      |          2.61 |    1.9 / 5.5 |
| ecs     | `order.reconcile` |          1.15 |    0.6 / 4.4 |

Core enabled submission and planning average 6.96 and 3.75 ms; ECS averages
10.04 and 7.00 ms. ECS document-edit application, rank assignment and fractional
order reconciliation are also visible. Enabled ECS residual averages 1.27 ms
(p95 5.2 ms); Core residual averages 0.04 ms. This identifies candidate scopes,
not the exact allocating function or cause of every pause.

The slowest enabled ECS profiled frame is 49.4 ms: submission takes 14.4 ms,
planning 12.5 ms, edit application 5.9 ms, text metrics 4.5 ms and residual 5.2 ms.
The next frame is 39.8 ms, with planning and submission each 12.6 ms. Core's slowest
enabled frame is 20.5 ms, with 8.6 ms outside the measured render children;
its next frame is 18.7 ms with 13.1 ms in submission. Tail frames therefore need
individual attribution rather than summing phase p95 values.

The unprofiled controls run before the profiled samples. Later samples can be
faster despite the observer, while ECS off became slower. Warm state, allocations,
GC and scheduling are not controlled by these wrappers. These differences are
neither an optimization result nor a calibrated observer-overhead estimate.
Do not claim a speedup from this cohort or use it to enable optional features.

## Follow-up priority

1. Sample JS/allocation stacks inside submission in both backends, then inside
   full-scene batch planning on paint edits. These are the largest observed mean
   scopes in this workload; preserve painter barriers and retirement semantics.
2. In ECS, distinguish numeric rank computation and fractional-key reconciliation
   from the already-fixed unchanged-rank write fanout. Full-node paint/history
   writes still enter these phases. Core must be evaluated with the same scene.
3. Validate a concrete implementation with operation counts, full-path pixels,
   interaction/history/export and resource lifecycle checks, then repeat the
   unprofiled benchmark. Keep any new cache's invalidation contract explicit.

## Validation

-   Three collector contract tests passed: nested/recursive exclusivity, receivers
    and results, thrown errors, frame reset, inactive-clock behavior, exact own and
    inherited descriptor restoration, invalid/async method rejection and cleanup.
-   Chromium and WebKit each passed 40 paired text/Path/LOD/resource cases. The final
    expanded ECS coverage then passed two focused profiling cases again in each
    browser, checking repeated enable, unchanged pixels/native work, disable and
    destruction while profiling remains enabled.
-   Browser plus benchmark, Core and ECS TypeScript checks passed. All 41 tooling
    tests passed, including browser CI grouping. Final changed-file ESLint and normal
    commit/Markdown hooks passed. No dependencies or CI thresholds changed.
-   The complete four-mode phase benchmark passed all invariant, restoration and
    teardown assertions on clean source.
-   Full local headless-gl SSR was not run because the optional native binding is
    absent from the Node 24 dependency cache. Repository CI remains separate.
