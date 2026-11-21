# Batch order keys within a plan

ECS BatchManager previously read both entities' `FractionalIndex` components on
every sort comparison in every dirty plan. It now snapshots each active key once
before sorting, then uses the same code-unit comparisons and stable ties. A clean
plan still returns immediately. Unordered plans and plans with fewer than two
entries keep their previous zero-key-access behavior.

The snapshot belongs to one synchronous plan. Every dirty plan reads current keys,
including a key changed on an entity other than the one passed to `add`. Removal,
clear, culling/reentry and exports therefore use current membership. Existing
painter barriers, capacity, renderer eligibility and drawcall ownership are retained.
The change introduces transient JavaScript snapshot objects; their allocation cost
is included in ordinary CPU controls. LOD and batching defaults stay unchanged.

## Core and ECS

Core already receives the current traversal order from `Canvas.render`, which sorts
siblings only when their parent's `sortDirtyFlag` is set. Its
`drawcalls/BatchManager.ts:planOrdered` consumes that sequence directly and
validates input identity and dirtiness before reusing a plan. It needs no ECS
component-key snapshot. Core production code is unchanged; a paired test verifies
paint changes, reordered traversals, painter barriers and same-frame removal.

ECS tests cover a scrambled 64-entity plan, one key read/check per entity, clean-plan
reuse, a key changed outside the explicitly dirtied entity, duplicate and missing
keys, legacy comparison semantics, removal, clear and unordered/single-entry access.
The same read-budget test was also executed against the unoptimized source: it
observed **608** key reads and failed the new budget. The optimized plan reads
**64** keys. These are deterministic entity-boundary test counts, distinct from the
1,000-visible-object browser timing workload below. They do not assert that the
whole renderer or every key size has a fixed speed multiplier.

## Qualified browser measurements

[Machine-readable results](./batch-order-key-snapshot-benchmark.json) retain all
CPU samples, all phase aggregates, native summaries, allocated bytes and resource
snapshots. Complete per-frame phase/native records remain in the ignored raw
outputs, identified by byte count and SHA-256 in the report.

-   Before: `c67df7ee3aecb4e418f14756ea9ba077de556526`, tree
    `306aaf5dbf961447198349d24609c9e7093e64fc`; this equals merged master
    `e877144c5e2a83a7dea1c2f9c367e808dae72d79`.
-   Measured after: local `01cb1e581d43b7b3dbfc10a31b721ecbca22b2d3`, tree
    `6e468a3b842aab61052f27107c7c15a1093ed46f`; published runtime
    `f614742de0e2eddafd41174969318ceaef6b7543` has the same tree. The final
    follow-up adds documentation and a test annotation without changing production
    code. BatchManager blob: `88d7aeb69595618b60dba109526eb49bf7ce4347`.
-   Chromium 140.0.7339.186, software WebGL, Node v24.22.3, one worker and fresh
    pages per backend/mode. Both measured trees are clean. The renderer fixture and
    benchmark script are unchanged. An isolated local port/cache was used for the
    after run because the restored environment lacks the complete site dependency
    installation; this changes server setup, outside the measured frame scopes.
-   Grouped scene: **1,000 actually visible objects**, 200 full text labels, ten
    edited nodes/frame; screen LOD and Path instancing off. Text batching off/on is
    measured separately in both backends. Each mode collects 30 edit frames after
    15 warmup, then repeats with optional phase wrappers and checks restoration.

Ordinary CPU wall time p50 / p95, milliseconds (optional phase wrappers disabled;
existing native/glyph/order probes remain):

| Backend / text batching |      Before |       After |
| ----------------------- | ----------: | ----------: |
| Core off                |  7.6 / 12.7 |  7.2 / 15.2 |
| Core on                 |  8.2 / 13.1 |  9.8 / 21.5 |
| ECS off                 | 26.5 / 33.0 | 30.4 / 42.2 |
| ECS on                  | 24.4 / 33.7 | 24.9 / 30.8 |

Profiled exclusive batch-planning time, mean / p50 / p95 in milliseconds:

| Backend / text batching |             Before |              After |
| ----------------------- | -----------------: | -----------------: |
| Core on                 |  2.193 / 1.9 / 5.6 | 3.833 / 2.5 / 13.6 |
| ECS off                 | 6.553 / 5.4 / 10.6 | 6.107 / 5.5 / 10.0 |
| ECS on                  | 7.760 / 7.0 / 14.9 | 7.327 / 6.6 / 11.7 |

Each ECS profiled row includes 60 method entries across 30 measured frames,
including clean early returns; the means are total exclusive time per frame.
Core off does not enter its ordered planner. Profiled timings and ordinary controls
are separate cohorts. The ECS planning means decrease modestly in this sample,
while whole-frame controls and unchanged Core vary. **A whole-frame speedup is not
established.** The demonstrated result is the reduced component-access budget.
These are wall times including possible GC/native waits, not GPU timestamps.

All four before/after controls match native work and live resource snapshots:

| Backend / text batching | Drawcalls | Buffer uploads / bytes | Allocated buffer bytes |
| ----------------------- | --------: | ---------------------: | ---------------------: |
| Core off                |       603 |             11 / 1,456 |              1,931,220 |
| Core on                 |       407 |             11 / 1,456 |              1,893,724 |
| ECS off                 |       602 |             27 / 9,208 |              2,206,188 |
| ECS on                  |       407 |             19 / 8,008 |              2,159,388 |

Every mode retains 395,280 indices, four array vertices, zero text proxies and
1,000 visible objects. Uniform work is unchanged (Core 7 uploads / 944 bytes;
ECS 5 / 800). Redundant order events remain zero. All control/profiled/restored
configurations pass native/resource checks, exact method restoration and teardown.
This change targets CPU planning and does not reduce the reported drawcall count.

## Validation and reproduction

```sh
EDIT_PHASES_BENCH_OUTPUT=.test-results/batch-order.json pnpm bench:edit-phases
pnpm exec jest -c jest.ecs.config.js --runInBand --coverage=false batch.transitions render-order batch.lifecycle renderer.lifecycle
pnpm exec jest -c jest.config.js --runInBand --coverage=false core-order-invalidation core-text-batching core-batch-lifecycle
pnpm exec playwright test -c playwright.browser.config.ts text-batching.spec.ts batching.spec.ts path-instances.spec.ts core-path-instances.spec.ts text-lod.spec.ts
```

-   ECS: 86 tests across four targeted suites pass. Core: 27 tests across three
    targeted suites pass. Production Core and ECS TypeScript checks pass.
-   Chromium: all 37 selected cases pass, covering painter order, SDF uploads,
    text/Path batches, full-path pixels, LOD thresholds, picking/hover/marquee,
    full/partial/failed exports, culling/reentry, deletion and bounded resources.
-   Before/after four-mode benchmarks pass. Native/resource equality and zero
    redundant ordering events are also compared across source versions.
-   Normal source/docs hooks and diff checks pass. No dependencies or CI rules change.
-   The restored local snapshot lacks site/app/WebComponents dependencies. Full
    browser TypeScript has the exact same 647 diagnostics on the before and after
    trees (366 missing-module errors). Tooling tests pass 37/41 on both trees; the
    same four tests cannot resolve site/app packages. These checks are not reported
    as passing. The preceding #699 head passed all 34 CI checks in its fully
    installed environment; this independent draft has its own CI.
-   Local WebKit is not run because system libraries are missing. Full local native
    SSR is not run because this Node 24 cache has no headless-gl binding. CI provides
    those checks; local Chromium and the targeted real-Becsy tests remain separate.
