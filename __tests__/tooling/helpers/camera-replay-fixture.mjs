import { cameraTraceHash } from '../../../scripts/camera-replay-tools.mjs';
export const makeCameraReplayCapture = () => {
  const trace = [{ id: 'one', x: 0, y: 0, zoom: 1 }],
    viewport = { width: 800, height: 600, dpr: 1 };
  return {
    schema: 1,
    workload: 'strokes',
    source: { dirty: false, head: 'a'.repeat(40), tree: 'b'.repeat(40) },
    browser: 'test',
    node: 'test',
    trace,
    viewport,
    traceHash: cameraTraceHash('strokes', trace, viewport),
    results: [
      {
        backend: 'core',
        mode: 'scoped',
        documentSame: true,
        teardown: 'passed',
        rounds: [
          {
            index: 0,
            steps: [
              {
                id: 'one',
                requested: { x: 0, y: 0, zoom: 1 },
                operationToFrameMs: 3,
                frames: [
                  {
                    view: { x: 0, y: 0, zoom: 1 },
                    elapsed: 2,
                    completedAt: 10,
                    data: {
                      surface: {
                        width: 800,
                        height: 600,
                        bufferWidth: 800,
                        bufferHeight: 600,
                        dpr: 1,
                      },
                      visibleIndices: [0, 1],
                      native: { drawcalls: 2, indices: 30, arrayVertices: 4 },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
};
