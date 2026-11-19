import { createDocumentWorld } from '../helpers/ecs-document';
import {
  PolylineGeometryCache,
  simplifyPolyline,
  POLYLINE_CSS_ERROR,
  PolylinePoints,
} from '../../packages/ecs/src/utils/polyline-lod';
import { supportsPolylineLOD } from '../../packages/ecs/src/utils/polyline-lod-eligibility';
import {
  Children,
  ClipMode,
  DropShadow,
  Editable,
  FillLayers,
  FillTexture,
  Filter,
  Highlighted,
  InnerShadow,
  Marker,
  NodeLayerBlendMode,
  Polyline,
  Rough,
  Selected,
  SizeAttenuation,
  Stroke,
  StrokeLayers,
  UI,
  Wireframe,
} from '../../packages/ecs/src/components';
import type { Entity } from '@lastolivegames/becsy';

const wave = (): PolylinePoints =>
  Array.from({ length: 1001 }, (_, i) => [i / 5, Math.sin(i / 80) * 20]);
function distance(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = dx * dx + dy * dy;
  const t = l
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l))
    : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
it('bounds every omitted vertex in CSS pixels and preserves endpoint tangents without mutating points', () => {
  const source = wave(),
    before = JSON.stringify(source);
  for (const scale of [0.01, 0.25, 1, 8, 64]) {
    const result = new PolylineGeometryCache().get(source, scale);
    expect(result.length).toBeLessThan(source.length);
    expect(result.slice(0, 2)).toEqual(source.slice(0, 2));
    expect(result.slice(-2)).toEqual(source.slice(-2));
    for (const p of source)
      expect(
        Math.min(...result.slice(1).map((b, i) => distance(p, result[i], b))) *
          scale,
      ).toBeLessThanOrEqual(POLYLINE_CSS_ERROR + 1e-9);
  }
  expect(JSON.stringify(source)).toBe(before);
});
it('preserves collinear reversals, duplicate samples, sharp corners and coincident interior endpoints', () => {
  for (const source of [
    wave(),
    Array.from({ length: 120 }, (_, i): [number, number] => [
      Math.sin(i) * 20,
      0,
    ]),
    Array.from({ length: 120 }, (_, i): [number, number] => [
      i < 60 ? i : 120 - i,
      i === 60 ? 10 : 0,
    ]),
  ]) {
    const result = simplifyPolyline(source, 0.1);
    for (const p of source)
      expect(
        Math.min(...result.slice(1).map((b, i) => distance(p, result[i], b))),
      ).toBeLessThanOrEqual(0.100001);
  }
  const repeated: PolylinePoints = Array.from({ length: 100 }, () => [0, 0]);
  repeated[99] = [1, 0];
  expect(simplifyPolyline(repeated, 0.1)).toHaveLength(4);
});
it('reuses levels with hysteresis, refines immediately, bounds retention and invalidates same-array edits', () => {
  const c = new PolylineGeometryCache(),
    p = wave();
  const a = c.get(p, 2);
  expect(c.get(p, 1.99)).toBe(a);
  const b = c.get(p, 2.01);
  expect(b).not.toBe(a);
  expect(c.get(p, 1.99)).toBe(b);
  c.get(p, 0.5);
  expect(c.get(p, 2)).toBe(a);
  for (const scale of [8, 32, 128, 512]) c.get(p, scale);
  expect(c.get(p, 2)).not.toBe(a);
  p[500] = [100, 200];
  const edit = c.get(p, 2, true);
  expect(edit).toContain(p[500]);
  expect(c.get([...p], 2)).not.toBe(edit);
});
it('safely retains small, closed, disconnected, invalid and adversarial inputs', () => {
  for (const p of [
    [],
    [[1, 2]],
    wave().slice(0, 10),
    [...wave(), [0, 0]],
    [...wave(), [NaN, NaN]],
    [...wave(), [Infinity, 0]],
  ] as PolylinePoints[])
    expect(simplifyPolyline(p, 0.1)).toBe(p);
  const p = wave();
  for (const s of [NaN, Infinity, 0, -1])
    expect(new PolylineGeometryCache().get(p, s)).toBe(p);
  expect(simplifyPolyline(p, Infinity)).toBe(p);
  // A steadily increasing zigzag makes Douglas–Peucker split off one point at a time.
  const worst: PolylinePoints = Array.from({ length: 10000 }, (_, i) => [
    i,
    (i % 2 ? 1 : -1) * i,
  ]);
  expect(simplifyPolyline(worst, 0.0001)).toBe(worst);
});
function fixture() {
  const data = new Map<unknown, unknown>([
    [Polyline, { points: wave() }],
    [
      Stroke,
      { width: 2, alignment: 'center', linejoin: 'round', dasharray: [0, 0] },
    ],
    [StrokeLayers, { layers: [{ type: 'solid', value: '#123456' }] }],
  ]);
  const entity = {
    has: (t: unknown) => data.has(t),
    hasSomeOf: (...ts: unknown[]) => ts.some((t) => data.has(t)),
    read: (t: unknown) => data.get(t),
  } as Entity;
  return { entity, data };
}
it('limits eligibility to simple solid round strokes and handles ancestor interaction/effect additions and removals', () => {
  const { entity, data } = fixture();
  expect(supportsPolylineLOD(entity)).toBe(true);
  for (const c of [
    Rough,
    UI,
    FillTexture,
    Wireframe,
    SizeAttenuation,
    Selected,
    Highlighted,
    ClipMode,
    Filter,
    NodeLayerBlendMode,
    DropShadow,
    InnerShadow,
  ]) {
    data.set(c, {});
    expect(supportsPolylineLOD(entity)).toBe(false);
    data.delete(c);
  }
  for (const stroke of [
    { alignment: 'inner' },
    { linejoin: 'miter' },
    { linejoin: 'bevel' },
    { width: NaN },
    { width: 0 },
    { dasharray: [2, 3] },
    { dasharray: [0, NaN] },
  ]) {
    const base = data.get(Stroke);
    data.set(Stroke, { ...(base as object), ...stroke });
    expect(supportsPolylineLOD(entity)).toBe(false);
    data.set(Stroke, base);
  }
  for (const [c, value] of [
    [Editable, { isEditing: true }],
    [Marker, { start: 'triangle', end: 'none' }],
    [FillLayers, { layers: [{ type: 'solid' }] }],
    [StrokeLayers, { layers: [{ type: 'gradient' }] }],
    [StrokeLayers, { layers: [{ type: 'solid', blendMode: 'multiply' }] }],
    [StrokeLayers, { layers: [] }],
  ] as const) {
    const old = data.get(c);
    data.set(c, value);
    expect(supportsPolylineLOD(entity)).toBe(false);
    old ? data.set(c, old) : data.delete(c);
  }
  data.set(Marker, { start: 'none', end: 'none' });
  data.set(FillLayers, { layers: [{ enabled: false }] });
  data.set(Editable, { isEditing: false });
  const parent = fixture();
  data.set(Children, { parent: parent.entity });
  expect(supportsPolylineLOD(entity)).toBe(true);
  parent.data.set(Selected, {});
  expect(supportsPolylineLOD(entity)).toBe(false);
  parent.data.delete(Selected);
  expect(supportsPolylineLOD(entity)).toBe(true);
  data.delete(Stroke);
  expect(supportsPolylineLOD(entity)).toBe(false);
  data.delete(Polyline);
  expect(supportsPolylineLOD(entity)).toBe(false);
});

it('keeps the runtime switch per canvas, preserves original picking/bounds/document and does not consume undo/redo', async () => {
  const { Canvas, ComputedBounds } = await import(
    '../../packages/ecs/src/components'
  );
  const world = await createDocumentWorld(2);
  try {
    const [a, b] = world.apis;
    const samples = wave();
    await world.reset(a, [
      {
        id: 'line',
        type: 'polyline',
        x: 10,
        y: 20,
        width: 200,
        height: 40,
        points: samples.map((p) => p.join(',')).join(' '),
        strokeWidth: 4,
        strokeLinejoin: 'round',
        strokes: [{ type: 'solid', value: '#123456', opacity: 1 }],
      } as any,
    ]);
    expect(a.getCanvas().read(Canvas).polylineLOD).toBe(false);
    expect(b.getCanvas().read(Canvas).polylineLOD).toBe(false);
    const node = a.getNodeById('line'),
      entity = a.getEntity(node);
    const document = JSON.stringify(a.getNodes());
    const bounds = JSON.stringify(
      entity.read(ComputedBounds).geometryWorldBounds,
    );
    const point = { x: 10 + samples[250][0], y: 20 + samples[250][1] };
    const hits = a.elementsFromPoint(point).map((e) => e.__id);
    expect(hits).toContain(entity.__id);
    a.setPolylineLODEnabled(true);
    await world.frame();
    await world.frame();
    expect(a.getCanvas().read(Canvas).polylineLOD).toBe(true);
    expect(b.getCanvas().read(Canvas).polylineLOD).toBe(false);
    expect(JSON.stringify(a.getNodes())).toBe(document);
    expect(
      JSON.stringify(entity.read(ComputedBounds).geometryWorldBounds),
    ).toBe(bounds);
    expect(a.elementsFromPoint(point).map((e) => e.__id)).toEqual(hits);
    await world.edit(a, (e) =>
      e.updateNode(e.getNodeById('line'), { name: 'edited' }),
    );
    a.setPolylineLODEnabled(false);
    await world.frame();
    a.setPolylineLODEnabled(true);
    await world.frame();
    await world.history(a, 'undo');
    expect(a.getNodeById('line').name).not.toBe('edited');
    expect(a.getCanvas().read(Canvas).polylineLOD).toBe(true);
    await world.history(a, 'redo');
    expect(a.getNodeById('line').name).toBe('edited');
  } finally {
    await world.dispose();
  }
});
