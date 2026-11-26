# Workflow warm-packing investigation and strict input comparison

Follow-up to #730. **No renderer optimization from this investigation is proposed
for merge.** Three correct experiments did not establish a stable application
gain across Core and ECS. This change publishes a stricter comparator and the
measurement record; Core/ECS production source stays at merged #730 (`6042cf1`).

## Compare qualified real input

```sh
pnpm bench:workflow-input
node scripts/compare-workflow-input.mjs before/workflow-input.json after/workflow-input.json
node --test __tests__/tooling/workflow-input.test.mjs
```

Use different `WORKFLOW_INPUT_OUTPUT_DIR` values for the two source worktrees and
pin the same `WORKFLOW_CHROMIUM`. The comparator accepts the existing 24-node
correctness trace or the 2,400-node trace, keeping them separate. It rejects dirty
or missing source identities, different runtimes/surfaces/anchors/views, changed
graph membership, missing rounds/inputs, synthetic events, multiple engine
executions per input, GPU validation failures, changed documents and incomplete
teardown. Observer clocks and the trusted-input completion boundary must agree.

Native parity is mandatory for **all recorded counters**, including buffer
creation/deletion/allocation, upload calls/bytes and uniforms. It also compares
actual allocated bytes and live resource maps. Equal drawcall/index counts alone
are insufficient. Numeric counters added later are compared too. Selection and
other adorners are counted separately from graph node/edge identity membership.
Counter/memory diagnostic captures are rejected even in self-comparisons.

The output separates first/warm engine wall time, input-to-frame completion and
observation time; it includes native totals and the three longest engine frames
with their allocation/upload counters. It does not infer GPU causality, process
CPU utilization, statistical significance or physical FPS. The existing camera
clock validator is reused with the trusted-input boundary; legacy API-edit
timing is not pooled into these results.

## Experiments retained, not shipped

- **A:** weak renderer-owned segment keys, an 8 MiB two-generation CPU packing
  template budget and fresh final page arrays. First-use data stayed direct.
  Immutable source/placement reuse was high, but template allocation/storage
  increased cold costs and Core totals. No cache is added to production.
- **B:** reuse the existing placement scalars only between synchronous preparation
  and creation, with cleanup on success/failure; direct builders read current
  values. A helper still introduced a dispatch per packed shape.
- **C:** refine B to pass the existing scalar array once per page, avoiding that
  per-shape helper. It preserved the deterministic read reduction but still did
  not demonstrate a reliable end-to-end win. The added hooks are not shipped.

Each experiment ran control / candidate / candidate / control sequentially, in
fresh pages, without other local tests during timing. All results are retained;
the three batches are not pooled. Node 24.22.3 and Chromium 140.0.7339.186 with
SwiftShader were used. Source identities below refer to clean measured commits;
the template branch was subsequently reparented onto the identical merged tree.
Exact experimental source bundles, raw captures, producers, audits and logs are
retained in the private review bundle.

| Batch | Control head / tree | Candidate head / tree |
| --- | --- | --- |
| A: bounded CPU templates | `eaac8c0a05e5b0ef7ef980e77d0588c9acf59483` / `d359571327119cd9013eb776d103b05cfa645827` | `c05b88dd3aa50545fb74bf76711d01e02e7f9d5f` / `7ceef3c861526c51797e6a75a6a1efc3c971fcb7` |
| B: per-shape placement helper | `6042cf157383dc6a7ddf77ce8b22147af317c1f5` / `d359571327119cd9013eb776d103b05cfa645827` | `015fff84d6a8aada28f7ee3021fd62f1e6fb08c9` / `6c58f9c12cdbb1ccc7cf945a1ba1080842d71526` |
| C: one placement array per page | `6042cf157383dc6a7ddf77ce8b22147af317c1f5` / `d359571327119cd9013eb776d103b05cfa645827` | `154b9e0a36df18e4d6e6464596271d27ef0c1415` / `3d5d9f822720b1038b64e9678062dc6ec4568f47` |

## Real Workflow results

The actual workload contains 2,400 cards plus 2,400 edges. The outer viewport is
1500 x 980, the measured canvas is 1148 x 914 CSS pixels, DPR 1. Each traversal
contains ten trusted -100 and ten +100 pixel-wheel events at the canvas center.
Every event reaches its target in exactly one engine execution. These isolated
inputs are not a continuous-gesture acceptance test.

Engine wall time includes synchronous driver waits and ends before observation.
Input-to-frame ends when the target engine execution completes, before physical
presentation. p95 is nearest-rank over 20 events. Times are milliseconds.

| Batch | Capture | Traversal | Engine total | Engine p50 / p95 | Input p50 / p95 |
| --- | --- | --- | --- | --- | --- |
| A | control-1 | first | 790.0 | 24.3 / 76.4 | 24.5 / 76.5 |
| A | control-1 | warm | 571.8 | 18.2 / 70.8 | 18.3 / 71.1 |
| A | candidate-1 | first | 802.4 | 16.1 / 102.4 | 16.2 / 102.5 |
| A | candidate-1 | warm | 537.0 | 15.1 / 64.3 | 16.2 / 64.5 |
| A | candidate-2 | first | 721.6 | 18.4 / 86.2 | 18.7 / 86.5 |
| A | candidate-2 | warm | 551.2 | 15.5 / 69.4 | 15.7 / 69.6 |
| A | control-2 | first | 758.2 | 17.7 / 86.9 | 18.1 / 87.2 |
| A | control-2 | warm | 536.7 | 18.0 / 64.8 | 18.2 / 65.0 |
| B | control-1 | first | 900.0 | 23.3 / 128.6 | 23.5 / 128.8 |
| B | control-1 | warm | 570.0 | 18.4 / 76.1 | 18.7 / 76.4 |
| B | candidate-1 | first | 776.1 | 17.6 / 121.7 | 17.8 / 122.5 |
| B | candidate-1 | warm | 576.6 | 14.8 / 73.2 | 15.5 / 73.4 |
| B | candidate-2 | first | 696.0 | 16.5 / 66.0 | 16.8 / 66.2 |
| B | candidate-2 | warm | 506.1 | 16.3 / 58.6 | 16.5 / 58.8 |
| B | control-2 | first | 709.3 | 18.3 / 79.2 | 18.5 / 79.5 |
| B | control-2 | warm | 612.0 | 17.0 / 90.6 | 17.2 / 90.9 |
| C | control-1 | first | 746.7 | 22.0 / 82.5 | 22.2 / 84.0 |
| C | control-1 | warm | 543.7 | 15.1 / 72.1 | 15.6 / 72.3 |
| C | candidate-1 | first | 833.1 | 20.3 / 92.2 | 20.5 / 92.7 |
| C | candidate-1 | warm | 564.4 | 18.2 / 76.3 | 18.4 / 76.5 |
| C | candidate-2 | first | 798.7 | 18.4 / 83.7 | 18.7 / 83.8 |
| C | candidate-2 | warm | 594.3 | 12.8 / 69.9 | 13.6 / 70.2 |
| C | control-2 | first | 754.7 | 19.5 / 81.8 | 19.9 / 81.9 |
| C | control-2 | warm | 569.6 | 22.3 / 57.0 | 22.5 / 57.2 |

Some Workflow medians improve, but totals/tails do not improve consistently.
For final experiment C, the first engine totals increase in both pairs
(833.1 versus 746.7 ms; 798.7 versus 754.7 ms). Warm totals also increase
(564.4 versus 543.7 ms; 594.3 versus 569.6 ms). These results do not justify
shipping the additional rendering protocol.

## Same 2,400-stroke trace in Core and ECS

The paired stroke workload keeps 12 poses per traversal, the same original
document and native work within each backend. Core retains its synchronous
boundary and ECS its awaited boundary. Do not compare their timer values as an
engine ranking. With 12 poses, nearest-rank p95 is the maximum.

| Batch | Capture | Backend | Traversal | Engine total | Engine p50 / p95 |
| --- | --- | --- | --- | --- | --- |
| A | control-1 | core | first | 246.2 | 12.6 / 70.6 |
| A | control-1 | core | warm | 163.8 | 14.1 / 35.4 |
| A | control-1 | ecs | first | 357.7 | 16.1 / 87.9 |
| A | control-1 | ecs | warm | 216.1 | 13.4 / 45.6 |
| A | candidate-1 | core | first | 305.8 | 18.5 / 94.0 |
| A | candidate-1 | core | warm | 182.1 | 20.2 / 33.5 |
| A | candidate-1 | ecs | first | 357.7 | 15.9 / 81.3 |
| A | candidate-1 | ecs | warm | 241.5 | 9.7 / 62.4 |
| A | candidate-2 | core | first | 335.0 | 17.9 / 100.5 |
| A | candidate-2 | core | warm | 160.4 | 15.8 / 35.9 |
| A | candidate-2 | ecs | first | 324.0 | 13.4 / 68.9 |
| A | candidate-2 | ecs | warm | 216.8 | 9.9 / 61.3 |
| A | control-2 | core | first | 260.1 | 14.7 / 78.6 |
| A | control-2 | core | warm | 152.0 | 14.3 / 26.4 |
| A | control-2 | ecs | first | 293.3 | 14.9 / 83.6 |
| A | control-2 | ecs | warm | 244.6 | 14.3 / 58.8 |
| B | control-1 | core | first | 267.8 | 15.8 / 79.3 |
| B | control-1 | core | warm | 143.8 | 14.1 / 25.6 |
| B | control-1 | ecs | first | 265.3 | 10.0 / 61.5 |
| B | control-1 | ecs | warm | 202.0 | 11.5 / 48.4 |
| B | candidate-1 | core | first | 295.6 | 15.8 / 80.0 |
| B | candidate-1 | core | warm | 186.5 | 16.4 / 32.9 |
| B | candidate-1 | ecs | first | 329.8 | 14.3 / 100.4 |
| B | candidate-1 | ecs | warm | 219.7 | 8.8 / 74.8 |
| B | candidate-2 | core | first | 215.1 | 13.5 / 64.6 |
| B | candidate-2 | core | warm | 147.5 | 16.8 / 24.0 |
| B | candidate-2 | ecs | first | 321.4 | 13.5 / 84.1 |
| B | candidate-2 | ecs | warm | 216.1 | 16.2 / 42.9 |
| B | control-2 | core | first | 231.1 | 12.2 / 69.0 |
| B | control-2 | core | warm | 132.2 | 14.4 / 23.7 |
| B | control-2 | ecs | first | 327.4 | 12.4 / 95.8 |
| B | control-2 | ecs | warm | 251.7 | 11.0 / 71.8 |
| C | control-1 | core | first | 218.3 | 13.6 / 69.6 |
| C | control-1 | core | warm | 146.4 | 12.8 / 35.5 |
| C | control-1 | ecs | first | 292.0 | 10.8 / 85.7 |
| C | control-1 | ecs | warm | 227.9 | 10.6 / 72.5 |
| C | candidate-1 | core | first | 263.1 | 15.9 / 98.7 |
| C | candidate-1 | core | warm | 174.4 | 18.2 / 35.0 |
| C | candidate-1 | ecs | first | 282.9 | 11.5 / 73.8 |
| C | candidate-1 | ecs | warm | 218.8 | 11.1 / 51.1 |
| C | candidate-2 | core | first | 259.2 | 15.2 / 89.6 |
| C | candidate-2 | core | warm | 175.4 | 16.3 / 29.5 |
| C | candidate-2 | ecs | first | 341.3 | 15.1 / 82.9 |
| C | candidate-2 | ecs | warm | 203.9 | 12.4 / 48.7 |
| C | control-2 | core | first | 256.8 | 12.4 / 66.9 |
| C | control-2 | core | warm | 130.4 | 14.5 / 26.6 |
| C | control-2 | ecs | first | 315.2 | 16.4 / 67.6 |
| C | control-2 | ecs | warm | 258.4 | 12.3 / 60.8 |

A increases Core first-traversal totals by about 24-29% in both pairs. C also
increases Core warm totals in both pairs (174.4 versus 146.4 ms; 175.4 versus
130.4 ms). ECS results are mixed. Passing correctness and reducing a lookup
count are insufficient reasons to introduce these changes.

## Deterministic work and memory

All corresponding views, surfaces, visible identities, live resources, allocated
bytes and **every** native counter match across each four-capture batch. First
and warm are separate cohorts because existing precision hysteresis changes
some native index counts between traversals. Documents, GPU gates/positive
controls, pending-input teardown and resource checks pass.

Workflow visible cards/edges range from 36 to 2,400, with 3-22 draws, at most
633,846 indices and four array vertices. Live allocated buffer bytes range from
94,772 to 3,171,388. The stroke workload retains 0-11 draws and up to 999,000
indices. These counts describe native submissions, not measured GPU time.

Each 20-event Workflow traversal still creates **195 buffers**, deletes 195,
and performs **344 buffer uploads**. Upload payload totals are 21,113,992 bytes
on the first traversal and 21,148,840 on warm. All three CPU experiments leave
this work unchanged. A fully visible final frame alone creates 26 buffers and
uploads 3,177,176 bytes. These are observations, not proof that allocation or
upload causes a particular long frame.

Separate counter diagnostics preserve exact ordinary targets/native/resource
parity; their timings are excluded. In each traversal 69 stroke page builds
pack 14,992 shapes. First/warm rows are 273,546 / 274,030. Warm has only 354
newly sampled arrays out of 14,992 curve queries. Placement diagnostics find
266,092 warm rows with an already seen source and unchanged placement (about
97%). B/C consume all 14,992 prepared placements with no direct fallback;
neither reduces the number of page builds or packed rows.

A actually copies 259,884 warm rows from templates (about 95%); template budget
charges peak at 7,061,328 bytes. Separate forced-GC whole-page measurements
report warm backing storage of 52,654,544 bytes versus 46,447,542 in its control
and JS used heap of 50,922,308 versus 49,093,488. The backing-storage gap remains
after example disposal while the page/device is retained. These are diagnostic
whole-page figures, not a per-object heap census or a GPU leak assertion. High
cache hits did not make the memory tradeoff worthwhile.

## Validation and next target

The comparator passes 34 focused cases, including negative qualification controls,
and the complete tooling suite. It qualifies nine comparisons over all ordinary
Workflow batches and rejects memory/counter diagnostics. It does not modify the
producer, observer, event handler, renderer, dependency lockfile or examples.

The final experimental renderer passed 35 Core + 20 ECS unit cases, five focused
source/build/contract typecheck projects, repository ESLint, 32 Chromium 149 +
32 WebKit visual/interaction/export/lifecycle cases, and the complete qualified
replay audits. These checks establish correctness, not performance acceptance.
An ad hoc typecheck of broad existing test entrypoints reported baseline
fixture/API and mixed DOM typing issues; the new missing test constructor
argument was corrected, and no production typing was suppressed.

Local setup used direct Node CLIs (installed pnpm 11 versus requested 9.15.9).
Generated Husky helpers are absent, so checks ran explicitly. Missing workspace
dependency links initially failed tooling security-patch tests; links were
restored and the full suite rerun. The first comparator trial incorrectly counted
selection adorners as graph IDs; the production snapshot contract and positive
fixture now cover that distinction. Full monorepo builds/suites, hardware GPU,
WebGPU, physical presentation and sustained gestures were not run locally.

The next investigation should align long-frame traces with dynamic buffer
creation, upload bytes and submission completion. First establish how much
work comes from stroke pages versus other draws. Any storage/page reuse design
must preserve painter order, precision, culling/reentry, full exports and
in-flight buffer ownership in both Core and ECS. Do not overwrite buffers still
used by deferred submissions or enlarge sampling caches without evidence.
The stable smooth 2,400-node goal remains open.
