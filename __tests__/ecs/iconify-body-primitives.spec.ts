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
});
