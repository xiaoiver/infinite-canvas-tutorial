import type { VectorNetwork } from '../../packages/ecs/src/components/geometry/VectorNetwork';
import {
  moveVectorHandle,
  setVectorVertexMirroring,
} from '../../packages/ecs/src/utils/vector-network-handles';

const geometry = (): VectorNetwork => ({
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
  ],
  segments: [
    { start: 0, end: 1, tangentEnd: { x: -20, y: 0 } },
    { start: 1, end: 2, tangentStart: { x: 40, y: 0 } },
  ],
  regions: [],
});
const handle = { segmentIndex: 1, end: 'start' as const };
it.each(['NONE', 'ANGLE', 'ANGLE_AND_LENGTH'] as const)(
  'moves %s handles without mutating input',
  (mode) => {
    const input = geometry();
    input.vertices[1].handleMirroring = mode;
    const before = structuredClone(input);
    const output = moveVectorHandle(input, handle, { x: 30, y: 40 });
    expect(input).toEqual(before);
    expect(output.segments[1].tangentStart).toEqual({ x: 30, y: 40 });
    expect(output.segments[0].tangentEnd).toEqual(
      mode === 'NONE'
        ? { x: -20, y: 0 }
        : mode === 'ANGLE'
        ? { x: -12, y: -16 }
        : { x: -30, y: -40 },
    );
  },
);
it('breaks coupling explicitly without moving the partner', () => {
  const input = geometry();
  input.vertices[1].handleMirroring = 'ANGLE_AND_LENGTH';
  const output = moveVectorHandle(input, handle, { x: 0, y: 20 }, true);
  expect(output.vertices[1].handleMirroring).toBe('NONE');
  expect(output.segments[0].tangentEnd).toEqual({ x: -20, y: 0 });
});
it('retains the other length when an ANGLE handle collapses, and mirrors zero symmetrically', () => {
  const input = geometry();
  input.vertices[1].handleMirroring = 'ANGLE';
  expect(
    moveVectorHandle(input, handle, { x: 0, y: 0 }).segments[0].tangentEnd,
  ).toEqual({ x: -20, y: 0 });
  input.vertices[1].handleMirroring = 'ANGLE_AND_LENGTH';
  const zero = moveVectorHandle(input, handle, { x: 0, y: 0 }).segments[0]
    .tangentEnd!;
  expect(Math.hypot(zero.x, zero.y)).toBe(0);
});
it('does not choose arbitrary partners at a branch vertex', () => {
  const input = geometry();
  input.vertices[1].handleMirroring = 'ANGLE_AND_LENGTH';
  input.segments.push({ start: 1, end: 0, tangentStart: { x: 0, y: 25 } });
  const output = moveVectorHandle(input, handle, { x: 30, y: 40 });
  expect(output.segments[0]).toEqual(input.segments[0]);
  expect(output.segments[2]).toEqual(input.segments[2]);
  expect(setVectorVertexMirroring(input, 1, 'ANGLE')).toBe(input);
});
it('counts a self-loop as two handles', () => {
  const input = {
    vertices: [{ x: 0, y: 0, handleMirroring: 'ANGLE_AND_LENGTH' as const }],
    segments: [
      {
        start: 0,
        end: 0,
        tangentStart: { x: 20, y: 30 },
        tangentEnd: { x: -10, y: 0 },
      },
    ],
  };
  const output = moveVectorHandle(
    input,
    { segmentIndex: 0, end: 'end' },
    { x: -30, y: 10 },
  );
  expect(output.segments[0].tangentStart).toEqual({ x: 30, y: -10 });
});
it('aligns immediately when changing coupling, without changing regions', () => {
  const input = geometry();
  input.regions = [{ fillRule: 'evenodd', loops: [[0, 1]] }];
  input.segments[0].tangentEnd = { x: 0, y: -20 };
  const output = setVectorVertexMirroring(input, 1, 'ANGLE_AND_LENGTH');
  expect(output.segments[1].tangentStart).toEqual({ x: -0, y: 20 });
  expect(output.vertices[1].handleMirroring).toBe('ANGLE_AND_LENGTH');
  expect(output.regions).toEqual(input.regions);
});
it('keeps zero handles finite and rejects invalid input', () => {
  const input = geometry();
  input.segments.forEach((s) => {
    delete s.tangentStart;
    delete s.tangentEnd;
  });
  expect(setVectorVertexMirroring(input, 1, 'ANGLE').segments).toEqual(
    input.segments,
  );
  expect(
    moveVectorHandle(input, { segmentIndex: 10, end: 'start' }, { x: 1, y: 1 }),
  ).toBe(input);
  expect(moveVectorHandle(input, handle, { x: NaN, y: 1 })).toBe(input);
});
