export function instanceBufferContract(
  create: (
    data: Float32Array,
    target: { setSubData(offset: number, bytes: Uint8Array): void },
    stride: number,
  ) => any,
) {
  function fixture(rows = 5, stride = 2) {
    const storage = new Uint8Array(rows * stride * 4),
      writes: { offset: number; bytes: Uint8Array }[] = [];
    const target = {
      setSubData: jest.fn((offset: number, bytes: Uint8Array) => {
        storage.set(bytes, offset);
        writes.push({ offset, bytes: bytes.slice() });
      }),
    };
    const data = new Float32Array(rows * stride);
    return {
      data,
      target,
      writes,
      storage,
      buffer: create(data, target, stride),
    };
  }
  it('coalesces adjacent rows and skips Float32-equivalent values, stable NaN and signed zero', () => {
    const t = fixture();
    t.buffer.write(1, [0.1, NaN]);
    t.buffer.write(2, [-0, 3]);
    t.buffer.write(4, [4, 5]);
    t.buffer.flush(5);
    expect(t.writes.map((w) => [w.offset, w.bytes.length])).toEqual([
      [8, 16],
      [32, 8],
    ]);
    expect(t.storage).toEqual(new Uint8Array(t.data.buffer));
    t.target.setSubData.mockClear();
    t.buffer.write(1, [Math.fround(0.1), NaN]);
    t.buffer.write(2, [-0, 3]);
    t.buffer.flush(5);
    expect(t.target.setSubData).not.toHaveBeenCalled();
    t.buffer.write(2, [0, 3]);
    t.buffer.flush(5);
    expect(t.target.setSubData).toHaveBeenCalledTimes(1);
    expect(Object.is(new Float32Array(t.storage.buffer)[4], 0)).toBe(true);
  });
  it('retries failed and later ranges without requiring another CPU value change', () => {
    const t = fixture(),
      failure = new Error('upload failed');
    t.buffer.write(0, [1, 2]);
    t.buffer.write(4, [3, 4]);
    const upload = t.target.setSubData.getMockImplementation();
    t.target.setSubData
      .mockImplementationOnce(upload)
      .mockImplementationOnce(() => {
        throw failure;
      });
    expect(() => t.buffer.flush(5)).toThrow(failure);
    t.buffer.write(4, [3, 4]);
    t.buffer.flush(5);
    expect(t.writes.map((w) => w.offset)).toEqual([0, 32]);
    expect(t.storage).toEqual(new Uint8Array(t.data.buffer));
    t.buffer.flush(5);
    expect(t.writes).toHaveLength(2);
  });
  it('defers inactive rows until reentry and prevents retired work from uploading', () => {
    const t = fixture();
    t.buffer.write(4, [1, 2]);
    t.buffer.flush(2);
    expect(t.writes).toEqual([]);
    t.buffer.write(4, [1, 2]);
    t.buffer.flush(5);
    expect(t.writes).toHaveLength(1);
    t.buffer.write(0, [9, 9]);
    t.buffer.dispose();
    t.buffer.flush(5);
    t.buffer.write(0, [8, 8]);
    t.buffer.set(0, 0, 7);
    expect(t.writes).toHaveLength(1);
    expect(t.buffer.matches(t.data, t.target)).toBe(false);
  });
  it('uses the CPU view byte offset, independent matrix components and exact buffer identity', () => {
    const whole = new Float32Array(30),
      data = whole.subarray(6, 18),
      writes: Uint8Array[] = [];
    const target = {
      setSubData: (offset: number, bytes: Uint8Array) => {
        expect(offset).toBe(24);
        writes.push(bytes.slice());
      },
    };
    const buffer = create(data, target, 6);
    buffer.set(1, 4, 12);
    buffer.set(1, 5, 34);
    buffer.flush(2);
    expect([...new Float32Array(writes[0].buffer)]).toEqual([
      0, 0, 0, 0, 12, 34,
    ]);
    expect(buffer.matches(data, target)).toBe(true);
    expect(buffer.matches(data.subarray(0), target)).toBe(false);
    expect(() => buffer.write(0, [1])).toThrow(RangeError);
    expect(() => buffer.set(3, 0, 1)).toThrow(RangeError);
  });
  it('bounds fragmented uploads with one spanning range', () => {
    const t = fixture(20, 1);
    for (let row = 0; row < 18; row += 2) t.buffer.write(row, [row + 1]);
    t.buffer.flush(20);
    expect(t.writes.map((w) => [w.offset, w.bytes.length])).toEqual([
      [0, 17 * 4],
    ]);
    expect(t.storage).toEqual(new Uint8Array(t.data.buffer));
  });
  it('retains earlier component writes if a later input read throws', () => {
    const t = fixture(),
      failure = new Error('input read failed');
    const values = {
      length: 2,
      0: 1,
      get 1() {
        throw failure;
      },
    };
    expect(() => t.buffer.write(0, values)).toThrow(failure);
    t.buffer.write(0, [1, 0]);
    t.buffer.flush(5);
    expect(t.writes).toHaveLength(1);
    expect(new Float32Array(t.storage.buffer)[0]).toBe(1);
  });
}
