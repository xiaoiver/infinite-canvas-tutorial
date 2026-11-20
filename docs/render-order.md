# Avoiding redundant render-order writes

After #693, an ordinary paint edit still invalidated unchanged ECS render ranks.
`Sort` reranked the scene after fractional-index events and wrote every
`GlobalRenderOrder`. `MeshPipeline` observes these writes and queues batch
validation even when the numeric rank did not change.

ECS now initializes a missing rank directly and writes an existing rank only when
its value changes. Core applies the same value guard to its plain
`globalRenderOrder` property. Both still advance their complete rank sequence;
real reordering, insertion, deletion and nested descendants retain their ranks.
Core still traverses and submits the scene through its existing batch planner.

This does not change batching eligibility or defaults. Text batching and LOD stay
off by default. There is no document-schema, interaction, export, dependency or
resource-cache change, and LOD does not reuse `Culled`.

## Operation counts

The exploratory diagnostic used 1,000 actually visible objects / 200 full texts
and three paint-edit frames, including the first page split:

| Backend | Order signals before / after | Layout checks before / after | Text keys before / after | Geometry builds before / after |
| ------- | ---------------------------: | ---------------------------: | -----------------------: | -----------------------------: |
| Core    |                     3000 / 0 |                    204 / 204 |                600 / 600 |                          5 / 5 |
| ECS     |                     3030 / 0 |                    600 / 204 |                600 / 600 |                          5 / 5 |

Core counts property assignments; ECS counts entries in the renderer's
`addedOrChanged` order query, including possible added/changed duplicates. These
are distinct counter definitions. ECS still observes 30 fractional-index events
in this diagnostic. The optimization removes their unchanged-rank fanout, not the
sorting or fractional-index work itself. The before runtime was #693's head
`ac8fab3`; both exploratory runs had the same counter fixture changes. They are
not clean timing cohorts. The final clean-source browser tests independently
assert the after counts and prove that real reorder still changes visible depth.

## Reproduce

Run `pnpm bench:text-batching` for the unchanged qualified mixed scene: grouped
painter order, 1,000 visible objects, including 200 full texts, with the other
optimization switches off, 30 measured frames after 15 warmup frames in each mode.
The fixture records order signals together with layout/key/build counters, actual
native submissions, uploads, resources and every CPU sample.

Run `pnpm test:browser --grep 'resolves one text key|real painter reorder'` and
the equivalent `pnpm test:browser:webkit --grep` command to check unchanged-rank
paint edits and real reorder in both backends. The complete paired text, Path,
LOD and ownership regressions were also run for this change.

The [raw results](./render-order-benchmark.json) preserve the diagnostic source,
its provenance and both counter sets, plus the complete four-mode timing cohort.
The measured clean local runtime is `b65f2b0d9ff999644febb80e25a22ee3e8dae619`,
identical to published commit
[`c9f1d79`](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/c9f1d7933799d886113778137eb3faf04b38dcce)
(tree `a5b4d4672839eaac92847641325ef36a7e9fc92a`). It was measured serially with
Chromium 140 software WebGL, without concurrent local tests or publication payload
preparation. Documentation and raw results were added after measurement.

## Recorded cohort

| Backend / switch | Pan CPU p50 / p95 ms | Edit CPU p50 / p95 ms | Edit calls | Edit upload bytes/frame | Scene buffers / textures |
| ---------------- | -------------------: | --------------------: | ---------: | ----------------------: | -----------------------: |
| core / off       |           9.9 / 21.8 |           10.0 / 17.9 |        603 |                   61744 |                2411 / 62 |
| core / on        |            5.7 / 8.8 |           13.2 / 18.8 |        407 |                   61744 |                 1627 / 9 |
| ecs / off        |          20.2 / 36.1 |           43.0 / 52.9 |        602 |                   69496 |               2607 / 263 |
| ecs / on         |          14.9 / 19.5 |           37.8 / 75.3 |        407 |                   68296 |               1632 / 209 |

Every mode retains 1,000 visible objects, zero text proxies, 395,280 submitted
indices and four array vertices. Enabled pan stays at 403 calls and editing at 407. Camera-only frames upload 192 bytes and perform no text key work. Paint
frames have zero order signals in all modes. ECS still receives 450 fractional
index events over the 45 edit frames. Enabled text keys remain 9,000; both backends
now perform 288 layout validations, including the first split's 200 captures plus
two changed labels in each later frame. Text geometry builds stay at five during
the first split. The previous #693 cohort recorded 9,000 ECS layout validations.

The resource columns describe the scene's WebGL context after edits. ECS also
retains an export context with one buffer and five textures while the world is
alive. Allocated scene buffer bytes are Core off/on 1,931,220 / 1,893,724 and ECS
off/on 2,206,188 / 2,159,388. Every mode passes teardown: Core returns to its device
startup baseline and ECS releases both contexts' resources on world exit.

CPU improvement is not established. Core enabled edit p50/p95 is worse than its
disabled control in this cohort. ECS enabled p50 is lower, but p95 remains worse
than disabled. The #693 enabled values were Core 7.0/13.1 ms and ECS 34.5/77.0 ms;
these independent cohorts do not establish a cross-commit speedup. This change
proves less unnecessary invalidation and preserves rendering, while edit tail
latency still requires phase-level profiling. Sorting remains a full scan/sort,
and batch planning still resolves every text key on dirty edit frames.

Timing retains the original boundaries: Core includes the operation mutation and
`render`; ECS brackets the full `world.execute`, including queued actions and
other systems. Compare each backend separately. Do not infer a hardware-independent
FPS ratio or enable the optional features by default from these measurements.

## Validation

-   Core: 51 targeted tests across five suites passed.
-   ECS: 119 targeted tests across seven suites passed, including real Becsy order
    events, full-node paint/history writes, multi-canvas initialization, batched
    reorder/undo/redo, same-frame delete/insert and nested descendants.
-   Chromium and WebKit each passed 38 regression cases. They cover pixels, true
    painter reorder, original picking/hover/marquee, visibility/culling reentry,
    camera migration, failed and full export, deletion and bounded resource ownership.
-   Browser/Core/ECS TypeScript checks and changed-file ESLint passed. Normal commit
    hooks ran. No dependencies or CI thresholds changed.
-   The complete four-mode benchmark passed invariant and teardown checks.
-   Full local headless-gl SSR was not run: the optional native binding is absent
    from this Node 24 dependency cache. Repository CI is a separate validation.
