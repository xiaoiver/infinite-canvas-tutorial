# Continuous Workflow input: receipt marks and frame gaps

Follow-up to [#746](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/746) and the [continuous input protocol](./continuous-wheel-input.md). The 2,400-card + 2,400-edge target remains open. Two independent diagnostic captures place most long zoom-in frame gaps outside recorded renderer-main-thread tasks, overlapping recorded GPU-process main-thread tasks. This narrows the investigation to browser graphics submission/composition in this software-rendering environment. It does not identify hardware GPU execution time, a blocking dependency, or physical presentation.

This change adds diagnostic tooling, not a rendering optimization. Core/ECS production sources, the normal Workflow entry, CSS, geometry, shaders, LOD settings and full export paths are unchanged. The existing shared timeline collector keeps its default categories/profile behavior; only the explicit `continuous-input` scope adds input/compositor categories and refuses CPU profiling. There are no new dependencies.

## Boundaries and qualification

Ordinary continuous runs remain uninstrumented by CDP or input marks. Explicit diagnostic runs use both `CAMERA_TIMELINE_DIR` and `CAMERA_TIMELINE_MODE=trace`, a separate capture mode, and a benchmark-only `continuousTrace=1` query. They add a unique `performance.mark` after each accepted trusted receipt. Synthetic input cannot create marks. All receipt marks are cleared at teardown. The ordinary workload summarizer rejects both diagnostic metadata and leftover marks, even after capture-mode relabeling.

The trace categories are `toplevel,devtools.timeline,v8,blink.user_timing,cc,gpu,viz,input,latencyInfo,benchmark`. No CPU profiler, screenshots, screencast or heap capture is enabled. Two page/trace anchors must agree within 0.2 ms and the independent Performance.Timestamp bracket must be at most 10 ms. Trace loss, source/browser/Node mismatches, duplicate or misplaced input marks, invalid frame order and fabricated windows reject the result. Failed raw records are saved before analysis. No existing gate is relaxed.

For each gesture, windows partition the span from first actual DOM receipt to the final completed engine execution. Executions entirely before that receipt remain outside; a crossing execution is clipped to the intersection. Consecutive windows distinguish engine execution from gaps. Each input must satisfy the original trusted-delta, monotonic camera-prefix and final-target checks. Surface, original document, GPU-error and real teardown checks still apply.

The analyzer maps marks into the trace clock and reports candidate main-thread `EventDispatch` wheel intervals containing each receipt. Missing or ambiguous dispatch records are counted rather than invented. Main-task and GC coverage use interval unions. Each other thread has its own union of recorded complete events; nested events are not summed into a total. Inclusive label durations remain labeled and can overlap. Different threads' coverage must not be added together. Coverage is recorded wall time, not CPU utilization, GPU execution or proof of a wait.

## Source and environment

The large captures measured clean local `43af21321ac974eb88777a086fd87d173b7444cd`, tree `81d7d09ab578c6736f1fbaf803a8127ea227dee9`. Public [implementation commit](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/5a9681aede94cdd747674eabff9b77bbff2581c5) has that identical tree. Base is #746 merge `2c0ea6b4641794f863013f9ea2c8bdf06766e07d`.

A later [analysis boundary correction](https://github.com/xiaoiver/infinite-canvas-tutorial/commit/94ec9abf3830fe806868a5f2bc81a9eb241e5db4), local `f13e0754b043857cc228b9e0141c803e25008509`, tree `d764a2ae40ceb9b6f7aee259544c9a9151b792c1`, handles pre-receipt idle frames. Reanalysis gives exactly identical summaries for all three previously qualified traces. It changes no page observer, input policy or rendering code. WebKit and final 24-node trace smoke use this corrected clean source. Reporting changes no measured browser code.

Node 24.22.3; timing Chromium 140.0.7339.186, headless SwiftShader, DPR 1. Outer viewport is 1500 × 980; actual canvas and drawing buffer are 1148 × 914. The document has 4,801 entities. Every zoom-in begins with 2,400 cards and 2,400 edges visible. All 2,400-node captures ran serially without other local tests/profilers overlapping. Diagnostic and ordinary samples have different actual coalesced receipts and reached poses, so they are not fixed-work A/B cohorts. No timing ratio is claimed.

## Ordinary continuous input

Each gesture dispatches 40 commands, deltaY ±20, at 16 ms host cadence over nominally 624 ms. This repeats the existing protocol with diagnostics off. The captured engine time is wall elapsed time for `world.execute`, not CPU usage. Frame intervals include gaps; receipt-to-prefix latency excludes pre-DOM delivery and physical presentation.

| Round / zoom | Receipts / rendered frames | Receipt span ms | Engine p50 / p95 ms | Completed-frame interval p95 ms | Total draws / indices |
| --- | --- | --- | --- | --- | --- |
| 0 / in | 22 / 17 | 4352.9 | 21.2 / 116.1 | 785.5 | 168 / 4,648,512 |
| 0 / out | 24 / 19 | 2302.6 | 24.0 / 81.6 | 252.9 | 199 / 5,718,876 |
| 1 / in | 21 / 20 | 6550.8 | 17.4 / 64.9 | 783.7 | 166 / 4,594,464 |
| 1 / out | 23 / 17 | 1487.3 | 24.7 / 71.3 | 179.6 | 177 / 5,098,821 |

Delivered deltas total ±800 per gesture. Zoom-in ends at 102 visible cards / 90 edges and 184,916 logical allocated buffer bytes; zoom-out returns to 2,400 / 2,400 with 3,362,908 and 3,358,300 bytes in the two rounds. Allocation counts, array vertices, upload bytes and full endpoint resources remain in the [machine-readable report](./continuous-wheel-timeline-results.json) and raw workload. All input-prefix, document, GPU and cleanup gates pass. These frame intervals do not establish smooth interaction.

## Separate diagnostic captures

Both captures pass all workload gates and trace qualification. The first maps 91/91 receipt marks uniquely to wheel dispatches; the second maps 90/90, with no unmatched or ambiguous records. Maximum receipt-to-mark overhead is 0.5 / 0.3 ms. This overhead and tracing are why diagnostic elapsed time stays separate from ordinary results.

| Capture / round / zoom | Gap total ms | Main-task coverage ms | Main GC label union ms | GPU-process CrGpuMain recorded-event union ms |
| --- | --- | --- | --- | --- |
| 1 / 0 / in | 5003.5 | 70.3 | 0.0 | 4983.2 |
| 1 / 0 / out | 1208.0 | 90.7 | 35.0 | 1193.6 |
| 1 / 1 / in | 6217.6 | 58.3 | 1.5 | 6215.4 |
| 1 / 1 / out | 1269.0 | 54.5 | 0.0 | 1267.3 |
| 2 / 0 / in | 4448.1 | 85.4 | 10.9 | 4429.2 |
| 2 / 0 / out | 790.1 | 57.5 | 4.1 | 783.3 |
| 2 / 1 / in | 6213.3 | 89.9 | 2.2 | 6207.5 |
| 2 / 1 / out | 852.6 | 161.0 | 90.5 | 830.3 |

During zoom-in gaps, renderer main tasks cover 0.94–1.92%; CrGpuMain recorded events cover 99.58–99.96%. Labels include `Scheduler::RunTask`, `GpuChannel::ExecuteDeferredRequest`, `GLContextEGL::MakeCurrent` and `SkiaOutputSurfaceImplOnGpu::FinishPaintCurrentFrame`. Nested inclusive durations overlap. They do not distinguish command execution, a context switch/flush, scheduling or synchronization. GC is present, especially in one zoom-out, but its recorded main-thread intervals do not cover the long zoom-in gaps.

The next experiment should isolate WebGL submission from compositor/Skia work under matching camera/workload checks, including the example's translucent backdrop effects as a hypothesis. Hardware GPU validation remains necessary. This report does not prescribe removing a visual effect, reducing quality or changing rendering semantics based only on overlapping task labels.

## Validation and reproduction

Local checks: 160 tooling cases, five recorder unit cases, 12 Chromium and 12 WebKit Core/ECS camera/wheel cases; Core/ECS build types, browser/benchmark types and Workflow benchmark types; ESLint and diff checks. Chromium correctness uses version 149, separate from timing 140. WebKit 26.5/build 2388 runs ordinary 24-node smoke only; host-library preflight is skipped, browser assertions are not. The final 24-node trace smoke passes mark/clock/resource checks. Shared default-scope trace-only capture also passes the existing fixed 2,400-stroke Core/ECS trajectory, document, GPU and teardown checks. This is compatibility evidence, not per-frame equality or speedup evidence.

The first 24-node trace is deliberately unqualified: its clock bracket is 18.7 ms, above the unchanged 10 ms limit. A fresh capture passes; the failed raw trace and incomplete lifecycle record are retained. An initial paired-run invocation used an incorrect browser-path environment variable and failed before browser launch; the corrected invocation passes. An optional formatting command used a nonexistent cached CLI path; formatting was corrected manually and final lint/diff checks pass. All failures remain in the private review archive along with qualified captures, exact source bundles/patches and verification logs. Cached dependencies were reused without a fresh install; no dependency/audit policy changed. Full package/site/packed-package builds and broader renderer suites run in CI; hardware GPU, WebGPU, CPU profiling and physical-presentation analysis were not run locally.

```sh
# Ordinary acceptance protocol: diagnostics unset, clean committed source.
WORKFLOW_INPUT_COUNT=2400 WORKFLOW_CONTINUOUS_OUTPUT_DIR=/tmp/continuous-ordinary pnpm bench:workflow-continuous

# Separate trace-only diagnostic. Use fresh directories and the same pinned browser.
WORKFLOW_INPUT_COUNT=2400 WORKFLOW_CONTINUOUS_OUTPUT_DIR=/tmp/continuous-trace CAMERA_TIMELINE_DIR=/tmp/continuous-trace CAMERA_TIMELINE_MODE=trace pnpm bench:workflow-continuous

# Shared Core/ECS collector retains its default scope.
CAMERA_REPLAY_OUTPUT_DIR=/tmp/paired-trace CAMERA_TIMELINE_DIR=/tmp/paired-trace CAMERA_TIMELINE_MODE=trace pnpm exec playwright test -c playwright.camera-replay-bench.config.ts
pnpm test:tooling
```

Set `WORKFLOW_CHROMIUM` to the intended Chromium executable when using a pinned timing browser. Continuous diagnostics require Chromium and reject profile, phase, upload or texture combinations. The raw workload, raw trace, original main-thread summary and continuous summary are emitted separately. The public JSON rounds displayed noninteger metrics to three decimals and records exact hashes/byte counts; the private archive preserves all inputs for reanalysis. #746 has merged and its automatic package publication/production deployment passed; this follow-up remains draft.
