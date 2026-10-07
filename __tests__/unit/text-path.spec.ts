import {
  layoutGlyphs,
  TextPathGeometry,
} from '../../packages/core/src/utils/glyph/text-path';
import { getGlyphQuads } from '../../packages/core/src/utils/glyph/symbol-quad';
import {
  Text,
  DOMAdapter,
  serializeNode,
  deserializeNode,
  toSVGElement,
} from '../../packages/core/src';
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

describe('path text bounds and document round trip', () => {
  it('bounds the positioned glyphs and invalidates every path setting', () => {
    const text = new Text({
      content: 'AB',
      fontSize: 48,
      path: 'M0 100H1000',
      x: 30,
      y: 40,
    });
    const first = text.getGeometryBounds();
    expect(first.minX).toBeCloseTo(30);
    expect(first.maxX).toBeLessThan(100);
    expect(first.minY).toBeCloseTo(122);
    text.startOffset = 100;
    const moved = text.getGeometryBounds();
    expect(moved.minX - first.minX).toBeCloseTo(100);
    text.pathOffset = 20;
    expect(text.getGeometryBounds().minY - moved.minY).toBeCloseTo(20);
    text.side = 'right';
    expect(text.getGeometryBounds().minX).toBeGreaterThan(800);
    text.path = 'M0 0V100';
    expect(text.getGeometryBounds().maxX).toBeLessThan(100);
    text.startOffset = 1000;
    expect(text.getGeometryBounds()).toMatchObject({
      minX: 30,
      maxX: 30,
      minY: 40,
      maxY: 40,
    });
  });
  it('preserves layout properties in JSON and exports positioned SVG glyphs', async () => {
    const text = new Text({
      content: 'AB',
      fontSize: 48,
      path: 'M0 0H200',
      textAlign: 'center',
      side: 'right',
      startOffset: 5,
      pathOffset: 3,
      x: 10,
      y: 20,
    });
    const wire = serializeNode(text)!;
    expect(wire.attributes).toMatchObject({
      path: text.path,
      side: 'right',
      startOffset: 5,
      pathOffset: 3,
      textAlign: 'center',
      textBaseline: 'alphabetic',
    });
    const copy = (await deserializeNode(wire)) as Text;
    expect(copy.getGeometryBounds()).toEqual(text.getGeometryBounds());
    const svg = toSVGElement(wire);
    const glyphs = Array.from(svg.querySelectorAll('tspan'));
    expect(glyphs.map((glyph) => glyph.textContent)).toEqual(['A', 'B']);
    expect(glyphs[0].getAttribute('rotate')).toBe('180');
    expect(Number(glyphs[0].getAttribute('x'))).toBeCloseTo(123);
    expect(Number(glyphs[0].getAttribute('y'))).toBeCloseTo(17);
    expect(svg.hasAttribute('path')).toBe(false);
  });
  it('round-trips multiline layout and preserves explicit line spacing in SVG', async () => {
    const text = new Text({
      content: 'AB\nCD',
      fontSize: 48,
      path: 'M0 100H400',
      lineHeight: 50,
      leading: 7,
      maxLines: 2,
      textOverflow: 'clip',
    });
    const wire = JSON.parse(JSON.stringify(serializeNode(text)));
    const copy = (await deserializeNode(wire)) as Text;
    expect(copy.getGeometryBounds()).toEqual(text.getGeometryBounds());
    expect(copy.leading).toBe(7);
    expect(copy.maxLines).toBe(2);
    const glyphs = toSVGElement(wire).querySelectorAll('tspan');
    expect(glyphs).toHaveLength(4);
    expect(
      Number(glyphs[2].getAttribute('y')) - Number(glyphs[0].getAttribute('y')),
    ).toBeCloseTo(57);
  });
});
