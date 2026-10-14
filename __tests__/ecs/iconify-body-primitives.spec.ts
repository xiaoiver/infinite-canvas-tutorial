import { resolveIconifyBodyToScalablePrimitives } from '../../packages/ecs/src/utils/icon-font';

describe('resolveIconifyBodyToScalablePrimitives', () => {
  it('merges g fill=currentColor onto child paths (pixelarticons a-arrow-down shape)', () => {
    const body =
      '<g fill="currentColor"><path d="M16 6h2v12h-2z"/><path d="M2 2h2v2H2z"/></g>';
    const prims = resolveIconifyBodyToScalablePrimitives(body, 32, 32);
    expect(prims).not.toBeNull();
    expect(prims!.length).toBe(2);
    expect(prims![0]!.style.fill).toBe('currentColor');
    expect(prims![1]!.style.fill).toBe('currentColor');
  });

  it('merges nested g: inner fill overrides for paths under inner g', () => {
    const body =
      '<g fill="red"><g fill="blue"><path d="M0 0H10V10H0Z"/></g></g>';
    const prims = resolveIconifyBodyToScalablePrimitives(body, 32, 32);
    expect(prims).not.toBeNull();
    expect(prims!.length).toBe(1);
    expect(prims![0]!.style.fill).toBe('blue');
  });

  it('accepts root-level paths with no g', () => {
    const body = '<path d="M0 0H10V10H0Z" fill="red"/>';
    const prims = resolveIconifyBodyToScalablePrimitives(body, 32, 32);
    expect(prims).not.toBeNull();
    expect(prims![0]!.style.fill).toBe('red');
  });

  it('keeps single-quoted attributes and explicitly closed shapes under nested groups', () => {
    const body =
      "<g fill='red'><path d='M0 0H10V10H0Z'></path>" +
      "<g fill='blue'><rect x='10' y='0' width='10' height='10'></rect></g>" +
      "<circle cx='5' cy='15' r='2'></circle></g>";
    const prims = resolveIconifyBodyToScalablePrimitives(body, 20, 20, 20, 20);
    expect(prims?.map((p) => p.kind)).toEqual(['path', 'path', 'ellipse']);
    expect(prims?.map((p) => p.style.fill)).toEqual(['red', 'blue', 'red']);
    expect(prims?.[2]).toMatchObject({ cx: 5, cy: 15, rx: 2, ry: 2 });
  });

  it('converts self-closing rect to path (material android-style body)', () => {
    const body = `<rect width="4" height="10" x="2" y="12" fill="#8bc34a" rx="2"/>
<path fill="#8bc34a" d="M8 12h16v12H8z"/>`;
    const prims = resolveIconifyBodyToScalablePrimitives(body, 32, 32, 0, 0);
    expect(prims).not.toBeNull();
    expect(prims!.length).toBe(2);
    const rect = prims![0]!;
    expect(rect.kind).toBe('path');
    if (rect.kind !== 'path') throw new Error('Expected a rect path');
    expect(rect.d).toMatch(/^M/);
    expect(prims![0]!.style.fill).toBe('#8bc34a');
    expect(prims![1]!.kind).toBe('path');
  });

  it('normalizes the union of line and ellipse bounds without a viewBox', () => {
    const body =
      '<g stroke="currentColor" fill="none">' +
      '<ellipse cx="15" cy="20" rx="5" ry="10"/>' +
      '<line x1="20" y1="10" x2="30" y2="30" stroke-linecap="round"/>' +
      '</g>';
    const prims = resolveIconifyBodyToScalablePrimitives(body, 40, 40);
    expect(prims?.[0]).toMatchObject({
      kind: 'ellipse',
      cx: 10,
      cy: 20,
      rx: 10,
      ry: 20,
      style: { stroke: 'currentColor', fill: 'none' },
    });
    expect(prims?.[1]).toMatchObject({
      kind: 'line',
      x1: 20,
      y1: 0,
      x2: 40,
      y2: 40,
      style: { strokeLinecap: 'round' },
    });
  });

  it('applies Iconify viewBox left/top (min-x/min-y) when width/height are set', () => {
    const body = '<path d="M0 0H100V100H0Z"/>';
    const origin = resolveIconifyBodyToScalablePrimitives(
      body,
      100,
      100,
      200,
      200,
      0,
      0,
    );
    const shifted = resolveIconifyBodyToScalablePrimitives(
      body,
      100,
      100,
      200,
      200,
      -50,
      -25,
    );
    expect(origin).not.toBeNull();
    expect(shifted).not.toBeNull();
    const originPath = origin![0]!;
    const shiftedPath = shifted![0]!;
    if (originPath.kind !== 'path' || shiftedPath.kind !== 'path') {
      throw new Error('Expected viewBox paths');
    }
    expect(originPath.d).not.toEqual(shiftedPath.d);
  });
});
