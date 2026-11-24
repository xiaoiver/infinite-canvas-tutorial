# Reuse stroke segments while sampled levels remain live

Core and ECS screen `StrokeBatch` pages share sampled curve precision through
`PathGeometryCache`. Its pool keeps four LRU levels plus current levels referenced
by active render contexts. Previously, derived cap/join/travel arrays retained
only the most recent level, so revisiting sampled points rebuilt those arrays.

The segment cache now weakly keys both the shape and the sampled point-array
identity. It reuses derived arrays while those keys remain reachable, without
extending the lifetime of either key. Each owner has one current cap/join style;
a successful style change replaces all its sampled entries. An unkeyed request
clears the owner. Results publish only after the original builder succeeds, so a
failed build preserves earlier valid hits. Undefined results remain valid hits.
Builders, transforms, GPU buffers and drawcall pages are not stored here.

This applies to the existing opt-in screen stroke path in both backends. No new
switch, default, dependency or geometry formula. Packing still reads current
translation and painter order and allocates the same GPU inputs. Full renderers
and exports use their independent original paths. Documents, history, picking,
bounds, precision hysteresis, culling and GPU ownership remain unchanged.

## Ownership and memory

More derived CPU arrays can remain live while their sampled levels are live.
The existing upstream precision pool and active contexts determine that lifetime;
this cache introduces no strong precision-key collection or independent byte
budget. It does not guarantee a fixed byte ceiling for arbitrary externally held
point arrays. Source edits, LRU eviction, context release and owner release allow
collection once their sampled keys become unreachable. Garbage collection is
asynchronous, so this is not an immediate memory-release promise.

Shared tests check precision revisits/eviction, style/source edits, independent
owners/devices/full passes, unchanged local bytes, missing keys, undefined results
and failed builds. A separate real Node GC test roots the cache and selected keys
and verifies collection of dropped samples/owners, value/key cycles, replaced
styles, unkeyed entries and builder closures. Both backends run the same test;
the prior implementation fails its dropped-sample control.

## Reproduce

Run serial clean before/after worktrees with the same pinned browser and DPR:

```bash
pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
pnpm exec playwright test -c playwright.workflow-replay-bench.config.ts
pnpm exec playwright test -c playwright.stroke-reuse-bench.config.ts
WORKFLOW_BENCH_IMAGES=1 WORKFLOW_BENCH_PROFILE=0 pnpm bench:workflow
node --test __tests__/tooling/stroke-segment-cache.test.mjs
```

Set `CAMERA_REPLAY_OUTPUT_DIR`, `STROKE_REUSE_OUTPUT`, `WORKFLOW_BENCH_OUTPUT` and
`WORKFLOW_CHROMIUM` to keep separate captures with a chosen executable. Require
matched camera/membership/surface/native work via `compare-camera-replay.mjs
--require-native-parity`. The stroke-reuse control samples aggregate browser heap
and backing storage after forced GC outside its timed operations; it does not
measure an individual cache or native GPU memory. Report CPU and heap tradeoffs
for Core and ECS separately, including regressions. Diagnostics count builders
separately from ordinary timing. Raw captures stay ignored local artifacts.

The PR records actual results and limitations. Smooth interaction with 2,400
Workflow cards and 2,400 edges remains an end-to-end qualification goal.
