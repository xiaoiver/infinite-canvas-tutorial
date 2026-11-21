# Paint edits and z-order invalidation

ECS full-node paint and history updates wrote `ZIndex` even when its stored value
was unchanged. This notified `ComputeZIndex`, regenerated fractional keys and ran
full-scene ranking. The #694 guard already prevented unchanged numeric ranks from
being broadcast to renderers; it did not avoid this upstream work.

The input synchronization in `history/ElementsChange.ts` now compares the desired
rank with the existing Float32 component before writing. The document number is
kept exactly as supplied: `Math.fround` is used only for comparison, matching the
existing `ZIndex` component storage. Decimal ranks such as 0.1 therefore do not
continually invalidate sorting because of their Float32 representation.

Actual parent changes and explicit fractional-key payloads retain the previous
reconciliation path. Missing generated keys are recovered by `ComputeZIndex`
through its own query, including recovery without a document rank write. The
mutation API keeps its existing component access footprint: it does not check
`FractionalIndex`. A plugin restricted to its existing ZIndex/Flex permissions
can change a rank and repeat the same value safely. New nodes, true reorder, batched moves,
undo/redo, remote paint replay and restored hierarchies continue to synchronize.
The generic document mutation still updates fields, versions and collaboration
metadata. No cache, public flag, eligibility, geometry, ownership or export path
is added or changed. Existing LOD and batching defaults remain off.

## Core and ECS contract

Core already compares the current value in
`packages/core/src/shapes/mixins/Sortable.ts` before marking parent order dirty.
`Canvas.render` sorts siblings only when that marker is set, and append/remove
keeps the parent ordering contract when a child changes context. Core keeps its
existing Number representation; the ECS guard matches its existing Float32 storage.
No Core production change is required to implement the same no-op write contract.

The new Core tests cover unchanged integer, decimal and negative ranks alongside
paint changes, true rank changes and same-rank reparenting. Real ECS/Becsy tests
observe `ZIndex`, `FractionalIndex` and final numeric rank write events, covering
Float32-equivalent document values, default resets, history, remote paint, batched
moves, missing/explicit keys and a migrated-camera paint payload without parentId.
Both browser backends verify that painting retains order and that real reorder
still changes foreground pixels while matching the full draw path.

## Measured ordering work

[Benchmark summary and provenance](./paint-order-invalidation-benchmark.json)
compare clean master `0f025e1` with measured local source `0bd1f7d`. Published
runtime `87126cd0eff6795a82a0a6c65e4a560a36441689` has the same measured tree
`e983ca0203f6e3b0d7c9bbc1c5a70027ce89ce7e`. The later camera regression and docs
change no production code.

The existing grouped scene has 1,000 actually visible objects, 200 full text labels
and ten edited nodes per frame. Text batching runs off/on controls; screen LOD and
Path instancing stay off. Chromium 140.0.7339.186 software WebGL runs on Node
v24.22.3. Each configuration collects 30 frames after 15 warmup, then repeats with
optional phase wrappers and verifies restoration/teardown.

ECS fractional-key events seen by Sort across the **45 control frames**, including
warmup, change from **450 to zero**, with text batching both off and on. This field
is ECS-specific: Core has no FractionalIndex system, and its unchanged behavior is
verified through setter/parent markers and numeric-order assignments.

Profiled exclusive **mean** wall time per frame, in milliseconds:

| ECS phase / text batching | Before | After |
| ------------------------- | -----: | ----: |
| Rank / off                |  3.657 | <0.01 |
| Reconciliation / off      |  1.527 | <0.01 |
| Rank / on                 |  2.957 | <0.01 |
| Reconciliation / on       |  1.103 | <0.01 |

System entry counts remain 30 in the measured phase: the functions return without
scene-sized ordering work. Very small values round at timer resolution, so these
figures do not claim zero execution cost. Per-phase p95 values cannot be added.
Planning still runs on dirty batches; this patch does not cache its ordered list.
Enabled ECS planning mean is 8.87 ms before and 9.86 ms after in these profiled
samples, making planning/submission a remaining investigation target.

## Whole-frame controls and rendering invariants

Controls have no optional phase wrappers; existing native/glyph/order probes remain.
CPU wall times below are milliseconds, p50 / p95:

| Backend / text batching | Before      | After       |
| ----------------------- | ----------- | ----------- |
| Core off                | 8.3 / 15.3  | 7.4 / 13.8  |
| Core on                 | 8.2 / 24.0  | 11.6 / 21.3 |
| ECS off                 | 39.0 / 49.1 | 37.7 / 68.2 |
| ECS on                  | 37.2 / 69.1 | 35.5 / 63.4 |

The avoided ordering work is established; a stable whole-frame speedup is not.
ECS enabled median/tail decrease in this cohort, but the off-control p95 rises.
Core production code is unchanged and its controls also move. Keep these samples
rather than attributing every timing change to the guard. These are wall-time
scopes including possible GC/native waits, not hardware GPU timestamps or a
calibrated observer-overhead measurement. Profiled and control timings must stay
separate; no FPS multiplier is promised.

Every before/after control matches native work, visibility, text proxies, allocated
buffer bytes and live resource snapshots. All modes retain 1,000 visible objects,
zero text proxies, 395,280 indices and four array vertices. Enabled edit frames
remain 407 drawcalls. Core keeps 11 buffer uploads / 1,456 bytes and 7 uniform
uploads / 944 bytes; ECS keeps 19 / 8,008 and 5 / 800 respectively. Off controls
remain Core 603 calls and ECS 602 calls, with 1,456 and 9,208 buffer bytes.
All control/profiled/restored runs pass their resource and method-restoration checks.

## Reproduce and validate

```sh
EDIT_PHASES_BENCH_OUTPUT=.test-results/paint-order.json pnpm bench:edit-phases
pnpm exec playwright test -c playwright.browser.config.ts text-batching.spec.ts
pnpm exec playwright test -c playwright.webkit.config.ts text-batching.spec.ts
```

Run the same benchmark on the before commit and published equivalent runtime. The
JSON retains all CPU/native samples, resource snapshots, installed scope names,
all phase aggregates and the three slowest profiled frames. Full per-frame phase
arrays stay in the local benchmark outputs, identified by byte size and SHA-256;
the unchanged command reproduces complete outputs. New timing runs naturally vary.

-   Core: 72 targeted tests in nine suites passed, including the new four ordering
    contracts and existing SDF, text/Path batching, glyph and resource contracts.
-   ECS: 236 targeted tests in fourteen suites passed, covering ordering, exact
    document values, history/remote replay, migrated-camera painting, renderer/LOD
    lifecycle and 3D/rough-style history synchronization.
-   Chromium: the initial expanded selection passed 64/68. Four gizmo cases could
    not initialize because the local lightweight server lacked the Yoga alias;
    all four passed with the repository's full Vite/WASM configuration. WebKit
    passed all 68 cases in one run using that full configuration. Production
    source and test thresholds did not change for this environment correction.
-   The browser selection covers native byte budgets, pixels/full draws, real
    reorder, resize, partial/full/failed exports, picking/hover/marquee, culling,
    camera migration, parent inheritance, gradients, gizmos, multiple canvases,
    glyph sharing and teardown.
-   Browser/benchmark, Core and ECS TypeScript checks, all 41 tooling tests, normal
    source/docs hooks and diff checks passed. No dependency or CI policy changes.
-   Both complete four-mode phase benchmarks passed all controls, native/resource
    invariants, scope restoration and teardown. Cross-source rendering/resource
    comparisons also passed.
-   Full local headless-gl SSR was not run: the current Node 24 cache cannot locate
    its native binding. Repository CI remains separate; keep this follow-up draft.

## CI access-contract correction

The initial PR head failed five existing z-order suites in CI because the new
missing-key check required API callers to declare `FractionalIndex` check access.
The correction removes that check from document mutation and assigns recovery to
the hierarchy system. Existing callers and their access declarations are unchanged.
A real Becsy plugin test covers changed, repeated and restored ranks without key
access; another test removes a generated key without updating the document and
verifies recovery and final order without a redundant ZIndex write.

The benchmark results above describe the original measured runtime. The access
correction is validated separately; historical timing samples are not relabeled
as measurements of the corrected tree.
