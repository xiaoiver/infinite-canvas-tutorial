# Mixed renderer measurements

Chromium/SwiftShader measurements collected in serial cohorts on the same cloud
environment. Each configuration contributes one completed sample set. This is diagnostic evidence, not a speedup guarantee or a GPU/FPS
benchmark. CPU frame boundaries differ between Core and ECS; compare off/on
within each renderer. The overview zoom and scene density change with count.

The 1,000-object scene has 200 objects of each primitive. The 10,000-object
geometry-scaling scene has 200 text labels and 2,450 of each other primitive.
Core on enables Path instancing only; ECS on also enables text/polyline LOD.

## Native screen work

All requested objects were actually visible in every returned operation row.
These are last measured pan-frame counters, including background; all 30 native
samples per operation are retained in [the raw data](mixed-renderer-results.json).

| Renderer | Visible | Order       | Drawcalls off → on |      Indices off → on | Text proxies on |
| -------- | ------: | ----------- | -----------------: | --------------------: | --------------: |
| Core     |   1,000 | grouped     |          603 → 503 |     395,280 → 395,280 |               0 |
| Core     |   1,000 | interleaved |          603 → 801 |     395,280 → 395,280 |               0 |
| Core     |  10,000 | grouped     |      5,103 → 3,878 | 4,788,330 → 4,788,330 |               0 |
| Core     |  10,000 | interleaved |      5,103 → 7,551 | 4,788,330 → 4,788,330 |               0 |
| ECS      |   1,000 | grouped     |          602 → 304 |      395,280 → 45,000 |             200 |
| ECS      |   1,000 | interleaved |          801 → 801 |      395,280 → 45,000 |             200 |
| ECS      |  10,000 | grouped     |      5,103 → 3,680 |   4,788,330 → 376,050 |             200 |
| ECS      |  10,000 | interleaved |      7,551 → 7,551 |   4,788,330 → 376,050 |             200 |

## CPU frames

Each cell is p50 / p95 in milliseconds, from 30 samples after 15 warmup frames.
Instrumentation and native submission stalls are included. There is no explicit
GPU completion wait in the measured interval. Software rendering, submission
order, driver backpressure and cloud load can affect these samples; this run
does not isolate their individual contributions or establish statistical confidence.

| Renderer | Objects | Order       | Switch |          Pan ms |         Zoom ms | 1% color edit ms |
| -------- | ------: | ----------- | ------ | --------------: | --------------: | ---------------: |
| core     |   1,000 | grouped     | off    |      5.3 / 12.1 |      6.9 / 17.6 |       7.0 / 13.6 |
| core     |   1,000 | grouped     | on     |       5.1 / 9.2 |       4.9 / 8.3 |       8.5 / 22.9 |
| core     |   1,000 | interleaved | off    |      6.7 / 19.3 |      6.3 / 13.9 |       7.1 / 26.2 |
| core     |   1,000 | interleaved | on     |      7.8 / 15.6 |     10.7 / 16.9 |      10.0 / 17.5 |
| core     |  10,000 | grouped     | off    |   59.5 / 2940.2 |   57.1 / 3464.2 |    64.7 / 2647.6 |
| core     |  10,000 | grouped     | on     |   45.2 / 3851.0 |   47.7 / 3380.4 |    68.6 / 2620.6 |
| core     |  10,000 | interleaved | off    | 3431.7 / 4939.2 | 3606.9 / 5013.1 |  3492.6 / 4520.7 |
| core     |  10,000 | interleaved | on     | 2877.9 / 4142.8 | 2990.3 / 4299.6 |  3580.3 / 5012.1 |
| ecs      |   1,000 | grouped     | off    |     18.3 / 31.7 |     15.9 / 23.1 |      38.7 / 70.6 |
| ecs      |   1,000 | grouped     | on     |     12.6 / 17.2 |     12.2 / 15.4 |      30.5 / 38.3 |
| ecs      |   1,000 | interleaved | off    |     20.2 / 33.1 |     19.1 / 44.9 |      42.4 / 62.7 |
| ecs      |   1,000 | interleaved | on     |     17.9 / 30.9 |     16.9 / 20.8 |      40.8 / 49.9 |
| ecs      |  10,000 | grouped     | off    |  115.6 / 3073.5 |  118.4 / 3104.2 |  3170.5 / 3722.6 |
| ecs      |  10,000 | grouped     | on     |    98.5 / 243.0 |    99.1 / 109.9 |    268.5 / 312.6 |
| ecs      |  10,000 | interleaved | off    | 3105.3 / 3783.5 | 3294.3 / 4647.9 |  3457.3 / 4499.7 |
| ecs      |  10,000 | interleaved | on     |   292.1 / 469.6 |   272.2 / 433.4 |    339.0 / 477.0 |

## Active resources and initialization

These are active native object counts after the pan operation, summed across
observed backend contexts (including the shared ECS export context). Requested
buffer bytes cover the owned screen context only. Neither metric is complete
GPU memory. Setup is wall time including construction, settling and setup warmup;
it is excluded from CPU frame samples.

| Renderer | Objects | Order       | Switch | Buffers / textures | Requested buffer MiB | Setup s |
| -------- | ------: | ----------- | ------ | -----------------: | -------------------: | ------: |
| core     |   1,000 | grouped     | off    |        2,411 / 207 |                 1.84 |    7.98 |
| core     |   1,000 | grouped     | on     |        2,110 / 207 |                 1.81 |    6.54 |
| core     |   1,000 | interleaved | off    |        2,411 / 207 |                 1.84 |    6.64 |
| core     |   1,000 | interleaved | on     |        3,203 / 207 |                 1.85 |    6.33 |
| core     |  10,000 | grouped     | off    |       20,411 / 207 |                21.21 |    7.75 |
| core     |  10,000 | grouped     | on     |       16,735 / 207 |                20.94 |    8.87 |
| core     |  10,000 | interleaved | off    |       20,411 / 207 |                21.21 |    8.50 |
| core     |  10,000 | interleaved | on     |       30,203 / 207 |                21.34 |    9.30 |
| ecs      |   1,000 | grouped     | off    |        2,608 / 412 |                 2.10 |    2.22 |
| ecs      |   1,000 | grouped     | on     |         1,314 / 12 |                 0.40 |    0.73 |
| ecs      |   1,000 | interleaved | off    |        3,404 / 412 |                 2.50 |    2.07 |
| ecs      |   1,000 | interleaved | on     |         3,004 / 12 |                 1.08 |    0.89 |
| ecs      |  10,000 | grouped     | off    |     20,612 / 2,662 |                23.75 |   16.25 |
| ecs      |  10,000 | grouped     | on     |        15,943 / 12 |                 3.85 |    5.37 |
| ecs      |  10,000 | interleaved | off    |     30,404 / 2,662 |                28.82 |   22.51 |
| ecs      |  10,000 | interleaved | on     |        30,004 / 12 |                10.10 |    6.75 |

## Completion and limits

The first capped matrix hit its whole-run 20-minute budget after six complete
configurations (18 operation rows). It stopped while measuring the first
operation in Core 10,000/interleaved/off; it did not return a row for that
configuration. The two missing Core configurations passed in a separate cohort.
An older ECS cohort was interrupted after its four 1,000-object configurations
because its first 10,000-object case did not return. A separate fast-failure
diagnostic then observed Becsy shape-change log capacity overflow at 131,072
entries during single-edit scene creation. The fixture now creates at most
1,000 nodes per edit and verifies final document membership and order before
warmup. This changes setup only, retaining all 10,000 visible objects. It does
not change the library transaction limit or App defaults. All eight ECS
configurations were recollected with this setup and passed. The old interrupted
ECS rows are excluded from the canonical dataset. The
[run manifest](mixed-renderer-runs.json) retains failures, interruption and filters;
its output names identify the original local artifacts.

Every completed configuration passed exact native-resource teardown checks:
Core returned to its device startup fallback baseline; ECS released every
observed native object on world exit. The six configurations from the timed-out
run completed teardown before the next setup. This does not cover or fix the
separate legacy Core full-text whole-document replacement leak described in
[the protocol](mixed-renderer-benchmark.md).

The earlier balanced 20%-text 10,000-object attempt produced no valid 10,000-object
frame samples before its whole-run budget expired during scene configuration.
That outcome remains in [its failure record](mixed-renderer-balanced-limit.json).
The capped results must not be presented as results for 2,000 text labels.

Core rows record source tree `55ea3c47103730901fcfcd56a158998ad45e7627`,
available at remote harness commit `c49d5017f4d4e74e43f709f4ab8c90fe4164c76d`.
The local measured commit `db8ec99fe73bb1b6417d701bcfcc92354d488234`
has exactly that same tree. ECS rows use staged harness commit
`234bc4c163578e882cfb4d0ae537439d983026e3`, tree
`2f2ff2c739844777af11534b99323268b8f4d74f`. The changes are ECS setup,
host-side error/stage diagnostics and regressions; Core workload/measurement
code and all rendering-library source remain unchanged. Both versions are
available in this PR history. Rows retain original provenance; the new runner
also records a clean-worktree flag. Browser, Node, CPU, memory and per-frame
native samples remain in the raw JSON.

## Follow-up priorities

In the Core 10,000/interleaved scene, the switch increased pan submissions from
5,103 to 7,551, while the last 1% color-edit frame uploaded 750,672 bytes off
and 13,472 bytes on. The CPU samples do not show a consistent ranking across
operations. A policy based only on drawcall count would miss this tradeoff.

1. Resolve the Core mixed-order planning regression: enabling Path instancing
   increases submissions when compatible Path runs are interrupted by other
   primitives. Any fallback or cost choice must retain rendering order semantics.
2. Reproduce the legacy full-text removal leak on the parent runtime and fix
   drawcall ownership before pursuing shared glyph-atlas performance work.
3. Profile state changes and driver submission pressure, and repeat on hardware
   WebGL before interpreting the CPU differences as stable application gains.
