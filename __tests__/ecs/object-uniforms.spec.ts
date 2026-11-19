import '../../packages/ecs/src';
import { Mat3 } from '../../packages/ecs/src/components/math/Mat3';
import { ObjectUniforms } from '../../packages/ecs/src/utils/object-uniforms';
import { paddingMat3 } from '../../packages/ecs/src/utils/matrix';
import { Drawcall } from '../../packages/ecs/src/drawcalls/Drawcall';
import type { Buffer } from '../../packages/device-api/src';

function target() {
  const data = new Uint8Array(512);
  const writes: Uint8Array[] = [];
  const setSubData = jest.fn((offset: number, bytes: Uint8Array) => {
    writes.push(bytes.slice());
    data.set(bytes, offset);
  });
  return {
    buffer: { setSubData } as unknown as Buffer,
    setSubData,
    writes,
    data,
  };
}
it('matches std140 packing and Float32 conversion, reusing model/storage and equal writes', () => {
  const t = target(),
    u = new ObjectUniforms();
  const m = new Mat3(1, 2, 3, 4, 5, 6, 7, 8, 9),
    values = [0.1, 0.7, 0, NaN];
  const model = u.update(t.buffer, m, values);
  const expected = new Uint8Array(
    new Float32Array([...paddingMat3(m), ...values]).buffer,
  );
  expect(t.writes[0]).toEqual(expected);
  for (let i = 0; i < 5; i++)
    expect(
      u.update(t.buffer, new Mat3(1, 2, 3, 4, 5, 6, 7, 8, 9), [...values]),
    ).toBe(model);
  expect(t.setSubData).toHaveBeenCalledTimes(1);
  expect([...model]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
it('detects in-place model/paint edits, Float32-equivalent inputs, and signed zero', () => {
  const t = target(),
    u = new ObjectUniforms(),
    m = new Mat3();
  u.update(t.buffer, m, [0.1, 0]);
  u.update(t.buffer, m, [Math.fround(0.1), 0]);
  expect(t.writes).toHaveLength(1);
  m.m20 = 31;
  m.m00 = -2;
  u.update(t.buffer, m, [0.2, -0]);
  const packet = new Float32Array(t.writes[1].buffer);
  expect(packet[8]).toBe(31);
  expect(packet[0]).toBe(-2);
  expect(packet[12]).toBe(Math.fround(0.2));
  expect(Object.is(packet[13], -0)).toBe(true);
  u.update(t.buffer, m, [0.2, 0]);
  expect(t.writes).toHaveLength(3);
});
it('tracks the physical last write across layer/bake A -> B -> A transitions', () => {
  const t = target(),
    u = new ObjectUniforms();
  const a = new Mat3(),
    b = new Mat3(1, 0, 0, 0, 1, 0, -20, -30, 1);
  u.update(t.buffer, a, [1, 0]);
  u.update(t.buffer, b, [0, 1]);
  u.update(t.buffer, a, [1, 0]);
  expect(t.writes).toHaveLength(3);
  expect(t.writes[2]).toEqual(t.writes[0]);
  u.update(t.buffer, a, [1, 0]);
  expect(t.writes).toHaveLength(3);
});
it('writes a replacement buffer and never shares state between drawcall owners', () => {
  const a = target(),
    b = target(),
    u = new ObjectUniforms(),
    v = new ObjectUniforms(),
    m = new Mat3();
  u.update(a.buffer, m, [0.7]);
  u.update(b.buffer, m, [0.7]);
  expect(a.writes).toHaveLength(1);
  expect(b.writes).toHaveLength(1);
  v.update(a.buffer, m, [0.7]);
  expect(a.writes).toHaveLength(2);
  u.clear();
  u.update(b.buffer, m, [0.7]);
  expect(b.writes).toHaveLength(2);
  u.update(b.buffer, m, [0.7, 1]);
  expect(b.writes[2]).toHaveLength(56);
});
it('retries an equal packet after initial or later upload failures', () => {
  const t = target(),
    u = new ObjectUniforms(),
    m = new Mat3();
  t.setSubData.mockImplementationOnce(() => {
    throw new Error('upload failed');
  });
  expect(() => u.update(t.buffer, m, [1])).toThrow('upload failed');
  u.update(t.buffer, m, [1]);
  expect(t.writes).toHaveLength(1);
  t.setSubData.mockImplementationOnce(() => {
    throw new Error('later failure');
  });
  expect(() => u.update(t.buffer, m, [2])).toThrow('later failure');
  u.update(t.buffer, m, [2]);
  expect(new Float32Array(t.writes[1].buffer)[12]).toBe(2);
});
class Colors extends Drawcall {
  createGeometry() {}
  createMaterial() {}
  render() {}
  color(value: string) {
    return this.getUniformColor(value);
  }
}
it('reuses resolved colors, bounds animated color retention, and clears on retirement', () => {
  const d = new Colors(null, null, null, null, false, 0, null);
  const first = d.color('rgb(10 20 30 / 50%)');
  expect(d.color('rgb(10 20 30 / 50%)')).toBe(first);
  expect(first).toEqual({ r: 10, g: 20, b: 30, opacity: 0.5 });
  for (let i = 0; i < 40; i++) d.color(`rgb(${i},0,0)`);
  expect(d.color('rgb(10 20 30 / 50%)')).not.toBe(first);
  const cached = d.color('red');
  d.destroy();
  expect(d.color('red')).not.toBe(cached);
});
