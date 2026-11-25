# Early transient camera navigation

Workflow wheel input previously called `Engine.view`, which coalesced app-state
updates into the late `runAtNextTick` queue. The camera was derived on a following
execution. The real input capture therefore retained a zero-draw preparation execution
before each matching camera execution, even though navigation did not edit the
scene.

ECS now provides `API.setCameraView({ x, y, zoom, rotation? })`. It queues only
camera values in the existing safe Edit write phase and does not call `record`.
Consecutive pending views coalesce with copied input values. The latest supplied
rotation survives following pan-only requests; when none is supplied, the applied
rotation is retained. `edit()` separates coalescing groups so document mutations
cannot reorder navigation. A drain separates the active batch from reentrant
requests, which run next tick. The owning canvas cancels all pending requests on
destruction through the existing queue lifetime.

A request resolves `true` after state application, `false` on destruction and
rejects invalid/unrepresentable values or application failures. Completion is not
a rendering promise and does not guarantee rollback on failure. Initialized
cameras derive in that execution; first camera setup keeps its existing deferred
state behavior. Arbitrary document/history callbacks cannot be submitted through
this method, and legacy `runAtNextTick` ordering remains unchanged.

The example uses the new queue only for navigation after loading. Its masked
scene setup retains the old late ordering. An initial pilot advanced both setup
and interaction; it changed adaptive-curve cache history and submitted different
index counts, so that pilot is excluded from performance claims. The final small
control/candidate checks match cameras, membership and submitted indices, with two
executions per input in the control and one in the candidate. A newer live input
also clears an obsolete load request so it cannot overwrite the user's view later.
Rejected live requests are reported through the existing example error path.

Core camera setters already update matrices synchronously. Core's zero-duration
`gotoLandmark` now cancels the prior flight before applying the view, and the first
animation-frame handle is retained so it can be cancelled before its first callback.
The pure Core cases cover interruption before/between callbacks and synchronous
projection. ECS cases cover interruption, including an unchanged destination.
This preserves a common transient-navigation contract without introducing an ECS
queue into Core.

The paired browser replay retains the existing fixed controls and adds transient
controls for Core/ECS. It checks the first complete camera execution, visibility
and culling reentry, identical document data, raster exports from the same view,
and native resource teardown. Exports from different camera views are expected to
differ; the test fixes the same view before its initial/final comparison. Unit
cases cover coalescing, copied values, edit barriers, rotation, reentrancy, redo,
uncommitted document changes, errors and same-frame destruction of another canvas.
The existing edit-stage and landmark tests remain controls.

The unchanged `pnpm bench:workflow-input` workload is used for the qualified
2,400-card / 2,400-edge comparison. Match requested/derived cameras, visible
memberships, surfaces and native work at target executions. Preparation execution
counts intentionally differ; report matched engine durations, all execution work,
observer cost and input latency separately. Software WebGL timings do not certify
smooth continuous gestures on physical hardware.

## Qualified comparison (2026-11-25)

Control: `cb4b63b0188063ef05b765d8aedadc8f26834f7a`, tree
`e83c06f018e2c155487f618c4dab2437a6631a98`. Candidate:
`71019a64b69bbed45c3811b68c8af6fcec28362b`, tree
`52a2596b850e2db3b0f00cd5fe362b354c0e5351`. All four ordinary captures
were committed and clean, using the identical trusted-wheel script, Chromium
140.0.7339.186/SwiftShader, Node 24.22.3, viewport 1500×980 and DPR 1.
Each traversal contains 20 trusted events across 2,400 cards and 2,400 edges.

| Run / traversal     | Executions | Engine total (ms) | Matched engine p50 / p95 (ms) | Input-to-frame p50 / p95 (ms) | Observer p50 / p95 (ms) |
| ------------------- | ---------- | ----------------- | ----------------------------- | ----------------------------- | ----------------------- |
| control 1 / first   | 40         | 892.2             | 20.4 / 99.6                   | 37.2 / 191.8                  | 2.4 / 5.1               |
| control 1 / warm    | 40         | 624.3             | 22.3 / 74.0                   | 47.1 / 194.2                  | 2.3 / 4.3               |
| candidate 1 / first | 20         | 993.4             | 24.8 / 129.0                  | 25.1 / 129.2                  | 3.7 / 7.5               |
| candidate 1 / warm  | 20         | 679.4             | 24.4 / 75.2                   | 24.7 / 75.5                   | 3.0 / 5.5               |
| candidate 2 / first | 20         | 770.9             | 19.2 / 92.1                   | 19.4 / 92.4                   | 2.9 / 4.3               |
| candidate 2 / warm  | 20         | 460.9             | 17.3 / 48.9                   | 18.4 / 49.1                   | 2.2 / 3.2               |
| control 2 / first   | 40         | 817.0             | 20.1 / 84.3                   | 40.7 / 101.0                  | 2.4 / 6.7               |
| control 2 / warm    | 40         | 651.0             | 21.2 / 88.9                   | 44.4 / 109.6                  | 2.5 / 6.5               |

All 160 input steps matched corresponding requested/derived cameras, surfaces,
visible memberships, drawcalls, indices and array vertices at the target execution.
The control retains one zero-draw preparation execution per input; the candidate
has none. This is a scheduling change, so aggregate per-execution percentiles with
different execution counts are not a like-for-like CPU comparison. Engine duration
is asynchronous wall time, not measured thread CPU time. Each completed execution
also has an observer: the control's extra preparation observer is included in its
input latency. That diagnostic overhead must not be attributed to application work.

Matched executions submitted 3–22 draws, at most 633,846 indices and four array
vertices. All traversals ended at 3,171,388 tracked main-context buffer bytes, with
stable live resource counts. All captures passed document equality, GPU-error
validation before/after each traversal, pending-input cancellation and real teardown
without reported native leaks. The final source retains scene-load ordering; the
unqualified pilot with differing index counts is excluded.

Both warm candidate input p95 samples were below the controls, while engine times
were mixed. Candidate 1's warm engine total was 679.4 ms, above the controls'
624.3/651.0 ms; candidate 2 was 460.9 ms. Candidate 1's first-traversal matched p95
was 129.0 ms versus the controls' 99.6/84.3 ms. No uniform CPU throughput gain or
fixed multiplier is claimed. Input p95 remains 49.1–75.5 ms in the warm candidates;
this does not meet the smooth 2,400-node target. Physical GPU/display presentation
and continuous gestures still need device verification.

Validation passed:

-   39 ECS cases for navigation, edits, landmark animations and the write stage.
-   17 Core camera/replay/input cases, including interruption before/between callbacks.
-   Eight paired Core/ECS fixed/transient browser cases in Chromium 149 and WebKit,
    including one-execution arrival, culling/reentry, same-view raster export equality,
    unchanged documents and native teardown.
-   Trusted-wheel small-scene checks in Chromium and WebKit; target geometry matched
    the current control while executions per input dropped from two to one.
-   All six real Workflow UI cases, including 2,400-node scene switching, tour
    cancellation, pointer zoom/pan, connected-edge dragging, settings and JSON export.
-   Repository zero-warning ESLint, 48 tooling cases, browser/Workflow benchmark
    TypeScript projects and Markdown checks.

The existing Core `camera.spec.ts` could not start because the environment lacks
its native `gl` binding. The new pure camera test imports the camera directly;
no WebGL mock or assertion suppression was added. The default Workflow test server
also failed to start through the installed pnpm 11 (the repository requests 9.15.9).
The same installed Vite was launched directly for the successful six-case UI run,
with unchanged assertions/timeouts/retries. WebKit used the environment's existing
host-requirement precheck override; real browser assertions ran unchanged. Full
package/site builds, complete unit/browser suites and physical-device testing were
not run locally.

```sh
pnpm test:browser camera-replay.spec.ts
pnpm test:browser:webkit camera-replay.spec.ts
pnpm test:workflow
pnpm bench:workflow-input
```
