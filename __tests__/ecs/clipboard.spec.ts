import { File as NodeFile } from 'node:buffer';
import { JSDOM } from 'jsdom';
import {
  MIME_TYPES,
  copyTextToClipboard,
  createPasteEvent,
  isSupportedImageFileType,
  parseClipboard,
  readSystemClipboard,
} from '../../packages/ecs/src/utils/clipboard';

const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);
const originalFile = Object.getOwnPropertyDescriptor(globalThis, 'File');
const originalDOMParser = Object.getOwnPropertyDescriptor(
  globalThis,
  'DOMParser',
);
const originalHTMLImageElement = Object.getOwnPropertyDescriptor(
  globalThis,
  'HTMLImageElement',
);
const originalDocument = Object.getOwnPropertyDescriptor(
  globalThis,
  'document',
);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDataTransfer = Object.getOwnPropertyDescriptor(
  globalThis,
  'DataTransfer',
);
const originalClipboardEvent = Object.getOwnPropertyDescriptor(
  globalThis,
  'ClipboardEvent',
);
const dom = new JSDOM('');

const setClipboard = (clipboard: Record<string, unknown>) => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard },
  });
};

const pasteEvent = (text: string, html = '') =>
  ({
    clipboardData: {
      getData: (type: string) =>
        type === MIME_TYPES.text ? text : type === MIME_TYPES.html ? html : '',
    },
  } as ClipboardEvent);

beforeAll(() => {
  Object.defineProperty(globalThis, 'File', {
    configurable: true,
    value: NodeFile,
  });
  Object.defineProperty(globalThis, 'DOMParser', {
    configurable: true,
    value: dom.window.DOMParser,
  });
  Object.defineProperty(globalThis, 'HTMLImageElement', {
    configurable: true,
    value: dom.window.HTMLImageElement,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalNavigator)
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
  for (const [key, descriptor] of [
    ['document', originalDocument],
    ['window', originalWindow],
    ['DataTransfer', originalDataTransfer],
    ['ClipboardEvent', originalClipboardEvent],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

afterAll(() => {
  for (const [key, descriptor] of [
    ['File', originalFile],
    ['DOMParser', originalDOMParser],
    ['HTMLImageElement', originalHTMLImageElement],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  dom.window.close();
});

describe('system clipboard reading', () => {
  it('returns no data when the browser has no clipboard API', async () => {
    setClipboard({});
    await expect(readSystemClipboard()).resolves.toEqual({});
  });

  it('reads plain text when the browser has no read() method', async () => {
    const readText = jest.fn().mockResolvedValue('hello');
    setClipboard({ readText });

    await expect(readSystemClipboard()).resolves.toEqual({
      [MIME_TYPES.text]: 'hello',
    });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it('falls back to text when read() is rejected', async () => {
    const readText = jest.fn().mockResolvedValue('fallback');
    setClipboard({
      read: jest.fn().mockRejectedValue(new Error('no read')),
      readText,
    });

    await expect(readSystemClipboard()).resolves.toEqual({
      [MIME_TYPES.text]: 'fallback',
    });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it('preserves text, HTML and images while skipping unsupported or unreadable items', async () => {
    const image = new Blob(['image bytes'], { type: MIME_TYPES.png });
    const readText = jest.fn();
    setClipboard({
      readText,
      read: jest.fn().mockResolvedValue([
        {
          types: [
            MIME_TYPES.text,
            MIME_TYPES.html,
            MIME_TYPES.png,
            MIME_TYPES.json,
          ],
          getType: async (type: string) => {
            if (type === MIME_TYPES.text) return new Blob(['hello']);
            if (type === MIME_TYPES.html) return new Blob(['<b>hello</b>']);
            return image;
          },
        },
        {
          types: [MIME_TYPES.gif],
          getType: async () => {
            throw new Error('image unavailable');
          },
        },
      ]),
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await readSystemClipboard();
    expect(result[MIME_TYPES.text]).toBe('hello');
    expect(result[MIME_TYPES.html]).toBe('<b>hello</b>');
    expect(result[MIME_TYPES.png]).toBeInstanceOf(NodeFile);
    expect((result[MIME_TYPES.png] as File).type).toBe(MIME_TYPES.png);
    expect(Object.keys(result)).toHaveLength(3);
    expect(readText).not.toHaveBeenCalled();
  });

  it('returns an empty clipboard when read() has no items', async () => {
    setClipboard({ read: jest.fn().mockResolvedValue([]) });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(readSystemClipboard()).resolves.toEqual({});
  });

  it('does not hide a permission error when both APIs reject', async () => {
    const denied = new Error('not focused');
    setClipboard({
      read: jest.fn().mockRejectedValue(denied),
      readText: jest.fn().mockRejectedValue(denied),
    });
    await expect(readSystemClipboard()).rejects.toThrow('not focused');
  });

  it('treats an empty readText result as an empty clipboard', async () => {
    setClipboard({ readText: jest.fn().mockResolvedValue('') });
    await expect(readSystemClipboard()).resolves.toEqual({});
  });

  it('treats a DataError during read() as an empty clipboard', async () => {
    setClipboard({
      read: jest.fn().mockRejectedValue({ name: 'DataError' }),
    });
    await expect(readSystemClipboard()).resolves.toEqual({});
  });

  it('treats a DataError during fallback readText() as empty', async () => {
    setClipboard({
      read: jest.fn().mockRejectedValue(new Error('read failed')),
      readText: jest.fn().mockRejectedValue({ name: 'DataError' }),
    });
    await expect(readSystemClipboard()).resolves.toEqual({});
  });
});

describe('clipboard writing', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: dom.window.document,
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: dom.window,
    });
  });

  it('uses a Clipboard API made available after the module was imported', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await copyTextToClipboard('hello');

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(dom.window.document.querySelector('textarea')).toBeNull();
  });

  it('falls back to an event when the async API rejects', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('not focused'));
    setClipboard({ writeText });
    const data = new Map<string, string>();
    const clipboardEvent = {
      clipboardData: {
        setData: (type: string, value: string) => data.set(type, value),
        getData: (type: string) => data.get(type),
      },
    } as unknown as ClipboardEvent;
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await copyTextToClipboard('from event', clipboardEvent);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(data.get(MIME_TYPES.text)).toBe('from event');
  });

  it('uses execCommand when event data cannot be written, then removes the textarea', async () => {
    setClipboard({});
    const execCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(dom.window.document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    const clipboardEvent = {
      clipboardData: { setData: () => {}, getData: () => 'stale' },
    } as unknown as ClipboardEvent;
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await copyTextToClipboard('fresh', clipboardEvent);

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(dom.window.document.querySelector('textarea')).toBeNull();
  });

  it('copies a space for empty text through execCommand and reports failure', async () => {
    setClipboard({});
    const execCommand = jest.fn().mockImplementation(() => {
      expect(dom.window.document.querySelector('textarea')?.value).toBe(' ');
      return false;
    });
    Object.defineProperty(dom.window.document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    await expect(copyTextToClipboard('')).rejects.toThrow(
      'Error copying to clipboard.',
    );
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(dom.window.document.querySelector('textarea')).toBeNull();
  });

  it('reports an execCommand exception and still removes the textarea', async () => {
    setClipboard({});
    Object.defineProperty(dom.window.document, 'execCommand', {
      configurable: true,
      value: jest.fn().mockImplementation(() => {
        throw new Error('copy denied');
      }),
    });
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(copyTextToClipboard('hello')).rejects.toThrow(
      'Error copying to clipboard.',
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'copy denied',
      }),
    );
    expect(dom.window.document.querySelector('textarea')).toBeNull();
  });
});

describe('synthetic paste events', () => {
  class FakeDataTransfer {
    readonly files: File[] = [];
    readonly items = { add: (file: File) => this.files.push(file) };
    readonly data = new Map<string, string>();
    setData(type: string, value: string) {
      this.data.set(type, value);
    }
    getData(type: string) {
      return this.data.get(type) ?? '';
    }
  }

  class FakeClipboardEvent {
    readonly clipboardData: FakeDataTransfer;
    constructor(_type: string, init: { clipboardData: FakeDataTransfer }) {
      this.clipboardData = init.clipboardData;
    }
  }

  beforeEach(() => {
    Object.defineProperty(globalThis, 'DataTransfer', {
      configurable: true,
      value: FakeDataTransfer,
    });
    Object.defineProperty(globalThis, 'ClipboardEvent', {
      configurable: true,
      value: FakeClipboardEvent,
    });
  });

  it('keeps the supplied file array intact while adding image types', () => {
    const existing = new dom.window.File(['one'], 'one.png', {
      type: MIME_TYPES.png,
    });
    const added = new dom.window.File(['two'], 'two.gif', {
      type: MIME_TYPES.gif,
    });
    const files = [existing];

    const event = createPasteEvent({
      types: { [MIME_TYPES.text]: 'hello', [MIME_TYPES.gif]: added },
      files,
    });

    expect(files).toEqual([existing]);
    expect(event.clipboardData?.getData(MIME_TYPES.text)).toBe('hello');
    expect(Array.from(event.clipboardData?.files ?? [])).toEqual([
      existing,
      added,
    ]);
  });

  it('reports when a browser fails to store pasted text', () => {
    jest.spyOn(FakeDataTransfer.prototype, 'getData').mockReturnValue('');
    expect(() =>
      createPasteEvent({ types: { [MIME_TYPES.text]: 'hello' } }),
    ).toThrow('Failed to set "text/plain" as clipboardData item');
  });

  it('recognizes only supported image MIME types', () => {
    expect(isSupportedImageFileType(MIME_TYPES.avif)).toBe(true);
    expect(isSupportedImageFileType(MIME_TYPES.json)).toBe(false);
    expect(isSupportedImageFileType(null)).toBe(false);
  });
});

describe('clipboard paste parsing', () => {
  it('recognizes copied shapes and retains their serialized data', async () => {
    const nodes = [{ id: 'rect-1', type: 'rect', zIndex: 1, x: 4, y: 8 }];
    await expect(
      parseClipboard(pasteEvent(JSON.stringify(nodes))),
    ).resolves.toEqual({
      elements: nodes,
    });
  });

  it('keeps malformed JSON arrays as text instead of treating them as shapes', async () => {
    for (const text of ['[1]', '[{"foo":1}]', '[{"id":"x"}]']) {
      await expect(parseClipboard(pasteEvent(text))).resolves.toEqual({ text });
    }
  });

  it('prefers HTML unless plain paste was requested', async () => {
    const event = pasteEvent('plain', '<p>rich <b>text</b></p>');
    await expect(parseClipboard(event)).resolves.toEqual({
      html: '<p>rich <b>text</b></p>',
    });
    await expect(parseClipboard(event, true)).resolves.toEqual({
      text: 'plain',
    });
  });

  it('falls back to trimmed text when HTML has no pasteable content', async () => {
    await expect(
      parseClipboard(pasteEvent('  plain  ', '<img src="/relative.png">')),
    ).resolves.toEqual({
      text: 'plain',
    });
  });

  it('keeps HTML containing an absolute image URL', async () => {
    const html = '<section><img src="https://example.com/image.png"></section>';
    await expect(parseClipboard(pasteEvent('alt text', html))).resolves.toEqual(
      {
        html,
      },
    );
  });

  it('returns empty text when reading clipboard data throws', async () => {
    const event = {
      clipboardData: {
        getData: () => {
          throw new Error('unavailable');
        },
      },
    } as unknown as ClipboardEvent;
    await expect(parseClipboard(event)).resolves.toEqual({ text: '' });
  });
});
