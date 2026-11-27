export const makeWorkflowInputCapture = () => {
  const deltas = [-100, -100, 100, 100],
    view = { x: 0, y: 0, zoom: 1 };
  return {
    schema: 1,
    workload: 'workflow-trusted-wheel',
    count: 24,
    dpr: 1,
    viewport: { width: 1500, height: 980 },
    browser: 'test',
    node: 'test',
    source: { dirty: false, head: 'a'.repeat(40), tree: 'b'.repeat(40) },
    documentSame: true,
    teardown: 'passed',
    deltas,
    rounds: [0, 1].map((index) => ({
      index,
      initial: {
        demo: { view: { ...view } },
        state: { visible: { cards: 24, edges: 24 } },
      },
      validationBefore: { errors: [], elapsed: 0 },
      validationAfter: { errors: [], elapsed: 0 },
      steps: deltas.map((deltaY) => ({
        input: {
          isTrusted: true,
          deltaMode: 0,
          deltaX: 0,
          deltaY,
          clientX: 642,
          clientY: 523,
        },
        receivedAt: 8,
        inputToFrameMs: 3,
        inputToResultMs: 4,
        requested: { ...view },
        frames: [
          {
            view: { ...view },
            startedAt: 10,
            completedAt: 11,
            observedAt: 12,
            elapsed: 1,
            observationMs: 1,
            data: {
              uiView: { ...view },
              surface: {
                width: 1148,
                height: 914,
                bufferWidth: 1148,
                bufferHeight: 914,
                dpr: 1,
              },
              visibleIds: ['node-1', 'edge-1'],
              native: {
                bufferCreates: 2,
                bufferDeletes: 2,
                bufferAllocations: 2,
                drawcalls: 1,
                indices: 15,
                arrayVertices: 4,
                bufferUploads: 2,
                bufferBytes: 64,
                uniformUploads: 1,
                uniformBytes: 16,
              },
              state: {
                visible: { cards: 1, edges: 1, other: 1 },
                allocatedBufferBytes: 64,
                resources: [{ side: 'offscreen', live: { Buffer: 2 } }],
              },
            },
          },
        ],
      })),
    })),
  };
};
