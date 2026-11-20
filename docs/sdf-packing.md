# Reducing SDF instance packing allocations

The paired phase work in #695 identified submission and planning as investigation
targets. Chromium CPU and heap sampling then found `SDF.generateBuffer` among the
large allocation sites in both Core and ECS. This change removes temporary vector
packing while preserving current value reads, painter order and GPU submissions.
It applies to the common SDF implementation; batching/LOD eligibility and their
existing off-by-default switches are unchanged.

## Implementation

Both backends construct the same packed 32-value instance row directly from
scalars. Instances no longer allocate eight named legacy vectors or concatenate
them into the row. Their unused legacy-uniform result is a shared frozen empty
record. Independent full draws still own separate legacy arrays. ECS retains the
extra four filter values on its full path, and its existing texture/multi-fill/
blur/stroke handling. Full ECS textured fill modulation and direct instance color
are deliberately distinct and tested.

Core reuses its allocated instance and affine-matrix Float32Arrays while page
membership is unchanged, writes the six matrix values directly, and replaces
storage when geometry is rebuilt as before. ECS already has capacity-managed row
storage; it now copies the exact 32-value row without slicing and writes matrix
values directly. The original dirty decisions and GPU upload ranges are retained.
There is no new persistent material/style result cache or reference-immutability
assumption. Fresh attribute reads still happen at the original update points.

## Reproduce sampling

Run `pnpm bench:batch-allocations` with the existing Playwright Chromium installed.
`BATCH_ALLOCATIONS_BENCH_OUTPUT` selects the summary path. The command writes
complete `.cpuprofile` and `.heapprofile` files alongside the summary, suitable
for the DevTools Performance/Memory panels. CPU sampling uses a 1,000 microsecond
interval. Heap sampling uses 16,384 bytes and includes objects collected by major
and minor GC. The collectors run separately; each observes 45 edit iterations
(15 warmup + 30 sampled timing frames) after the initial page split is prepared.

The shared scene has 1,000 actually visible objects, including 200 full texts,
grouped painter order and text batching on. Other optimization switches are off.
The command asserts native work, live resources, allocated GPU buffer bytes and
teardown. CPU/heap observer timings are diagnostic, not a production latency
comparison. Heap `selfSize` values are sampled allocation estimates attributed to
a function, including collected objects, not exact total allocation or retained
heap. Vite profile line numbers refer to transformed code. Native/GC nodes may
lack a useful allocating JS stack; the summary keeps attribution conservative.

## Recorded allocation observation

The exploratory before run used unchanged runtime `75ec059` and the same configured
browser cache and workload. The final after run used clean local source
`f161beb88c07139d786645d8936f23807cea8416`, identical to published commit
[`056638d`](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/056638df6ccc6ed8c9c0bd489f445cac68aa650c)
(tree `f2c08cc292e7a0ca6a2a772de5c04d66afe2d52c`).

Estimated self allocations in `SDF.generateBuffer` under batch submission/planning:

| Backend | Before sampled bytes | After sampled bytes |
| ------- | -------------------: | ------------------: |
| core    |           21,365,512 |           5,614,736 |
| ecs     |           22,474,120 |           6,420,532 |

The source removes the instance-only legacy vector construction, and the Core
storage test confirms stable Float32Array identity across paint/transform updates.
The estimates support less temporary packing work; sampling variability and
remaining allocations prevent treating them as exact whole-application savings.
Component reads, enabled-layer arrays, planning, vertex input and native command
work remain visible in the recorded stacks.

The [data artifact](./sdf-packing-benchmark.json) retains before/after stack
summaries, source mapping, every after CPU/native timing sample, resource snapshots
and checksums/sizes of all eight raw local profile files. Raw profiles remain in
`.test-results` rather than adding large engine trace files to the repository;
reproduce them with the command above. The complete baseline CPU profiles were
reaggregated offline with a backend-independent BatchManager path predicate;
collection itself retained all samples. The allocation summary was unaffected.

## Unprofiled frame cohort

`pnpm bench:text-batching` separately runs all four modes with CPU/heap collectors
off. It preserves the existing Core operation-plus-render and complete ECS
world.execute timing boundaries: 30 samples after 15 warmup for pan and edit.
Sampling and the ordinary benchmark ran serially, with no concurrent local tests
or publication preparation. Both measured clean source before docs/data were added.

| Backend / text batching | Pan CPU p50 / p95 ms | Edit CPU p50 / p95 ms | Edit calls | Edit upload bytes/frame |
| ----------------------- | -------------------: | --------------------: | ---------: | ----------------------: |
| core / off              |           6.8 / 20.4 |           12.4 / 20.4 |        603 |                   61744 |
| core / on               |           5.4 / 10.1 |           12.8 / 41.1 |        407 |                   61744 |
| ecs / off               |          17.7 / 35.6 |           40.3 / 46.9 |        602 |                   69496 |
| ecs / on                |          14.9 / 19.0 |           41.7 / 80.9 |        407 |                   68296 |

Every mode retains 1,000 visible objects, zero text proxies, 395,280 indices and
four array vertices. Enabled pan remains 403 calls and editing 407. Camera frames
upload the 192-byte scene UBO only. Enabled edit key/layout counts remain 9,000/288
across 45 iterations, and first-split text geometry builds remain five.

Enabled Core retains 1,627 scene buffers / 9 textures and 1,893,724 allocated buffer
bytes; ECS retains 1,632 / 209 and 2,159,388 bytes, plus its separate live export
context with one buffer and five textures until world exit. Sampling before/after
native upload sizes match, and all sampled/ordinary modes pass teardown checks.

**CPU improvement is not established.** This cohort's enabled Core edit p95 is
41.1 ms versus 20.4 ms off, and ECS is 80.9 ms versus 46.9 ms off. The #695 independent
unprofiled enabled controls were Core 14.3/30.1 ms and ECS 41.4/56.3 ms p50/p95.
These are separate cohorts and do not establish either a speedup or a causal
cross-commit regression. Do not cherry-pick the profiled timings as an FPS result.
The reliable outcome here is reduced temporary packing with preserved rendering;
submission/plan work and CPU tail latency still need investigation.

## Validation

-   Core: 55 targeted tests across six suites passed, including exact shader fields,
    depth, alpha/attenuation, independent full-pass arrays and storage reuse/resize.
-   ECS: 129 targeted tests across ten suites passed, including 32/36-value contracts,
    full-pass modulation, affine rows, partial uploads, capacity, lifecycle/history
    and uniform ownership.
-   Chromium initially passed 44 of 45 cases. The new Core control had not notified
    the scene after changing its plain `batchable` field; the helper now explicitly
    marks render state dirty. Both new SDF cases then passed targeted rerun. The
    other 43 cases do not use that helper. WebKit passed all 45 cases on final source.
-   New pixel/export checks compare independent full draws with instance rows for
    transparency, stroke alignment, corner radius, attenuation and Rect inner-shadow
    fallback, then exercise repeated edits/toggles and resource teardown. Existing
    tests cover culling/reentry, true reordering, picking/hover/marquee, migration,
    failed/full export, multi-fill/gradient and WebGL1 uniform restoration.
-   Browser plus sampler, Core and ECS TypeScript checks, all 41 tooling tests,
    final changed-file ESLint, Markdown and normal hooks passed. No dependencies
    or CI thresholds changed.
-   Both sampler configurations and all four ordinary benchmark modes passed.
-   Full local headless-gl SSR was not run: the Node 24 cache lacks its optional
    native binding. Repository CI remains a separate check.
