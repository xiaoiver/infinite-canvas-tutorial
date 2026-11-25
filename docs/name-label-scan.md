# Skip disabled name-label work

`RenderNameLabel` previously visited every entity with `Name` and `ComputedBounds`
each browser frame, even when every canvas had `penbarNameLabelVisible: false`
(the default). That scan was visible in the real Workflow wheel CPU samples.

The system now checks the canvas preferences first. If no canvas enables name
labels, it hides any existing label elements and returns before scanning named
entities. Removal cleanup still runs first, so deleting or replacing sources while
labels are disabled cannot retain their DOM labels. When any canvas enables the
feature, the existing 2D/3D eligibility, projection, camera, culling and DOM update
path runs unchanged. Finalization still removes all owned labels.

This is an ECS overlay optimization. Core has no `RenderNameLabel`, `Name`
component scan or `penbarNameLabelVisible` setting. Its selector creates overlays
for selected shapes and hides them on deselection; see
`packages/core/src/plugins/Selector.ts` (`getOrCreateSelectable`, `selectShape`,
`deselectShape`). Adding a renderer flag or a synthetic name-label pass to Core
would not improve this workload. Core/ECS geometry, picking, LOD eligibility,
exports, stored document data and batching switches are unchanged. The paired
fixed-replay document/resource tests still run against both renderers.

`name-label.spec.ts` runs in Chromium and WebKit. A narrowly scoped observer
counts actual `Name` reads during the real name-label system and restores both
wrapped methods afterward. All-disabled canvases must perform zero reads; an
enabled-canvas positive control must perform reads and show the selected label.
Other cases cover independent canvases, disabling existing labels, deletion while
disabled, re-enabling, real pointer hover, renamed selections, zoom-adjusted
anchors, source visibility, document equality and free-3D companion labels.
The 3D fixture explicitly supplies an optional DOM overlay and destroys it with
the canvas. The observer is test-only and is not loaded by the Workflow benchmark.

Use the unchanged trusted-wheel measurement contract in
[workflow-input-benchmark.md](workflow-input-benchmark.md) for the 2,400-card and
2,400-edge comparison. Run independent control/candidate/candidate/control
captures with the same Chromium executable, viewport, DPR and native input
sequence. Both sources must be committed and clean. Keep preparation executions,
matched-camera executions, observers and input latency separate. A name-scan
reduction does not by itself establish smooth continuous zooming or explain the
remaining inter-frame scheduling tail.

## Recorded comparison (2026-11-25)

The control is master `49930b0b73606de7ba565f279cc7f5b8ad724647`, tree
`5058cf73182578148efba258fb70d17f76d7d1e8`. The candidate is
`c4f5023942be9f4a11dfe63d158f3f235520dc91`, tree
`49cac17d1b601605e935bce19f8401f91661f6b4`. All four captures reported
`dirty: false`, Chromium 140.0.7339.186/SwiftShader and Node 24.22.3.
Each independent capture used the unmodified 2,400-card + 2,400-edge trusted-wheel
script at a 1500×980 viewport/DPR 1, with two traversals of 20 events each.
The application retained its default disabled name-label preference.

| Run / traversal     | All engine p50 / p95 (ms) | Matched engine p50 / p95 (ms) | 40 executions total (ms) | Input-to-frame p50 / p95 (ms) |
| ------------------- | ------------------------- | ----------------------------- | ------------------------ | ----------------------------- |
| control 1 / first   | 5.3 / 77.4                | 22.7 / 89.6                   | 829.9                    | 43.9 / 106.5                  |
| control 1 / warm    | 4.5 / 53.0                | 14.6 / 59.3                   | 552.9                    | 45.9 / 509.1                  |
| candidate 1 / first | 1.4 / 81.3                | 16.5 / 106.9                  | 818.4                    | 37.7 / 124.1                  |
| candidate 1 / warm  | 1.2 / 53.3                | 13.6 / 56.1                   | 506.0                    | 44.0 / 105.6                  |
| candidate 2 / first | 2.9 / 79.6                | 20.2 / 83.7                   | 774.5                    | 49.5 / 183.3                  |
| candidate 2 / warm  | 1.5 / 49.6                | 13.2 / 50.6                   | 466.6                    | 34.7 / 102.9                  |
| control 2 / first   | 4.3 / 81.6                | 21.7 / 94.9                   | 788.7                    | 38.5 / 111.6                  |
| control 2 / warm    | 5.7 / 70.2                | 16.5 / 83.8                   | 663.9                    | 44.5 / 480.2                  |

All 160 input steps retained one preparation execution and one matched-camera
execution. Requested and derived cameras, viewport surfaces, visible memberships,
drawcalls, indices and array-vertex counts matched the first control exactly at
every corresponding execution, including both traversals. Each capture preserved
the complete document, passed before/after GPU-error checks and passed real
teardown without reported leaks. Matched frames submitted 3–22 draws, at most
633,846 indices plus four array vertices; all traversals ended at 3,171,388 tracked
buffer bytes and the same live-resource counts. The observer was timed separately
and its per-execution p95 was 2.3–5.0 ms across the eight traversals.

Both warm candidate captures had lower engine totals and input p95 than either
control in this local sample. The first traversal was mixed: candidate 1 matched
frame p95 was 106.9 ms versus the controls' 89.6/94.9 ms. No uniform cold-path
speedup or fixed multiplier is claimed. A passive overlay guard cannot be taken
as proof of the cause of the remaining scheduling gap. Warm input p95 is still
over 100 ms, and the extra preparation execution remains. This does not meet the
smooth 2,400-node interaction goal; the next comparison should target transient
camera update ordering and then verify continuous gestures on physical hardware.

Validation passed: the three name-label browser cases and the paired Core/ECS
fixed replay in Chromium 149 and WebKit (ten cases total), 15 replay/input unit
cases, 48 tooling tests, repository ESLint with zero warnings and the browser
TypeScript project. The initial 3D test lacked the optional overlay container;
the fixture now explicitly supplies it for that test. Full package/site builds,
the complete unit/browser suites and hardware continuous-gesture tests were not
run. Raw captures and the qualified-source summary are retained in the private
review backup rather than added to the repository.

```sh
pnpm test:browser name-label.spec.ts camera-replay.spec.ts
pnpm test:browser:webkit name-label.spec.ts camera-replay.spec.ts
pnpm bench:workflow-input
```
