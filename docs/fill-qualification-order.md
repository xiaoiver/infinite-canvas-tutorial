# Reject incompatible Path fill instances before effect checks

This is a narrow guard-order change after #728. Both renderers retain their
existing fill/stroke eligibility conditions and fill-then-stroke dispatch. No
qualification result, material key, cache, geometry, shader or resource policy
changes. Default switches, documents, history, interaction and exports retain
their current paths.

ECS now rejects `Stroke.width > 0` before querying the eleven effect components
that can exclude a Path from fill instancing. Core now tests its existing fill
and positive-width painted-stroke exclusions before wireframe, attenuation and
image flags. Their existing differences are preserved: Core permits a `none`
stroke paint regardless of width; ECS's exclusion depends on positive width.
Missing, zero, negative and nonfinite width comparisons retain their existing
behavior. Effect-marked fill candidates can now read stroke state before effect
rejection; this ordering favors the common ordinary stroked-Path case.

## Diagnostic work counts

A separate counter-only run wraps the real ECS fill-key method in the 2,400-card +
2,400-edge trusted-wheel fixture. It forwards the original entity's `has`, `read`
and `hasSomeOf` methods and records only qualification/group calls. Counters reset
after Overview setup, before each 20-event traversal. Its timing is excluded from
ordinary comparisons. Both traversals retain 14,992 fill-key calls and change the
eleven-type effect-group calls from 14,992 to zero. Dynamic qualification is still
performed every time; no eligibility snapshot survives into another plan.

The initial separate CDP profile sampled about 4.4 ms of `hasSomeOf` self residence
under `PathInstances.batchKey` per traversal. The larger aggregate `hasSomeOf`
number includes other callers and must not be claimed as the saving here. Whole
trace profiles also include observers and between-input work.

## Reproduction and committed sources

```sh
pnpm test:browser path-instances.spec.ts core-path-instances.spec.ts stroke-batching.spec.ts camera-replay.spec.ts
pnpm test:browser:webkit path-instances.spec.ts core-path-instances.spec.ts stroke-batching.spec.ts camera-replay.spec.ts
pnpm bench:workflow-input
pnpm bench:camera-replay
```

Run each unchanged benchmark sequentially in control / candidate / candidate /
control checkouts with the same `WORKFLOW_CHROMIUM`. Set separate
`WORKFLOW_INPUT_OUTPUT_DIR` and `CAMERA_REPLAY_OUTPUT_DIR` per capture. The stroke
benchmark is `playwright.camera-replay-bench.config.ts`; the broader
`bench:camera-replay` command also runs the separate legacy Workflow replay.
No trace, observer, assertion, timeout or measurement boundary is changed here.

Ordinary captures used Node 24.22.3, Chromium 140.0.7339.186 with SwiftShader, DPR 1
and clean committed source. No concurrent local browser/test suites ran during
these captures. Counter and CDP modes remain separate and are not pooled below.
Raw captures, producer/analysis helpers, diagnostic profiles and validation logs
are retained in the private review bundle.

| Variant | Commit | Tree |
| --- | --- | --- |

| Control | `d98eabea48408ec6a21fa40c010e3d6e94be59a3` | `49af63fe7d205257284577c02faae3b0c6834430` |
| Candidate | `79eaa63a2de144cd1916f0c52b01b4115fa387ed` | `0730f616f24befd514cfc06216488becdadd6ca7` |

The later report-only commit leaves the measured implementation unchanged.

## Real 2,400-card + 2,400-edge trusted-wheel input

Two 20-event traversals run from Overview in each fresh page, with one completed
engine execution per input. Outer viewport is 1,500 × 980; canvas is 1,148 × 914.
Engine elapsed excludes the subsequent membership/resource observer. Input-to-frame
ends at engine completion, not GPU/display presentation. These are elapsed scopes,
not OS CPU counters. Observer p50/p95 ranges 2.5–3.9 / 3.8–7.5 ms. Workflow uses ECS;
these numbers do not describe a Core application.

| Capture | Traversal | Engine p50 / p95 (ms) | Engine total (ms) | Input-to-frame p50 / p95 (ms) |
| --- | --- | --- | --- | --- |
| control-1 | 0 | 20.9 / 99.0 | 816.0 | 21.1 / 99.2 |
| control-1 | 1 | 17.2 / 84.9 | 628.9 | 20.1 / 85.5 |
| candidate-1 | 0 | 17.6 / 86.4 | 711.8 | 17.8 / 86.6 |
| candidate-1 | 1 | 16.9 / 80.6 | 558.5 | 18.2 / 80.8 |
| candidate-2 | 0 | 21.4 / 77.3 | 770.1 | 21.6 / 77.8 |
| candidate-2 | 1 | 13.7 / 91.2 | 629.8 | 14.1 / 91.4 |
| control-2 | 0 | 17.4 / 64.5 | 645.2 | 17.7 / 65.8 |
| control-2 | 1 | 18.3 / 58.5 | 529.1 | 20.0 / 60.4 |

All four captures and both traversals have exact corresponding target views,
one-execution counts, visible IDs, canvas surfaces, all native counters, allocated
buffer bytes and live resources. Visible cards/edges range 36–2,400; work remains
3–22 draws, 15,516–633,846 indices and four array vertices. Allocated buffer bytes
range 94,772–3,171,388. Document equality, GPU gates, injected-error positive control,
synthetic-input rejection and pending-input teardown pass.

There is no stable end-to-end improvement. Warm candidate input p95 is
80.8–91.4 ms versus 60.4–85.5 ms in controls. Candidate 1 improves totals relative
to control 1, while candidate 2 is slower than control 2 in both traversals. The
deterministic result is fewer effect-group queries. The 2,400-node smoothness
target remains open; no application speedup factor is claimed.

## Same qualified 2,400-stroke Core/ECS trace

Each backend receives identical geometry and twelve requested views, including
Overview, zoom, pan, idle, offscreen culling and reentry. Two traversals run per
fresh page. Canvas is 800 × 600 with a 1,000 × 760 viewport. Core synchronous and
ECS complete awaited execution boundaries remain separate; idle steps are included.
With twelve poses, nearest-rank p95 is the maximum. Observer p50/p95 ranges
0.1–0.2 / 0.2–2.7 ms for Core and 0.4–0.7 / 0.9–2.0 ms for ECS.

| Capture | Backend | Traversal | Engine p50 / p95 (ms) | Operation-to-frame p50 / p95 (ms) |
| --- | --- | --- | --- | --- |
| control-1 | core | 0 | 15.0 / 111.6 | 15.0 / 111.6 |
| control-1 | core | 1 | 14.2 / 35.5 | 14.2 / 35.6 |
| control-1 | ecs | 0 | 12.6 / 88.6 | 21.1 / 91.0 |
| control-1 | ecs | 1 | 12.1 / 92.7 | 18.3 / 95.3 |
| candidate-1 | core | 0 | 14.4 / 75.7 | 14.4 / 75.7 |
| candidate-1 | core | 1 | 15.4 / 36.2 | 15.4 / 36.2 |
| candidate-1 | ecs | 0 | 11.6 / 77.1 | 22.0 / 83.5 |
| candidate-1 | ecs | 1 | 14.5 / 50.9 | 19.6 / 58.4 |
| candidate-2 | core | 0 | 14.4 / 88.1 | 14.4 / 88.1 |
| candidate-2 | core | 1 | 12.0 / 32.3 | 12.0 / 32.3 |
| candidate-2 | ecs | 0 | 10.5 / 118.7 | 20.9 / 131.4 |
| candidate-2 | ecs | 1 | 18.3 / 60.7 | 23.8 / 67.4 |
| control-2 | core | 0 | 12.4 / 90.6 | 12.4 / 90.6 |
| control-2 | core | 1 | 11.4 / 33.9 | 11.4 / 33.9 |
| control-2 | ecs | 0 | 14.1 / 132.4 | 19.9 / 143.6 |
| control-2 | ecs | 1 | 16.0 / 61.2 | 20.4 / 76.9 |

Within each backend/traversal, the four captures have exact target views, surfaces,
visible indices, page counts, all native counters and live resources. Visibility
ranges 0–2,400; native draws 0–11, indices 0–999,000 and array vertices 0–4.
Documents and teardown pass. Both existing strict replay comparisons pass with
`--require-native-parity`. No drawcall, upload or GPU-storage saving is claimed;
these results also do not establish a consistent whole-trace speedup.

## Separate long-frame attribution

A further candidate-only CDP diagnostic aligns profile timestamps with completed
engine windows. `Performance.Timestamp` is bracketed by page `performance.now`
reads after profiling starts; its timestamp is checked inside the profile's
start/end interval. The observed clock brackets are 3.1 and 3.2 ms. Analysis keeps
only sample overlap guaranteed to be inside each engine window for every offset
within that bracket. The earlier attempt to bracket `Profiler.start` itself had
100–257 ms uncertainty and supplied no usable per-frame attribution.

The diagnostic retains exact ordinary candidate targets, memberships, native
counters and resources. Sampling changes timing and optimization behavior; none
of its elapsed values replaces the ordinary table. Sampled stack residence is
wall-time attribution, potentially including native waiting, not process CPU or
GPU utilization and not a complete causal explanation.

| Diagnostic traversal / step | Profiled engine elapsed (ms) | Examples of self-sample residence in guaranteed window (ms) |
| --- | --- | --- |
| first / 0 | 161.8 | adaptive `bezier` 21.8; adaptive closure 10.9; segment `updateBuffer` 9.7 |
| first / 2 | 90.7 | adaptive `bezier` 14.2; cubic `getPoint` 8.4; segment `updateBuffer` 5.4 |
| warm / 19 | 85.6 | Becsy getter 11.6; `createGeometry` 10.5; `hasSomeOf` 8.3; page packing 7.7 |
| warm / 18 | 72.6 | page packing 9.3; Becsy `read` 7.6; dirty-flag preparation 4.3 |

This points the next investigation toward precision-miss curve subdivision and
segment generation on first visits, plus page geometry rebuilding/packing and
repeated component access on warm reentry. Work counters and native/async trace
attribution should distinguish those costs before choosing a broader cache or
storage change. The small fill-guard change is not presented as a long-frame fix.

## Validation and limits

Passed locally:

- 38 Core and 110 ECS unit cases covering fill/stroke eligibility, complex-style
  fallbacks, width comparison boundaries, live edits, batching transitions,
  geometry/cache reuse, buffers and ownership.
- 32 Chromium 149 and 32 WebKit paired browser cases covering filled/stroked
  pixels, painter order, caps/joins, style changes, picking/hover/marquee,
  history, parent transforms, camera migration, WebGL1, full raster exports,
  culling/reentry, same-frame deletion and native teardown.
- Four ordinary wheel and four paired stroke captures with strict corresponding
  native-work/membership/resource parity; separate work-count and CDP diagnostics.
- Repository zero-warning ESLint, Core/ECS no-emit typechecks, browser/Workflow
  benchmark TypeScript projects, 48 tooling cases and Markdown checks.

Node CLIs ran directly with installed pnpm 11 rather than requested pnpm 9.15.9.
WebKit uses the environment's existing host-requirement precheck override with real
assertions unchanged. Generated Husky helpers are absent, so checks ran explicitly.
Unrelated legacy test formatting was preserved. Full package/site builds, complete
test suites, physical-device GPU/presentation and sustained gestures were not run
locally. This patch adds no retained cache; no whole-heap saving is claimed.
