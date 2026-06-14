import {
  ArrowShape,
  BoxShape,
  PlaneShape,
  SphereShape,
  TorusShape,
  GizmoShape,
  axisColor,
  colorLerp,
  hoverColor,
  withAlpha,
  GIZMO_COLOR_WHITE,
  GIZMO_COLOR_GRAY,
  createTranslateShapes,
  createRotateShapes,
  createScaleShapes,
  createTransformShapes,
} from '../../packages/ecs/src/gizmo';
import {
  createCombinedTransformGizmo,
  createTranslateGizmo,
  createRotateGizmo,
  createScaleGizmo,
} from '../../packages/ecs/src/utils/gizmo-geometry';

describe('gizmo color helpers', () => {
  it('returns per-axis base colors', () => {
    expect(axisColor('x')).toEqual([1, 0.15, 0.15, 1]);
    expect(axisColor('y')).toEqual([0.15, 1, 0.15, 1]);
    expect(axisColor('z')).toEqual([0.2, 0.45, 1, 1]);
  });

  it('lerps component-wise', () => {
    expect(colorLerp([0, 0, 0, 0], [1, 1, 1, 1], 0.5)).toEqual([
      0.5, 0.5, 0.5, 0.5,
    ]);
  });

  it('hover lerps rgb toward white but keeps alpha', () => {
    const base: [number, number, number, number] = [0, 0, 0, 0.35];
    const h = hoverColor(base, 0.75);
    expect(h[0]).toBeCloseTo(0.75);
    expect(h[1]).toBeCloseTo(0.75);
    expect(h[2]).toBeCloseTo(0.75);
    expect(h[3]).toBe(0.35);
  });

  it('hover of white is white', () => {
    expect(hoverColor([...GIZMO_COLOR_WHITE])).toEqual(GIZMO_COLOR_WHITE);
  });

  it('withAlpha only changes alpha', () => {
    expect(withAlpha([1, 0.15, 0.15, 1], 0.35)).toEqual([1, 0.15, 0.15, 0.35]);
  });
});

describe('gizmo shapes', () => {
  const nonEmpty = (s: GizmoShape) => {
    expect(s.positions.length).toBeGreaterThan(0);
    expect(s.positions.length).toBe(s.normals.length);
    expect(s.positions.length % 3).toBe(0);
    expect(s.indices.length % 3).toBe(0);
    // indices stay in range
    const vertexCount = s.positions.length / 3;
    for (const i of s.indices) {
      expect(i).toBeLessThan(vertexCount);
    }
  };

  it('builds an arrow (shaft + cone)', () => {
    const arrow = new ArrowShape({
      axis: 'x',
      kind: 'translate',
      defaultColor: axisColor('x'),
    });
    expect(arrow.axis).toBe('x');
    expect(arrow.kind).toBe('translate');
    nonEmpty(arrow);
  });

  it('builds a plane quad with 4 verts / 2 tris', () => {
    const plane = new PlaneShape({
      axis: 'xy',
      kind: 'translate',
      defaultColor: withAlpha(axisColor('z'), 0.35),
    });
    expect(plane.positions.length).toBe(12);
    expect(plane.indices.length).toBe(6);
    nonEmpty(plane);
  });

  it('builds a rotation ring', () => {
    const ring = new TorusShape({
      axis: 'y',
      kind: 'rotate',
      defaultColor: axisColor('y'),
    });
    expect(ring.kind).toBe('rotate');
    nonEmpty(ring);
  });

  it('builds a scale box and a center sphere', () => {
    const box = new BoxShape({
      axis: 'z',
      kind: 'scale',
      defaultColor: axisColor('z'),
    });
    const sphere = new SphereShape({
      axis: 'xyz',
      kind: 'scale',
      defaultColor: [0.8, 0.8, 0.8, 1],
    });
    expect(box.positions.length).toBe(24 * 3); // 6 faces * 4 verts
    expect(box.indices.length).toBe(36);
    nonEmpty(box);
    nonEmpty(sphere);
  });

  it('reflects hover / disabled state in getColor', () => {
    const arrow = new ArrowShape({
      axis: 'x',
      kind: 'translate',
      defaultColor: axisColor('x'),
    });
    expect(arrow.getColor()).toEqual(axisColor('x'));
    arrow.hover = true;
    expect(arrow.getColor()).toEqual(hoverColor(axisColor('x')));
    arrow.disabled = true; // disabled wins over hover
    expect(arrow.getColor()).toEqual([...GIZMO_COLOR_GRAY]);
  });
});

describe('gizmo assemblers', () => {
  it('translate = 3 arrows + 3 planes', () => {
    const shapes = createTranslateShapes();
    expect(shapes.filter((s) => s.axis.length === 1)).toHaveLength(3);
    expect(shapes.filter((s) => s.axis.length === 2)).toHaveLength(3);
    expect(shapes.every((s) => s.kind === 'translate')).toBe(true);
  });

  it('rotate = 3 rings', () => {
    const shapes = createRotateShapes();
    expect(shapes).toHaveLength(3);
    expect(shapes.every((s) => s.kind === 'rotate')).toBe(true);
  });

  it('scale = 3 boxes + center sphere', () => {
    const shapes = createScaleShapes();
    expect(shapes).toHaveLength(4);
    expect(shapes.every((s) => s.kind === 'scale')).toBe(true);
    expect(shapes.some((s) => s.axis === 'xyz')).toBe(true);
  });

  it('transform = translate + rotate', () => {
    expect(createTransformShapes()).toHaveLength(
      createTranslateShapes().length + createRotateShapes().length,
    );
  });
});

describe('gizmo-geometry adapter (back-compat surface)', () => {
  it('combined gizmo equals translate + rotate parts', () => {
    const combined = createCombinedTransformGizmo();
    const t = createTranslateGizmo();
    const r = createRotateGizmo();
    expect(combined).toHaveLength(t.length + r.length);
    expect(combined.slice(0, t.length).map((p) => p.axis)).toEqual(
      t.map((p) => p.axis),
    );
  });

  it('exposes typed arrays and rgba colors', () => {
    for (const part of createCombinedTransformGizmo()) {
      expect(part.positions).toBeInstanceOf(Float32Array);
      expect(part.indices).toBeInstanceOf(Uint32Array);
      expect(part.color).toHaveLength(4);
    }
  });

  it('scale gizmo geometry is available', () => {
    expect(createScaleGizmo()).toHaveLength(4);
  });
});
