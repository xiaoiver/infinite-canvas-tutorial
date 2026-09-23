import type {
  HandleMirroring,
  VectorNetwork,
} from '../components/geometry/VectorNetwork';

export type VectorHandle = { segmentIndex: number; end: 'start' | 'end' };
type Geometry = Pick<VectorNetwork, 'vertices' | 'segments' | 'regions'>;
type Point = { x: number; y: number };
const key = (handle: VectorHandle) =>
  handle.end === 'start' ? 'tangentStart' : 'tangentEnd';

/** Count endpoint incidences, including both ends of a self-loop. */
export function vectorHandlesAtVertex(
  network: Geometry,
  vertex: number,
): VectorHandle[] {
  return network.segments.flatMap((segment, segmentIndex) => [
    ...(segment.start === vertex
      ? [{ segmentIndex, end: 'start' as const }]
      : []),
    ...(segment.end === vertex ? [{ segmentIndex, end: 'end' as const }] : []),
  ]);
}

/** Relative controls point away from their anchor, so paired controls oppose. */
export function moveVectorHandle(
  network: Geometry,
  handle: VectorHandle,
  tangent: Point,
  independent = false,
): Geometry {
  const segment = network.segments[handle.segmentIndex];
  const index = segment?.[handle.end];
  const vertex = network.vertices[index];
  if (!vertex || !Number.isFinite(tangent.x) || !Number.isFinite(tangent.y))
    return network;
  const vertices = network.vertices.map((v) => ({ ...v }));
  const segments = network.segments.map((s) => ({ ...s }));
  segments[handle.segmentIndex][key(handle)] = { ...tangent };
  if (independent) vertices[index].handleMirroring = 'NONE';
  const mode = independent ? 'NONE' : vertex.handleMirroring ?? 'NONE';
  const handles = vectorHandlesAtVertex(network, index);
  if (handles.length === 2 && mode !== 'NONE') {
    const other = handles.find(
      (h) => h.segmentIndex !== handle.segmentIndex || h.end !== handle.end,
    )!;
    const length = Math.hypot(tangent.x, tangent.y);
    const previous = network.segments[other.segmentIndex][key(other)];
    const otherLength = Math.hypot(previous?.x ?? 0, previous?.y ?? 0);
    if (mode === 'ANGLE_AND_LENGTH') {
      segments[other.segmentIndex][key(other)] = {
        x: -tangent.x,
        y: -tangent.y,
      };
    } else if (length > 1e-9) {
      segments[other.segmentIndex][key(other)] = {
        x: (-tangent.x * otherLength) / length,
        y: (-tangent.y * otherLength) / length,
      };
    }
    // A collapsed ANGLE handle has no direction; retain its partner unchanged.
  }
  return { vertices, segments, regions: network.regions };
}

/** Changing the coupling is an explicit edit; use the first non-zero handle as reference. */
export function setVectorVertexMirroring(
  network: Geometry,
  index: number,
  mode: HandleMirroring,
): Geometry {
  if (
    !network.vertices[index] ||
    !['NONE', 'ANGLE', 'ANGLE_AND_LENGTH'].includes(mode)
  )
    return network;
  const handles = vectorHandlesAtVertex(network, index);
  if (handles.length !== 2 && mode !== 'NONE') return network;
  const vertices = network.vertices.map((v, i) =>
    i === index ? { ...v, handleMirroring: mode } : { ...v },
  );
  const next = { ...network, vertices };
  const reference = handles.find((h) => {
    const p = network.segments[h.segmentIndex][key(h)];
    return p && Math.hypot(p.x, p.y) > 1e-9;
  });
  return mode === 'NONE' || !reference
    ? next
    : moveVectorHandle(
        next,
        reference,
        network.segments[reference.segmentIndex][key(reference)]!,
      );
}
