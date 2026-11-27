export const makeContinuousGesture = (deltaY = -20, count = 2) => {
  const initial = { x: 0, y: 0, zoom: 0.03 },
    surface = {
      width: 800,
      height: 600,
      bufferWidth: 800,
      bufferHeight: 600,
      dpr: 1,
    };
  let target = { ...initial };
  const events = Array.from({ length: count }, (_, i) => 10 + i * 10).map(
    (receivedAt, i) => {
      const zoom = target.zoom * Math.exp(-deltaY * 0.0025);
      target = {
        x: target.x + 50 / target.zoom - 50 / zoom,
        y: target.y + 60 / target.zoom - 60 / zoom,
        zoom,
      };
      return {
        sequence: i + 1,
        receivedAt,
        input: {
          isTrusted: true,
          deltaX: 0,
          deltaY,
          deltaMode: 0,
          clientX: 100,
          clientY: 100,
        },
        requested: { ...target },
      };
    },
  );
  const native = {
    bufferCreates: 0,
    bufferDeletes: 0,
    bufferAllocations: 0,
    bufferUploads: 1,
    bufferBytes: 64,
    uniformUploads: 1,
    uniformBytes: 64,
    drawcalls: 2,
    indices: 30,
    arrayVertices: 4,
  };
  const frames = events.map((e, i) => ({
    startedAt: e.receivedAt + 2,
    completedAt: e.receivedAt + 4 + i,
    elapsed: 2 + i,
    observedAt: e.receivedAt + 5 + i,
    observationMs: 1,
    view: {
      x: Math.fround(e.requested.x),
      y: Math.fround(e.requested.y),
      zoom: e.requested.zoom,
    },
    native: { ...native },
  }));
  const state = {
    visible: { cards: 24, edges: 24, other: 0 },
    allocatedBufferBytes: 64,
  };
  return {
    round: 0,
    direction: deltaY < 0 ? 'in' : 'out',
    deltaY,
    commandCount: count,
    cadenceMs: 16,
    anchor: { clientX: 100, clientY: 100, viewportX: 50, viewportY: 60 },
    initial: { view: { ...initial }, surface, state },
    commands: Array.from({ length: count }, (_, i) => i).map((i) => ({
      sequence: i + 1,
      scheduledAfterMs: i * 16,
      dispatchedAfterMs: i * 16,
      acknowledgedAfterMs: i * 16 + 1,
    })),
    stream: {
      initial,
      events,
      frames,
      final: { uiView: target, surface: { ...surface }, state },
    },
    validationBefore: { errors: [], elapsed: 0 },
    validationAfter: { errors: [], elapsed: 0 },
  };
};
