import {
  AnimationGifQuality,
  encodeGifFromCanvas,
  maxColorsForAnimationGifQuality,
  pickWebmMimeType,
  recordWebMFromCanvas,
} from '../../packages/ecs/src/utils/animationExportCodec';

const mockGif = {
  writeFrame: jest.fn(),
  finish: jest.fn(),
  bytes: jest.fn(() => new Uint8Array([71, 73, 70])),
};
const mockQuantize = jest.fn<number[][], unknown[]>(() => [[255, 0, 0]]);
const mockApplyPalette = jest.fn<Uint8Array, unknown[]>(
  () => new Uint8Array([0]),
);
jest.mock('../../packages/ecs/node_modules/gifenc', () => ({
  GIFEncoder: () => mockGif,
  quantize: (...args: unknown[]) => mockQuantize(...args),
  applyPalette: (...args: unknown[]) => mockApplyPalette(...args),
}));

const globals = [
  'document',
  'Image',
  'MediaRecorder',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const;
const descriptors = globals.map((key) =>
  Object.getOwnPropertyDescriptor(globalThis, key),
);
let events: string[];
let source: HTMLCanvasElement;
let scratch: HTMLCanvasElement;
let context: {
  canvas?: HTMLCanvasElement;
  clearRect: jest.Mock;
  drawImage: jest.Mock;
  getImageData: jest.Mock;
};
let tracks: { requestFrame: jest.Mock; stop: jest.Mock }[];
let stream: MediaStream;
let recorders: TestRecorder[];
let images: TestImage[];
let loadImage: (image: TestImage) => void;
let recorderCreated: (recorder: TestRecorder) => void;

class TestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    images.push(this);
  }
  set src(_value: string) {
    loadImage(this);
  }
}

class TestRecorder {
  static isTypeSupported = jest.fn(() => true);
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;
  start = jest.fn(() => {
    this.state = 'recording';
  });
  stop = jest.fn(() => {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['recorded']) });
      this.onstop?.();
    });
  });
  constructor() {
    recorders.push(this);
    recorderCreated(this);
  }
}

beforeEach(() => {
  jest.resetAllMocks();
  TestRecorder.isTypeSupported.mockReturnValue(true);
  mockGif.bytes.mockReturnValue(new Uint8Array([71, 73, 70]));
  mockQuantize.mockReturnValue([[255, 0, 0]]);
  mockApplyPalette.mockReturnValue(new Uint8Array([0]));
  events = [];
  recorders = [];
  images = [];
  recorderCreated = () => {};
  loadImage = (image) => queueMicrotask(() => image.onload?.());
  source = {
    width: 2,
    height: 2,
    toDataURL: jest.fn(() => {
      events.push('snapshot');
      return 'data:image/png;base64,png';
    }),
  } as unknown as HTMLCanvasElement;
  context = {
    clearRect: jest.fn(),
    drawImage: jest.fn(),
    getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(16) })),
  };
  tracks = Array.from({ length: 2 }, () => ({
    requestFrame: jest.fn(),
    stop: jest.fn(),
  }));
  stream = {
    getVideoTracks: () => [tracks[0]],
    getTracks: () => tracks,
  } as unknown as MediaStream;
  scratch = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => context),
    captureStream: jest.fn(() => stream),
  } as unknown as HTMLCanvasElement;
  context.canvas = scratch;
  let frameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  Object.assign(globalThis, {
    document: { createElement: jest.fn(() => scratch) },
    Image: TestImage,
    MediaRecorder: TestRecorder,
    requestAnimationFrame: jest.fn((callback: FrameRequestCallback) => {
      const id = ++frameId;
      frames.set(id, callback);
      queueMicrotask(() => {
        const next = frames.get(id);
        if (next) {
          frames.delete(id);
          events.push('paint');
          next(id * 16);
        }
      });
      return id;
    }),
    cancelAnimationFrame: jest.fn((id: number) => frames.delete(id)),
  });
});
afterEach(() => {
  globals.forEach((key, i) => {
    if (descriptors[i]) Object.defineProperty(globalThis, key, descriptors[i]!);
    else Reflect.deleteProperty(globalThis, key);
  });
});

it('stops every capture track after a successful WebM export', async () => {
  const render = jest.fn();
  const blob = await recordWebMFromCanvas(() => source, 2, render);
  expect(blob.type).toBe('video/webm');
  expect(await blob.text()).toBe('recorded');
  for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1);
  expect(recorders[0].state).toBe('inactive');
});

it('stops recording and tracks when rendering a later frame throws', async () => {
  const error = new Error('render failed');
  await expect(
    recordWebMFromCanvas(
      () => source,
      3,
      (i) => {
        if (i === 1) throw error;
      },
    ),
  ).rejects.toBe(error);
  expect(recorders[0].state).toBe('inactive');
  for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1);
});

it('rejects GIF size changes instead of writing frames outside its logical screen', async () => {
  await expect(
    encodeGifFromCanvas(
      () => source,
      2,
      30,
      (i) => {
        if (i === 1) source.width = 4;
      },
    ),
  ).rejects.toThrow('size changed');
});

it('waits for presentation before taking each GIF snapshot', async () => {
  await encodeGifFromCanvas(
    () => source,
    2,
    30,
    () => events.push('render'),
  );
  expect(events).toEqual([
    'render',
    'paint',
    'snapshot',
    'render',
    'paint',
    'snapshot',
  ]);
});

const exporters = {
  GIF: (count: number, render = jest.fn(), get = () => source) =>
    encodeGifFromCanvas(get, count, 30, render),
  WebM: (count: number, render = jest.fn(), get = () => source) =>
    recordWebMFromCanvas(get, count, render),
};

function expectReleased() {
  expect(scratch.width).toBe(0);
  expect(scratch.height).toBe(0);
  expect(source.width).toBe(2);
  expect(source.height).toBe(2);
  for (const image of images) {
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
  }
  for (const recorder of recorders) {
    expect(recorder.ondataavailable).toBeNull();
    expect(recorder.onerror).toBeNull();
    expect(recorder.onstop).toBeNull();
  }
}

it.each([
  [undefined, 256],
  ['high', 256],
  ['medium', 128],
  ['low', 64],
  ['unknown', 256],
])('maps GIF quality %s to %s colors', (quality, colors) => {
  expect(maxColorsForAnimationGifQuality(quality as AnimationGifQuality)).toBe(
    colors,
  );
});

it.each([
  ['video/webm;codecs=vp9', 1],
  ['video/webm;codecs=vp8', 2],
  ['video/webm', 3],
  [null, 3],
])('negotiates WebM support: %s', (supported, calls) => {
  TestRecorder.isTypeSupported.mockImplementation(
    (mime?: string) => mime === supported,
  );
  expect(pickWebmMimeType()).toBe(supported);
  expect(TestRecorder.isTypeSupported).toHaveBeenCalledTimes(calls as number);
});

it('rejects WebM without MediaRecorder before rendering', async () => {
  Reflect.deleteProperty(globalThis, 'MediaRecorder');
  const render = jest.fn();
  expect(pickWebmMimeType()).toBeNull();
  await expect(exporters.WebM(1, render)).rejects.toThrow('not supported');
  expect(render).not.toHaveBeenCalled();
});

it.each(Object.entries(exporters))(
  '%s releases its scratch canvas on success',
  async (_format, exportFrames) => {
    await exportFrames(2);
    expectReleased();
  },
);

describe.each(Object.entries(exporters))(
  '%s failures',
  (_format, exportFrames) => {
    it.each([0, -1, 1.5, NaN, Infinity])(
      'rejects invalid frame count %s before allocating resources',
      async (count) => {
        const render = jest.fn();
        await expect(exportFrames(count, render)).rejects.toThrow(
          'positive integer',
        );
        expect(render).not.toHaveBeenCalled();
        expect(document.createElement).not.toHaveBeenCalled();
      },
    );

    it.each(['width', 'height'] as const)(
      'rejects an empty %s',
      async (dimension) => {
        source[dimension] = 0;
        await expect(exportFrames(1)).rejects.toThrow('canvas is empty');
        expect(scratch.width).toBe(0);
        expect(scratch.height).toBe(0);
      },
    );

    it('rejects an unavailable 2D context', async () => {
      (scratch.getContext as jest.Mock).mockReturnValue(null);
      await expect(exportFrames(1)).rejects.toThrow(
        '2D context is unavailable',
      );
      expectReleased();
    });

    it.each(['render', 'canvas', 'snapshot', 'image source', 'draw'] as const)(
      'preserves a %s exception and supports retry',
      async (stage) => {
        const failure = new Error(`${stage} failed`);
        const fail = jest.fn(() => {
          throw failure;
        });
        const render = stage === 'render' ? fail : jest.fn();
        const get = stage === 'canvas' ? fail : () => source;
        if (stage === 'snapshot')
          (source.toDataURL as jest.Mock).mockImplementationOnce(fail);
        if (stage === 'image source') loadImage = fail;
        if (stage === 'draw') context.drawImage.mockImplementationOnce(fail);
        await expect(exportFrames(1, render, get)).rejects.toBe(failure);
        expectReleased();
        loadImage = (image) => queueMicrotask(() => image.onload?.());
        await expect(exportFrames(1)).resolves.toBeInstanceOf(Blob);
        expectReleased();
      },
    );

    it('rejects a PNG decode failure and removes image handlers', async () => {
      loadImage = (image) => queueMicrotask(() => image.onerror?.());
      await expect(exportFrames(1)).rejects.toThrow('PNG decode failed');
      expectReleased();
    });

    it.each(['width', 'height'] as const)(
      'rejects a later %s change',
      async (dimension) => {
        const render = jest.fn((i: number) => {
          if (i === 1) source[dimension] = 4;
        });
        await expect(exportFrames(2, render)).rejects.toThrow('size changed');
        expect(render.mock.calls.map(([i]) => i)).toEqual([0, 1]);
        expect(scratch.width).toBe(0);
        expect(scratch.height).toBe(0);
        if (_format === 'WebM') {
          for (const track of tracks)
            expect(track.stop).toHaveBeenCalledTimes(1);
          expect(recorders[0].state).toBe('inactive');
        }
      },
    );
  },
);

it.each([
  'missing track',
  'missing requestFrame',
  'capture',
  'constructor',
  'start',
  'requestFrame',
  'stop',
])('cleans up when WebM fails at %s', async (stage) => {
  const failure = new Error(stage);
  const fail = () => {
    throw failure;
  };
  if (stage === 'missing track') stream.getVideoTracks = () => [];
  if (stage === 'missing requestFrame')
    Reflect.deleteProperty(tracks[0], 'requestFrame');
  if (stage === 'capture')
    (scratch.captureStream as jest.Mock).mockImplementation(fail);
  if (stage === 'constructor') recorderCreated = fail;
  if (stage === 'requestFrame') tracks[0].requestFrame.mockImplementation(fail);
  if (stage === 'start' || stage === 'stop') {
    recorderCreated = (recorder) => recorder[stage].mockImplementation(fail);
  }
  const result = exporters.WebM(2);
  if (stage.startsWith('missing'))
    await expect(result).rejects.toThrow('requestFrame');
  else await expect(result).rejects.toBe(failure);
  for (const track of tracks) {
    expect(track.stop).toHaveBeenCalledTimes(stage === 'capture' ? 0 : 1);
  }
  expectReleased();
});

it('keeps the original failure and releases other tracks if stop throws', async () => {
  const failure = new Error('render failed');
  tracks[0].stop.mockImplementation(() => {
    throw new Error('track stop');
  });
  recorderCreated = (recorder) =>
    recorder.stop.mockImplementation(() => {
      throw new Error('recorder stop');
    });
  const render = jest.fn((i: number) => {
    if (i === 1) throw failure;
  });
  await expect(exporters.WebM(2, render)).rejects.toBe(failure);
  expect(tracks[1].stop).toHaveBeenCalledTimes(1);
  expectReleased();
});

it('keeps nonempty chunks in order, including the final stop chunk', async () => {
  recorderCreated = (recorder) =>
    recorder.start.mockImplementation(() => {
      recorder.state = 'recording';
      recorder.ondataavailable?.({ data: new Blob() });
      recorder.ondataavailable?.({ data: new Blob(['first:']) });
    });
  expect(await (await exporters.WebM(1)).text()).toBe('first:recorded');
  expect(tracks[0].requestFrame).toHaveBeenCalledTimes(1);
});

it('rejects an empty recording', async () => {
  recorderCreated = (recorder) =>
    recorder.stop.mockImplementation(() => {
      recorder.state = 'inactive';
      queueMicrotask(() => {
        recorder.ondataavailable?.({ data: new Blob() });
        recorder.onstop?.();
      });
    });
  await expect(exporters.WebM(1)).rejects.toThrow('produced no data');
  expectReleased();
});

it.each(['error', 'stop'] as const)(
  'aborts pending presentation on recorder %s',
  async (event) => {
    const render = jest.fn((i: number) => {
      if (i === 1)
        queueMicrotask(() => {
          const recorder = recorders[0];
          if (event === 'stop') recorder.state = 'inactive';
          recorder[event === 'stop' ? 'onstop' : 'onerror']?.();
        });
    });
    await expect(exporters.WebM(4, render)).rejects.toThrow(
      event === 'stop' ? 'before all frames' : 'MediaRecorder error',
    );
    expect(render.mock.calls.map(([i]) => i)).toEqual([0, 1]);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expectReleased();
  },
);

it('aborts a pending decode and ignores late image/recorder events', async () => {
  let lateLoad: (() => void) | null = null;
  loadImage = (image) => {
    if (images.length === 1) queueMicrotask(() => image.onload?.());
    else {
      lateLoad = image.onload;
      const lateError = recorders[0].onerror;
      recorders[0].onerror?.();
      queueMicrotask(() => {
        lateLoad?.();
        lateError?.();
      });
    }
  };
  await expect(exporters.WebM(4)).rejects.toThrow('MediaRecorder error');
  expect(context.drawImage).toHaveBeenCalledTimes(1);
  expect(tracks[0].requestFrame).toHaveBeenCalledTimes(1);
  expectReleased();
});

it('does not upload a decoded frame after an error in the same task', async () => {
  loadImage = (image) =>
    queueMicrotask(() => {
      image.onload?.();
      if (images.length === 2) recorders[0].onerror?.();
    });
  await expect(exporters.WebM(3)).rejects.toThrow('MediaRecorder error');
  expect(context.drawImage).toHaveBeenCalledTimes(1);
  expectReleased();
});

it('does not render more frames after a synchronous start error event', async () => {
  recorderCreated = (recorder) =>
    recorder.start.mockImplementation(() => {
      recorder.state = 'recording';
      recorder.onerror?.();
    });
  const render = jest.fn();
  await expect(exporters.WebM(3, render)).rejects.toThrow(
    'MediaRecorder error',
  );
  expect(render).toHaveBeenCalledTimes(1);
  expect(tracks[0].requestFrame).not.toHaveBeenCalled();
  expectReleased();
});

it.each([
  [30, 256, 33, 256],
  [0, -10, 1000, 2],
  [10, 128.9, 100, 128],
  [2000, 300, 1, 256],
])(
  'encodes GIF at fps=%s and color cap=%s',
  async (fps, colors, delay, cap) => {
    const blob = await encodeGifFromCanvas(
      () => source,
      2,
      fps,
      jest.fn(),
      0.7,
      colors,
    );
    expect(blob.type).toBe('image/gif');
    expect(await blob.text()).toBe('GIF');
    expect(mockQuantize).toHaveBeenCalledWith(
      expect.any(Uint8ClampedArray),
      cap,
    );
    expect(mockGif.writeFrame).toHaveBeenCalledTimes(2);
    expect(mockGif.writeFrame).toHaveBeenCalledWith(new Uint8Array([0]), 2, 2, {
      palette: [[255, 0, 0]],
      delay,
    });
    expect(source.toDataURL).toHaveBeenCalledWith('image/png', 0.7);
    expect(mockGif.finish).toHaveBeenCalledTimes(1);
  },
);

it.each([
  [NaN, 256],
  [Infinity, 256],
  [30, NaN],
  [30, Infinity],
])('rejects nonfinite GIF settings: fps=%s, colors=%s', async (fps, colors) => {
  await expect(
    encodeGifFromCanvas(() => source, 1, fps, jest.fn(), 0.92, colors),
  ).rejects.toThrow('must be finite');
  expect(document.createElement).not.toHaveBeenCalled();
});

it.each(['pixels', 'quantize', 'palette', 'write', 'finish', 'bytes'])(
  'releases the GIF canvas when %s fails',
  async (stage) => {
    const failure = new Error(stage);
    const operation = {
      pixels: context.getImageData,
      quantize: mockQuantize,
      palette: mockApplyPalette,
      write: mockGif.writeFrame,
      finish: mockGif.finish,
      bytes: mockGif.bytes,
    }[stage]!;
    operation.mockImplementation(() => {
      throw failure;
    });
    await expect(exporters.GIF(1)).rejects.toBe(failure);
    expectReleased();
  },
);
