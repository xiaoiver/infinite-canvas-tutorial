import {
  layoutGlyphs,
  TextPathGeometry,
} from '../../packages/ecs/src/utils/glyph/text-path';
import { getGlyphQuads } from '../../packages/ecs/src/utils/glyph/symbol-quad';
import {
  hitTestTextPath,
  measureTextPath,
  textPathGlyphCorners,
} from '../../packages/ecs/src/utils/glyph/measure-text-path';
import {
  Text,
  DOMAdapter,
  measureText,
  serializeNodesToSVGElements,
} from '../../packages/ecs/src';
import { NodeJSAdapter } from '../utils';
DOMAdapter.set(NodeJSAdapter);

const options = {
  lineHeight: 20,
  textAlign: 'start' as const,
  letterSpacing: 0,
  path: 'M0 0H100',
};
const layout = (lines = ['ABC'], patch = {}) =>
  layoutGlyphs(
    lines,
    (line) => Array.from(line),
    () => ({ width: 10 }),
    { ...options, ...patch },
  );

describe('text path layout', () => {
  it('positions the advance center on the path while retaining a baseline origin', () => {
    expect(layout().map(({ x, y, rotation }) => [x, y, rotation])).toEqual([
      [0, 0, 0],
      [10, 0, 0],
      [20, 0, 0],
    ]);
    const vertical = layout(['A'], { path: 'M20 30V130' })[0];
    expect(vertical.x).toBeCloseTo(20);
    expect(vertical.y).toBeCloseTo(30);
    expect(vertical.rotation).toBeCloseTo(Math.PI / 2);
  });
  it.each([
    ['left', 0],
    ['start', 0],
    ['center', 35],
    ['right', 70],
    ['end', 70],
  ])('aligns %s within the available path', (textAlign, x) => {
    expect(layout(['ABC'], { textAlign })[0].x).toBeCloseTo(x as number);
  });
  it('keeps reading order and rotates glyphs when switching sides', () => {
    const glyphs = layout(['ABC'], { side: 'right', startOffset: 5 });
    expect(glyphs.map(({ glyph }) => glyph)).toEqual(['A', 'B', 'C']);
    expect(glyphs.map(({ x }) => x)).toEqual([95, 85, 75]);
    glyphs.forEach(({ rotation }) => expect(rotation).toBeCloseTo(Math.PI));
  });
  it('applies kerning before a glyph and spacing only between advances', () => {
    const glyphs = layoutGlyphs(
      ['AV'],
      (line) => Array.from(line),
      (char) => ({ width: 10, kerning: char === 'V' ? -2 : 0 }),
      { ...options, textAlign: 'end', letterSpacing: 4 },
    );
    expect(glyphs.map(({ x }) => x)).toEqual([78, 90]);
  });
  it('lays out every line once and offsets baselines along the local normal', () => {
    const glyphs = layout(['AB', 'CD'], {
      path: 'M10 20V120',
      dy: 2,
      pathOffset: 3,
    });
    expect(glyphs.map(({ glyph }) => glyph)).toEqual(['A', 'B', 'C', 'D']);
    expect(glyphs.map(({ x }) => Math.round(x))).toEqual([5, 5, -15, -15]);
    expect(glyphs.map(({ y }) => Math.round(y))).toEqual([20, 30, 20, 30]);
  });
  it('clips glyph centers beyond open ends without wrapping or clamping them together', () => {
    expect(
      layout(['ABC'], { startOffset: 90 }).map(({ glyph }) => glyph),
    ).toEqual(['A']);
    expect(
      layout(['ABC'], { startOffset: -20 }).map(({ glyph }) => glyph),
    ).toEqual(['C']);
    expect(layout(['ABC'], { startOffset: -1000 })).toEqual([]);
    expect(layout(['ABC'], { startOffset: 1000 })).toEqual([]);
  });
  it('wraps either side of a closed seam at any offset but uses at most one lap', () => {
    const path = 'M0 0H10V10H0Z';
    const geometry = new TextPathGeometry(path);
    expect(geometry.length).toBe(40);
    expect(geometry.closed).toBe(true);
    expect(geometry.sample(35)?.x).toBeCloseTo(0);
    expect(geometry.sample(35)?.y).toBeCloseTo(5);
    expect(layout(['ABCDEFG'], { path, startOffset: 119 })).toEqual(
      layout(['ABCDEFG'], { path, startOffset: -1 }),
    );
    expect(layout(['ABCDEFG'], { path })).toHaveLength(4);
  });
  it('sums all contours without an artificial line across moveto gaps', () => {
    const path = 'M0 0H20 M100 100V120';
    const glyphs = layout(['ABCD'], { path });
    expect(glyphs.map(({ x, y }) => [Math.round(x), Math.round(y)])).toEqual([
      [0, 0],
      [10, 0],
      [100, 100],
      [100, 110],
    ]);
    expect(new TextPathGeometry(path).length).toBe(40);
  });
  it.each(['M10 10', 'M10 10L10 10', 'M10 10Z'])(
    'returns no glyphs for degenerate path %s',
    (path) => {
      expect(layout(['ABC'], { path })).toEqual([]);
    },
  );
  it('rotates atlas quads around the baseline instead of their padded bottom edge', () => {
    const positioned = {
      glyph: 'A',
      x: 100,
      y: 50,
      width: 20,
      scale: 1,
      fontStack: 'font',
      rotation: Math.PI / 2,
    };
    const quad = getGlyphQuads(
      [positioned],
      {
        font: {
          A: {
            rect: { x: 0, y: 0, w: 20, h: 30 },
            metrics: { width: 20, height: 30, left: 3, top: 25, advance: 20 },
          },
        },
      },
      true,
    )[0];
    expect(quad.tl.x).toBeCloseTo(125);
    expect(quad.tl.y).toBeCloseTo(53);
    expect(quad.br.x).toBeCloseTo(95);
    expect(quad.br.y).toBeCloseTo(73);
  });
});

describe('ECS path text metrics', () => {
  const style = {
    content: 'AB',
    fontFamily: 'sans-serif',
    fontSize: 96,
    path: 'M0 100H1000',
    anchorX: 30,
    anchorY: 40,
  };
  it('shares ink bounds with rotated glyph picking and skips empty areas', () => {
    const computed = measureText({ ...style, path: 'M100 100V500' });
    const bounds = Text.getGeometryBounds(style, computed);
    const first = computed.pathGlyphs![0];
    const points = textPathGlyphCorners(first);
    const center = {
      x: (points[0].x + points[2].x) / 2,
      y: (points[0].y + points[2].y) / 2,
    };
    expect(hitTestTextPath(computed.pathGlyphs!, center.x, center.y)).toBe(
      true,
    );
    expect(
      hitTestTextPath(computed.pathGlyphs!, bounds.maxX + 10, bounds.maxY + 10),
    ).toBe(false);
    for (const glyph of computed.pathGlyphs!)
      for (const point of textPathGlyphCorners(glyph)) {
        expect(point.x).toBeGreaterThanOrEqual(bounds.minX - 1e-5);
        expect(point.x).toBeLessThanOrEqual(bounds.maxX + 1e-5);
        expect(point.y).toBeGreaterThanOrEqual(bounds.minY - 1e-5);
        expect(point.y).toBeLessThanOrEqual(bounds.maxY + 1e-5);
      }
  });
  it('moves anchors in document axes and offsets in the local path normal', () => {
    const metrics = measureText({ ...style, path: 'M100 100V500' });
    const shifted = measureText({
      ...style,
      path: 'M100 100V500',
      anchorX: 40,
      anchorY: 60,
      pathOffset: 5,
    });
    expect(shifted.pathGlyphs![0].x - metrics.pathGlyphs![0].x).toBeCloseTo(5);
    expect(shifted.pathGlyphs![0].y - metrics.pathGlyphs![0].y).toBeCloseTo(20);
  });
  it('keeps empty paths finite and restores shared canvas measurement state', () => {
    const ctx = DOMAdapter.get()
      .createCanvas(100, 100)
      .getContext('2d') as CanvasRenderingContext2D;
    ctx.font = '24px serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const before = [ctx.font, ctx.textAlign, ctx.textBaseline];
    const metrics = measureText({ ...style, path: 'M10 10Z' });
    expect(metrics.pathGlyphs).toEqual([]);
    expect(Text.getGeometryBounds(style, metrics)).toMatchObject({
      minX: 30,
      maxX: 30,
      minY: 40,
      maxY: 40,
    });
    measureTextPath(style, metrics, ctx, {
      font: '96px sans-serif',
      baselineOffset: 0,
    });
    expect([ctx.font, ctx.textAlign, ctx.textBaseline]).toEqual(before);
  });
  it('exports multiline glyph origins and rotations without leaking path settings as SVG attributes', async () => {
    const node = {
      ...style,
      id: 't',
      type: 'text' as const,
      content: 'AB\nCD',
      side: 'right' as const,
      startOffset: 5,
      pathOffset: 3,
      lineHeight: 50,
      leading: 7,
      x: 10,
      y: 20,
    };
    const [svg] = await serializeNodesToSVGElements([node]);
    const spans = svg.querySelectorAll('tspan');
    expect(spans).toHaveLength(4);
    expect(Array.from(spans).map((span) => span.textContent)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(Number(spans[0].getAttribute('rotate'))).toBeCloseTo(180);
    expect(
      Number(spans[2].getAttribute('y')) - Number(spans[0].getAttribute('y')),
    ).toBeCloseTo(-57);
    for (const attribute of ['path', 'side', 'start-offset', 'path-offset'])
      expect(svg.hasAttribute(attribute)).toBe(false);
  });
});
