# Prune impossible ordered batch candidates

Core and ECS now avoid calling renderer eligibility predicates that cannot
succeed for the current geometry. The predicates themselves are unchanged; all
remaining candidates still pass the complete original material/geometry checks.
No retained cache, switch, default, dependency or geometry formula is added.

-   In ECS, only entities with `Rect` can enter `ImageBatch`. Non-rectangle
    entities skip the image candidate before its composite policy checks. Path
    selection keeps the original fill-then-stroke predicate order.
-   In Core, stroke batching requires `fill === 'none'`, while fill instancing
    rejects that value. These are Core's existing rules, including its treatment of
    invisible strokes; ECS's component-width rules remain unchanged.
-   Core already calculates every accepted stroke material key when visiting that
    shape. Once adjacent keys match, append needs only the same 256-shape limit
    used by `StrokeBatch.validate`; it does not recompute the current and first
    shape's keys. Standalone validation is unchanged. ECS already appends using
    checked keys and instance capacity.

Keys are recomputed from current data for each dirty planning pass. No previous
frame's eligibility or material is memoized. Painter order, page allocation and
reuse, full/unsupported/export paths, default-off optimization switches, source
and history data, picking, precision hysteresis and GPU ownership keep their
existing paths. Core's singleton filled Path still uses its full Mesh renderer.

The shared capacity remains authoritative. Deterministic 300-node planner tests
check 256/44 pages, Core's one stroke-key computation per node, fresh material splits and ECS's
non-rectangle image-candidate exclusion.
The unchanged full predicates serve as an independent eligibility oracle across
filled/unfilled Paths and absent, zero, negative, NaN and infinite stroke widths.
Existing browser controls cover effects, styles, transforms, ordering, full
exports, interactions, clipping/culling, reentry and same-frame deletion.

## Reproduce

Run serial clean before/after worktrees using the same browser executable and
DPR. Keep first visits and warm rounds, and ordinary/profiled cohorts, separate:

```bash
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
pnpm exec playwright test -c playwright.workflow-replay-bench.config.ts
pnpm exec playwright test -c playwright.stroke-reuse-bench.config.ts
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 pnpm bench:workflow
```

Use `CAMERA_REPLAY_OUTPUT_DIR`, `STROKE_REUSE_OUTPUT`, `WORKFLOW_BENCH_OUTPUT`
and `WORKFLOW_CHROMIUM` for separate captures and a pinned browser. Require
actual camera/membership/surface/native parity with `compare-camera-replay.mjs
--require-native-parity`. Separate diagnostics count eligibility/validation
calls only while real planning methods execute and restore the original methods;
their instrumented timings are excluded from ordinary comparisons.

The PR records qualified CPU, draw/upload/resource and aggregate post-GC heap
results, including regressions. Raw captures stay ignored local artifacts. CPU
scopes are not presented FPS or hardware-GPU qualification. Smooth interaction
at 2,400 Workflow cards plus 2,400 edges remains the end-to-end goal.
