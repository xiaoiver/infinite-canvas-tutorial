import { File as NodeFile } from 'node:buffer';
import { JSDOM } from 'jsdom';
import {
  MIME_TYPES,
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
});
