import {
  parseFigmaFileToSerializedNodes,
  figmaDocumentToSerializedNodes,
  figmaColorToHex,
  serializedNodesToFigmaScene,
  hexToFigmaColor,
  parseFigmaFileKey,
  parseFigFileToSerializedNodes,
  FigmaRestClient,
} from '../../packages/plugin-figma/src';
import type {
  FigmaFileResponse,
  FigmaTransform,
} from '../../packages/plugin-figma/src';
import { figDocumentToFigmaFileResponse } from '../../packages/plugin-figma/src/fig-to-figma';
import { createEmptyFigDoc } from 'openfig-core';
import { readFileSync } from 'fs';
import { join } from 'path';

const SAMPLE_FILE: FigmaFileResponse = {
  name: 'Sample',
  document: {
    id: '0:0',
    type: 'DOCUMENT',
    children: [
      {
        id: '0:1',
        type: 'CANVAS',
        name: 'Page 1',
        children: [
          {
            id: '1:2',
            type: 'FRAME',
            name: 'Frame',
            clipsContent: true,
            absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 100 },
            size: { x: 200, y: 100 },
            children: [
              {
                id: '1:3',
                type: 'RECTANGLE',
                name: 'Box',
                absoluteBoundingBox: { x: 10, y: 20, width: 80, height: 40 },
                size: { x: 80, y: 40 },
                cornerRadius: 8,
                opacity: 0.5,
                fills: [
                  {
                    type: 'SOLID',
                    color: { r: 1, g: 0, b: 0, a: 1 },
                  },
                ],
                strokes: [
                  {
                    type: 'SOLID',
                    color: { r: 0, g: 0, b: 1, a: 1 },
                  },
                ],
                strokeWeight: 2,
                strokeAlign: 'CENTER',
                effects: [
                  {
                    type: 'DROP_SHADOW',
                    color: { r: 0, g: 0, b: 0, a: 0.5 },
                    offset: { x: 2, y: 3 },
                    radius: 4,
                  },
                ],
              },
              {
                id: '1:4',
                type: 'ELLIPSE',
                name: 'Dot',
                absoluteBoundingBox: { x: 100, y: 20, width: 40, height: 40 },
                size: { x: 40, y: 40 },
                fills: [
                  { type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 } },
                ],
              },
              {
                id: '1:5',
                type: 'TEXT',
                name: 'Label',
                absoluteBoundingBox: { x: 10, y: 70, width: 120, height: 20 },
                size: { x: 120, y: 20 },
                characters: 'Hello',
                style: {
                  fontFamily: 'Inter',
                  fontSize: 16,
                  textAlignHorizontal: 'CENTER',
                },
                fills: [
                  { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

describe('figmaColorToHex', () => {
  it('converts 0–1 channels to #rrggbb', () => {
    expect(figmaColorToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe('#ff0000');
    expect(figmaColorToHex({ r: 0, g: 1, b: 0, a: 1 })).toBe('#00ff00');
    expect(figmaColorToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
  });
});

describe('hexToFigmaColor', () => {
  it('parses short, long and alpha hex', () => {
    expect(hexToFigmaColor('#f00')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(hexToFigmaColor('#00ff00')).toEqual({ r: 0, g: 1, b: 0, a: 1 });
    const withAlpha = hexToFigmaColor('#00000080');
    expect(withAlpha?.a).toBeCloseTo(0.5, 1);
  });

  it('returns undefined for invalid input', () => {
    expect(hexToFigmaColor('rgb(0,0,0)')).toBeUndefined();
  });
});

describe('parseFigmaFileKey', () => {
  it('extracts key from file/design URLs and passes through bare keys', () => {
    expect(parseFigmaFileKey('https://www.figma.com/file/ABC123/My-Design')).toBe(
      'ABC123',
    );
    expect(
      parseFigmaFileKey('https://www.figma.com/design/XYZ789/Foo?node-id=1'),
    ).toBe('XYZ789');
    expect(parseFigmaFileKey('ABC123')).toBe('ABC123');
  });
});

describe('figmaDocumentToSerializedNodes', () => {
  const nodes = figmaDocumentToSerializedNodes(SAMPLE_FILE);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  it('flattens pages and emits one node per supported figma node', () => {
    expect(byId.has('1:2')).toBe(true);
    expect(byId.has('1:3')).toBe(true);
    expect(byId.has('1:4')).toBe(true);
    expect(byId.has('1:5')).toBe(true);
  });

  it('maps FRAME → rect with clipMode', () => {
    const frame = byId.get('1:2') as any;
    expect(frame.type).toBe('rect');
    expect(frame.clipMode).toBe('clip');
    expect(frame.parentId).toBeUndefined();
  });

  it('maps RECTANGLE with geometry, corner radius, fills, strokes, shadow', () => {
    const rect = byId.get('1:3') as any;
    expect(rect.type).toBe('rect');
    expect(rect.parentId).toBe('1:2');
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(80);
    expect(rect.height).toBe(40);
    expect(rect.cornerRadius).toBe(8);
    expect(rect.opacity).toBe(0.5);
    expect(rect.fills[0]).toMatchObject({ type: 'solid', value: '#ff0000' });
    expect(rect.strokes[0]).toMatchObject({ type: 'solid', value: '#0000ff' });
    expect(rect.strokeWidth).toBe(2);
    expect(rect.strokeAlignment).toBe('center');
    expect(rect.dropShadowColor).toBe('#000000');
    expect(rect.dropShadowOffsetX).toBe(2);
    expect(rect.dropShadowBlurRadius).toBe(4);
  });

  it('maps ELLIPSE with cx/cy/rx/ry derived from size', () => {
    const ellipse = byId.get('1:4') as any;
    expect(ellipse.type).toBe('ellipse');
    expect(ellipse.cx).toBe(20);
    expect(ellipse.rx).toBe(20);
    expect(ellipse.ry).toBe(20);
  });

  it('maps TEXT content and style', () => {
    const text = byId.get('1:5') as any;
    expect(text.type).toBe('text');
    expect(text.content).toBe('Hello');
    expect(text.fontFamily).toBe('Inter');
    expect(text.fontSize).toBe(16);
    expect(text.textAlign).toBe('center');
  });
});

const AUTO_LAYOUT_FILE: FigmaFileResponse = {
  document: {
    id: '0:0',
    type: 'DOCUMENT',
    children: [
      {
        id: '0:1',
        type: 'CANVAS',
        children: [
          {
            id: '3:1',
            type: 'FRAME',
            name: 'Auto row',
            layoutMode: 'HORIZONTAL',
            primaryAxisAlignItems: 'SPACE_BETWEEN',
            counterAxisAlignItems: 'CENTER',
            primaryAxisSizingMode: 'FIXED',
            counterAxisSizingMode: 'AUTO',
            paddingTop: 8,
            paddingRight: 16,
            paddingBottom: 8,
            paddingLeft: 16,
            itemSpacing: 12,
            layoutWrap: 'WRAP',
            counterAxisSpacing: 4,
            absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 120 },
            size: { x: 300, y: 120 },
            children: [
              {
                id: '3:2',
                type: 'RECTANGLE',
                name: 'Grow',
                layoutGrow: 1,
                layoutAlign: 'STRETCH',
                absoluteBoundingBox: { x: 16, y: 8, width: 100, height: 40 },
                size: { x: 100, y: 40 },
                fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
              },
              {
                id: '3:3',
                type: 'RECTANGLE',
                name: 'Fixed',
                layoutPositioning: 'ABSOLUTE',
                absoluteBoundingBox: { x: 200, y: 20, width: 40, height: 40 },
                size: { x: 40, y: 40 },
                fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 } }],
              },
            ],
          },
          {
            id: '3:4',
            type: 'FRAME',
            name: 'Auto column hug',
            layoutMode: 'VERTICAL',
            primaryAxisAlignItems: 'MIN',
            counterAxisAlignItems: 'MAX',
            primaryAxisSizingMode: 'AUTO',
            counterAxisSizingMode: 'FIXED',
            itemSpacing: 10,
            absoluteBoundingBox: { x: 0, y: 200, width: 80, height: 150 },
            size: { x: 80, y: 150 },
            children: [
              {
                id: '3:5',
                type: 'RECTANGLE',
                name: 'Child',
                absoluteBoundingBox: { x: 0, y: 200, width: 40, height: 20 },
                size: { x: 40, y: 20 },
                fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 } }],
              },
            ],
          },
        ],
      },
    ],
  },
};

describe('figma auto-layout import', () => {
  const nodes = figmaDocumentToSerializedNodes(AUTO_LAYOUT_FILE);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  it('maps horizontal auto-layout frame to flex container', () => {
    const frame = byId.get('3:1') as any;
    expect(frame.type).toBe('rect');
    expect(frame.display).toBe('flex');
    expect(frame.flexDirection).toBe('row');
    expect(frame.justifyContent).toBe('space-between');
    expect(frame.alignItems).toBe('center');
    expect(frame.padding).toEqual([8, 16, 8, 16]);
    expect(frame.gap).toBe(12);
    expect(frame.rowGap).toBe(4);
    expect(frame.columnGap).toBe(12);
    expect(frame.flexWrap).toBe('wrap');
    expect(frame.flexHugWidth).toBe(false);
    expect(frame.flexHugHeight).toBe(true);
  });

  it('maps auto-layout child grow, stretch, and absolute positioning', () => {
    const growChild = byId.get('3:2') as any;
    expect(growChild.flexGrow).toBe(1);
    expect(growChild.alignSelf).toBe('stretch');

    const absoluteChild = byId.get('3:3') as any;
    expect(absoluteChild.position).toBe('absolute');
  });

  it('maps vertical auto-layout hug on primary axis', () => {
    const frame = byId.get('3:4') as any;
    expect(frame.flexDirection).toBe('column');
    expect(frame.justifyContent).toBe('flex-start');
    expect(frame.alignItems).toBe('flex-end');
    expect(frame.flexHugHeight).toBe(true);
    expect(frame.flexHugWidth).toBe(false);
    expect(frame.gap).toBe(10);
  });
});

describe('parseFigmaFileToSerializedNodes', () => {
  it('produces a valid ICDocumentV1 envelope', () => {
    const doc = parseFigmaFileToSerializedNodes(SAMPLE_FILE);
    expect(doc.type).toBe('infinite-canvas');
    expect(doc.version).toBe(1);
    expect(Array.isArray(doc.elements)).toBe(true);
    expect(doc.elements.length).toBe(4);
    expect(doc.variables).toEqual({});
  });
});

describe('image fills', () => {
  it('resolves imageRef via imageRefUrls', () => {
    const file: FigmaFileResponse = {
      document: {
        id: '0:0',
        type: 'DOCUMENT',
        children: [
          {
            id: '0:1',
            type: 'CANVAS',
            children: [
              {
                id: '2:1',
                type: 'RECTANGLE',
                absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
                size: { x: 10, y: 10 },
                fills: [{ type: 'IMAGE', imageRef: 'abc', scaleMode: 'FILL' }],
              },
            ],
          },
        ],
      },
    };
    const nodes = figmaDocumentToSerializedNodes(file, {
      imageRefUrls: { abc: 'https://example.com/a.png' },
    });
    const rect = nodes[0] as any;
    expect(rect.fills[0]).toMatchObject({
      type: 'image',
      value: 'https://example.com/a.png',
      objectFit: 'cover',
    });
  });
});

describe('rotation from relativeTransform', () => {
  function rectWithTransform(transform: FigmaTransform) {
    const file: FigmaFileResponse = {
      document: {
        id: '0:0',
        type: 'DOCUMENT',
        children: [
          {
            id: '0:1',
            type: 'CANVAS',
            children: [
              {
                id: '3:1',
                type: 'RECTANGLE',
                absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
                size: { x: 10, y: 10 },
                relativeTransform: transform,
              },
            ],
          },
        ],
      },
    };
    return figmaDocumentToSerializedNodes(file)[0] as any;
  }

  it('maps a +90° rotation to PI/2 radians', () => {
    // [[cos, -sin, tx], [sin, cos, ty]] for +90°
    const r = rectWithTransform([
      [0, -1, 0],
      [1, 0, 0],
    ]);
    expect(r.rotation).toBeCloseTo(Math.PI / 2, 6);
  });

  it('normalizes a 180° rotation into (-PI, PI]', () => {
    const r = rectWithTransform([
      [-1, 0, 0],
      [0, -1, 0],
    ]);
    expect(r.rotation).toBeCloseTo(Math.PI, 6);
  });

  it('maps a -45° rotation to a negative angle', () => {
    const c = Math.SQRT1_2;
    const r = rectWithTransform([
      [c, c, 0],
      [-c, c, 0],
    ]);
    expect(r.rotation).toBeCloseTo(-Math.PI / 4, 6);
  });

  it('omits rotation for an identity transform', () => {
    const r = rectWithTransform([
      [1, 0, 0],
      [0, 1, 0],
    ]);
    expect(r.rotation).toBeUndefined();
  });
});

describe('parseFigFileToSerializedNodes', () => {
  it('converts an empty openfig document envelope', () => {
    const figDoc = createEmptyFigDoc();
    const file = figDocumentToFigmaFileResponse(figDoc);
    const doc = parseFigmaFileToSerializedNodes(file);
    expect(doc.type).toBe('infinite-canvas');
    expect(doc.version).toBe(1);
    expect(Array.isArray(doc.elements)).toBe(true);
  });

  it('imports auto-layout fixture Untitled (2).fig with parent-local child coordinates', () => {
    const figBytes = readFileSync(
      join(__dirname, '..', 'Untitled (2).fig'),
    );
    const doc = parseFigFileToSerializedNodes(new Uint8Array(figBytes));
    const frame = doc.elements.find((n) => n.id === '5:9');
    const child = doc.elements.find((n) => n.id === '5:10');
    expect(frame).toBeDefined();
    expect(child).toBeDefined();
    expect(frame!.type).toBe('rect');
    expect(frame!.display).toBe('flex');
    expect(child!.parentId).toBe('5:9');
    expect(child!.x).toBeLessThan(frame!.width!);
    expect(child!.y).toBeLessThan(frame!.height!);
  });

  it('preserves stacked solid + linear gradient fills on ellipses', () => {
    const figBytes = readFileSync(
      join(__dirname, '..', 'Untitled (2).fig'),
    );
    const doc = parseFigFileToSerializedNodes(new Uint8Array(figBytes));
    const ellipse = doc.elements.find((node) => node.type === 'ellipse');
    expect(ellipse?.fills?.length).toBe(2);
    expect(ellipse?.fills?.[0]).toMatchObject({
      type: 'gradient',
    });
    expect(ellipse?.fills?.[0]?.opacity).toBeCloseTo(0.2, 5);
    expect(ellipse?.fills?.[0].value).toContain('linear-gradient(90deg');
    expect(ellipse?.fills?.[0].value).toContain('#000000');
    expect(ellipse?.fills?.[0].value).toContain('#22d9fe');
    expect(ellipse?.fills?.[1]).toMatchObject({
      type: 'solid',
      value: '#f01a1a',
    });
  });
});

describe('serializedNodesToFigmaScene round-trip', () => {
  it('rebuilds a nested scene from .ic nodes', () => {
    const doc = parseFigmaFileToSerializedNodes(SAMPLE_FILE);
    const scene = serializedNodesToFigmaScene(doc.elements);
    expect(scene.type).toBe('infinite-canvas-figma-scene');
    expect(scene.nodes.length).toBe(1);
    const frame = scene.nodes[0];
    expect(frame.type).toBe('FRAME');
    expect(frame.children?.length).toBe(3);
    const rect = frame.children?.find((c) => c.id === '1:3');
    expect(rect?.type).toBe('RECTANGLE');
    expect(rect?.cornerRadius).toBe(8);
    expect(rect?.fills?.[0]).toMatchObject({ type: 'SOLID' });
    expect(rect?.fills?.[0].color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    const text = frame.children?.find((c) => c.id === '1:5');
    expect(text?.type).toBe('TEXT');
    expect(text?.characters).toBe('Hello');
  });
});

describe('FigmaRestClient', () => {
  it('sends the token header and parses the file response', async () => {
    const calls: { url: string; headers?: Record<string, string> }[] = [];
    const client = new FigmaRestClient({
      token: 'tkn',
      fetch: async (url, init) => {
        calls.push({ url, headers: init?.headers });
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => SAMPLE_FILE,
        };
      },
    });
    const file = await client.getFile('https://www.figma.com/file/KEY/Name');
    expect(file.name).toBe('Sample');
    expect(calls[0].url).toBe('https://api.figma.com/v1/files/KEY');
    expect(calls[0].headers?.['X-Figma-Token']).toBe('tkn');
  });

  it('throws on non-ok responses', async () => {
    const client = new FigmaRestClient({
      token: 'tkn',
      fetch: async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({}),
      }),
    });
    await expect(client.getFile('KEY')).rejects.toThrow(/403/);
  });
});
